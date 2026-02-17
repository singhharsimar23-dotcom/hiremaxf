import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Guardrails } from "../_shared/guardrails.ts";
const corsHeaders = Guardrails.getCorsHeaders();
const corsHeaders = Guardrails.getCorsHeaders();
serve(async (req) => {
    if (req.method === 'OPTIONS')
        return new Response('ok', { headers: corsHeaders });
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    try {
        await Guardrails.checkGovernor(supabaseClient);
        const url = new URL(req.url);
        // Clean path handling
        let subPath = url.pathname.replace('/execution-engine', '');
        if (!subPath || subPath === '/') {
            subPath = url.searchParams.get('route') || req.headers.get('x-action') || '';
        }
        if (subPath && !subPath.startsWith('/'))
            subPath = '/' + subPath;
        console.log(`[EXECUTION_ENGINE] Route: ${subPath}`);
        // --- 1. EVALUATE CONTEXT (Event-Driven Trigger) ---
        if (subPath === '/evaluate-context' && req.method === 'POST') {
            const body = await req.json();
            const { url: pageUrl, dom_structure_hash, user_id, extension_version, idempotency_key } = body;
            // 0. Version Gating
            const MIN_VERSION = "1.0.0";
            if (extension_version && extension_version < MIN_VERSION) {
                return new Response(JSON.stringify({ error: "UPGRADE_REQUIRED", min_version: MIN_VERSION }), { status: 426, headers: corsHeaders });
            }
            if (!pageUrl || !user_id || !dom_structure_hash) {
                throw new Error("MISSING_CONTEXT: url, user_id, and hash are required.");
            }
            const domain = new URL(pageUrl).hostname;
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
            // D. Helper: Acquire Lock V2 (Idempotent & Heartbeat-aware)
            // Ideally we call the RPC here. For now we mock the successful response structure
            // In PROD: const lock = await supabaseClient.rpc('acquire_application_lock_v2', { ... });
            // if (!lock.success) return 409...
            const execution_id = crypto.randomUUID();
            const lockToken = crypto.randomUUID();
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
            if (!execution_id)
                throw new Error("MISSING_EXECUTION_ID");
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
        // ... (Keep existing analyze-kill-zone if it's still used by frontend)
        return new Response(JSON.stringify({ error: "ROUTE_NOT_FOUND", route: subPath }), { status: 404, headers: corsHeaders });
    }
    catch (error) {
        return Guardrails.handleError(supabaseClient, error, "EXECUTION_ENGINE");
    }
});
