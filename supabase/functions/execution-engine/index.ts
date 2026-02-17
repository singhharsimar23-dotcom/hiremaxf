import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { Guardrails } from "../_shared/guardrails.ts"

const corsHeaders = Guardrails.getCorsHeaders();

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    try {
        await Guardrails.checkGovernor(supabaseClient);

        const url = new URL(req.url);
        // Clean path handling
        let subPath = url.pathname.replace('/execution-engine', '');
        if (!subPath || subPath === '/') {
            subPath = url.searchParams.get('route') || req.headers.get('x-action') || '';
        }
        if (subPath && !subPath.startsWith('/')) subPath = '/' + subPath;

        console.log(`[EXECUTION_ENGINE] Route: ${subPath}`);

        // --- 1. EVALUATE CONTEXT (Event-Driven Trigger) ---
        if (subPath === '/evaluate-context' && req.method === 'POST') {
            const body = await req.json();
            const { url: pageUrl, dom_structure_hash, user_id, extension_version, idempotency_key, job_id } = body;

            // 0. Version Gating
            const MIN_VERSION = "1.0.0";
            if (extension_version && extension_version < MIN_VERSION) {
                return new Response(JSON.stringify({ error: "UPGRADE_REQUIRED", min_version: MIN_VERSION }), { status: 426, headers: corsHeaders });
            }

            if (!pageUrl || !user_id || !dom_structure_hash) {
                throw new Error("MISSING_CONTEXT: url, user_id, and hash are required.");
            }

            // 1. PLAN ENFORCEMENT (Server-Side Gating)
            const { data: profile } = await supabaseClient
                .from('profiles')
                .select('plan, credits')
                .eq('id', user_id)
                .single();

            // Allow 'pro' plan OR 'free' with > 0 credits
            const isEligible = profile?.plan === 'pro' || (profile?.credits || 0) > 0;

            if (!isEligible) {
                return new Response(JSON.stringify({
                    error: "PLAN_LIMIT_REACHED",
                    message: "You have no execution credits left.",
                    upgrade_url: "/pricing"
                }), { status: 402, headers: corsHeaders }); // 402 Payment Required
            }

            const domain = new URL(pageUrl).hostname;

            // 2. CONTEXT VALIDATION (If job_id is provided)
            if (job_id) {
                const { data: job } = await supabaseClient
                    .from('job_pointers')
                    .select('source_url')
                    .eq('id', job_id)
                    .single();

                if (job) {
                    try {
                        const jobHost = new URL(job.source_url).hostname;
                        if (jobHost !== domain) {
                            console.warn(`[SECURITY] Domain Mismatch: Job ${job_id} expects ${jobHost}, got ${domain}`);
                            return new Response(JSON.stringify({ error: "CONTEXT_MISMATCH", message: "Application context does not match current domain." }), { status: 400, headers: corsHeaders });
                        }
                    } catch (e) {
                        // Invalid URL in DB? Ignore or blocking? Let's block to be safe.
                        return new Response(JSON.stringify({ error: "INVALID_JOB_URL" }), { status: 500, headers: corsHeaders });
                    }
                }
            }

            // A. Circuit Breaker Check
            const { data: circuit } = await supabaseClient
                .from('domain_health')
                .select('circuit_state')
                .eq('domain', domain)
                .maybeSingle();

            if (circuit?.circuit_state === 'OPEN') {
                return new Response(JSON.stringify({
                    action: "ASSISTED_MANUAL",
                    reason: "CIRCUIT_OPEN",
                    strategy_id: crypto.randomUUID()
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            // B. Check Bot Risk (V2)
            const { data: riskData } = await supabaseClient
                .from('bot_risk_ledger')
                .select('risk_tier, fingerprint_score')
                .eq('domain', domain)
                .maybeSingle();

            const riskTier = riskData?.risk_tier || 'LOW';
            // If fingerprint score < 0.5, force Extension (Bot is likely blocked)
            const forceExtension = (riskData?.fingerprint_score || 1.0) < 0.5;

            // C. Check DOM Knowledge (Hashed - V2 Logic)
            const { data: knowledge } = await supabaseClient
                .from('dom_knowledge_base')
                .select('*')
                .eq('domain', domain)
                .eq('structural_hash', dom_structure_hash)
                .order('stability_score', { ascending: false })
                .limit(1)
                .maybeSingle();

            let action = "EXTENSION_FORM_FILL";
            if (knowledge) {
                action = "EXTENSION_MAPPED_FILL";
            }

            if (forceExtension) {
                // If bot is risky, prefer extension even if knowledge is perfect
                // action remains EXTENSION_*
            }

            // D. Helper: Acquire Lock V3 (Idempotent & Heartbeat-aware & Context-Validated)
            // Note: IF the migration failed, this RPC might not exist.
            // We use the new signature. The user MUST apply the migration.

            // If job_id is missing (Discovery Mode), we skip locking for execution?
            // Or we generate a temporary lock?
            // User requirement: "If extension calls... what happens? Does backend check...?"
            // Ideally we REQUIRE job_id for execution.

            let lockToken = null;
            let execution_id = crypto.randomUUID();

            if (job_id) {
                const { data: lockData, error: lockError } = await supabaseClient.rpc('acquire_application_lock_v3', {
                    p_user_id: user_id,
                    p_job_id: job_id,
                    p_execution_id: execution_id,
                    p_idempotency_key: idempotency_key || crypto.randomUUID(),
                    p_page_url: pageUrl
                });

                if (lockError) {
                    throw lockError;
                }

                if (!lockData.success) {
                    return new Response(JSON.stringify({
                        error: "LOCK_CONFLICT",
                        reason: lockData.error,
                        lock_id: lockData.lock_id
                    }), { status: 409, headers: corsHeaders });
                }

                // Lock Acquired
                lockToken = crypto.randomUUID(); // In real V3, lockData might return a token? For now we simulate.
            } else {
                // Discovery Mode: No lock, but return strategy.
                // Action might be "IDENTIFY_JOB" instead of "FILL".
            }

            return new Response(JSON.stringify({
                strategy_id: crypto.randomUUID(),
                action: action,
                risk_tier: riskTier,
                knowledge_found: !!knowledge,
                field_mapping: knowledge?.field_maps || null,
                lock_token: lockToken,
                execution_id: execution_id, // Client uses this for heartbeats
                constraints: {
                    abort_on_captcha: true,
                    require_confirmation: true,
                    check_honeypots: true // Tell extension to run Trap Defense
                }
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // --- 2. HEARTBEAT (New V2 Requirement) ---
        if (subPath === '/heartbeat' && req.method === 'POST') {
            const body = await req.json();
            const { execution_id } = body;

            if (!execution_id) throw new Error("MISSING_EXECUTION_ID");

            const { data, error } = await supabaseClient.rpc('send_execution_heartbeat', {
                p_execution_id: execution_id
            });

            if (error || !data.success) {
                return new Response(JSON.stringify({ success: false, error: "LOCK_LOST" }), { status: 410, headers: corsHeaders });
            }

            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // --- 3. RECORD TELEMETRY (Learning Loop) ---
        if (subPath === '/record-telemetry' && req.method === 'POST') {
            const body = await req.json();
            const { strategy_id, event, details, domain } = body;

            // Log to console
            console.log(`[TELEMETRY] Strategy ${strategy_id}: ${event}`, details);

            // If FAILURE, increment circuit breaker count (Async)
            if (event === 'EXECUTION_FAILED' && domain) {
                // In prod: DB increment logic
            }

            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // --- OLDER ENDPOINTS (Preserved for compatibility if needed) ---
        // --- OLDER ENDPOINTS (Restored for Frontend Compatibility) ---

        // 4. LIST APPLICATIONS (Dashboard)
        if (subPath === '/list-applications' && req.method === 'GET') {
            const userId = url.searchParams.get('user_id');
            if (!userId) throw new Error("MISSING_USER_ID");

            const { data: apps, error } = await supabaseClient
                .from('applications')
                .select('*')
                .eq('user_id', userId)
                .order('updated_at', { ascending: false });

            if (error) throw error;

            // Map to standard JobPointer format
            const mapped = apps.map((app: any) => ({
                id: app.id, // Application ID
                job_id: app.job_pointer_id || app.job_id || app.id, // Correct column
                company: app.company,
                role: app.title, // 'title' in DB -> 'role' in UI
                location: app.location,
                state: app.status, // 'status' -> 'state'
                match_confidence: app.match_score || 0.0,
                salary: app.salary_range || 'Not listed',
                source_url: app.source_url,
                tracking: {
                    applied_at: app.applied_at,
                    timeline: app.timeline || []
                }
            }));

            return new Response(JSON.stringify(mapped), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // 5. ANALYZE KILL ZONE (Save & Track)
        if (subPath === '/analyze-kill-zone' && req.method === 'POST') {
            const body = await req.json();
            const { job_id, user_id } = body;

            if (!job_id || !user_id) throw new Error("MISSING_PARAMS");

            // 1. Get Job Details from Job Pointer
            const { data: job } = await supabaseClient
                .from('job_pointers')
                .select('*')
                .eq('id', job_id) // The input 'job_id' is the pointer ID
                .single();

            if (!job) throw new Error("JOB_NOT_FOUND");

            // 1.5 Calculate Match Score (ML Engine)
            let matchScore = 0.85; // Default fallback
            try {
                const { data: score, error: scoreError } = await supabaseClient.rpc('predict_match_score', {
                    p_user_id: user_id,
                    p_company_name: job.company_name || 'Unknown'
                });

                if (!scoreError && score !== null) {
                    matchScore = score;
                }
            } catch (e) {
                console.warn("ML Scoring failed", e);
            }

            // 2. Insert/Upsert into Applications
            // We use upsert to prevent duplicates if user clicks twice
            const { data: app, error } = await supabaseClient
                .from('applications')
                .upsert({
                    user_id: user_id,
                    job_pointer_id: job.id,
                    company: job.company_name || 'Unknown Company', // Defensive Fallback (DB contains NULLs)
                    title: job.title || 'Untitled Role',            // Defensive Fallback (DB contains NULLs)
                    location: job.location_name || 'Remote',        // Defensive Fallback (DB contains NULLs)
                    source_url: job.source_url,
                    status: 'IDENTIFIED',
                    match_confidence: matchScore,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id, job_pointer_id' })
                .select()
                .single();

            if (error) throw error;

            return new Response(JSON.stringify({ success: true, application_id: app.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // 6. SUBMIT APPLICATION (Unblocks "Submit" Button)
        if (subPath === '/submit-application' && req.method === 'POST') {
            const body = await req.json();
            const { application_id, user_id } = body;

            if (!application_id || !user_id) throw new Error("MISSING_PARAMS");

            const { data: app, error } = await supabaseClient
                .from('applications')
                .update({
                    status: 'SUBMITTED', // Update specific column
                    updated_at: new Date().toISOString()
                })
                .eq('id', application_id)
                .eq('user_id', user_id)
                .select()
                .single();

            if (error) throw error;

            return new Response(JSON.stringify({ success: true, application_id: app.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({ error: "ROUTE_NOT_FOUND", route: subPath }), { status: 404, headers: corsHeaders });

    } catch (error: any) {
        return Guardrails.handleError(supabaseClient, error, "EXECUTION_ENGINE");
    }
});
