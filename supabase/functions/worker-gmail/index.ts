import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { calculateFinalWeight } from "../_shared/signal-math.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ALLOWED_DOMAINS = ['google.com', 'meta.com', 'stripe.com', 'greenhouse.io', 'lever.co', 'workday.com'];

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let commandId: string | null = null;
    let sessionId: string | null = null;

    try {
        // 1. IDENTITY VERIFICATION (SEC-003)
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error("Missing Authorization header")

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
        if (authError || !user) throw new Error("Invalid or expired session")

        const payload = await req.json()
        commandId = payload.command_id
        sessionId = payload.session_id
        const user_id = user.id

        // 1.1 DATA SCAN (PRODUCTION AUTHENTICATED MODE)
        let gmailData;

        // Fetch User Identity Tokens from Vault
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('metadata')
            .eq('id', user_id)
            .single();

        const token = profile?.metadata?.identities?.google?.token;

        if (token) {
            console.log("Gmail: Authenticating via User OAuth Vault");
            // PRODUCTION BRIDGE: Real API calls to Gmail
            // Search for job-related emails from known domains
            const query = `from:(${ALLOWED_DOMAINS.join(' OR ')}) newer_than:30d`;
            const listResp = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (listResp.ok) {
                const listData = await listResp.json();
                const messages = [];
                for (const msgRef of (listData.messages || []).slice(0, 10)) {
                    const msgResp = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgRef.id}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (msgResp.ok) {
                        const msgData = await msgResp.json();
                        messages.push({
                            id: msgData.id,
                            from: msgData.payload.headers.find((h: any) => h.name === 'From')?.value || "",
                            subject: msgData.payload.headers.find((h: any) => h.name === 'Subject')?.value || "",
                            body: msgData.snippet,
                            date: new Date(parseInt(msgData.internalDate)).toISOString()
                        });
                    }
                }
                gmailData = { messages };
            }
        }

        if (!gmailData) {
            console.error("Gmail: No vault token available for live signal scanning.");
            throw new Error("AUTHENTICATION_REQUIRED: Please connect your Google account to scan for live career outcomes.");
        }

        const messagesToProcess = gmailData.messages;

        // 2. STORE IN RAW LAYER
        const { data: rawSnapshot, error: rawError } = await supabaseClient
            .from('raw_gmail_snapshots')
            .insert({
                user_id,
                command_id: commandId,
                raw_payload: gmailData
            })
            .select().single()

        if (rawError) throw rawError

        // 3. PROCESS OUTCOMES (GROUND TRUTH ONLY)
        const GMAIL_PATTERNS = {
            'JOB_OFFER': { keywords: ['offer letter', 'pleased to offer', 'extend an offer'], weight: 1.0 },
            'INTERVIEW_INVITATION': { keywords: ['interview', 'schedule a call', 'phone screen'], weight: 0.9 },
            'REJECTION': { keywords: ['not moving forward', 'not selected', 'will not be proceeding'], weight: 0.7 },
            'ACKNOWLEDGEMENT': { keywords: ['application received', 'thank you for applying'], weight: 0.4 }
        };

        for (const msg of messagesToProcess) {
            const domain = msg.from.split('@')[1];
            if (!ALLOWED_DOMAINS.some(d => domain.includes(d))) continue;

            const content = `${msg.subject} ${msg.body}`.toLowerCase();
            let matchedType = 'APPLICATION_TRACKING';
            let baseWeight = 0.3;

            for (const [type, config] of Object.entries(GMAIL_PATTERNS)) {
                if (config.keywords.some(k => content.includes(k))) {
                    matchedType = type;
                    baseWeight = config.weight;
                    break;
                }
            }

            // Record Outcome (Separate Namespace)
            // Record Outcome (Separate Namespace)
            const { data: outcome } = await supabaseClient.from('profile_outcomes').insert({
                user_id,
                source_reference_id: rawSnapshot.id,
                employer_name: domain.split('.')[0],
                funnel_stage: matchedType,
                outcome_classification: 'GMAIL_FORENSICS',
                learning_metadata: { subject: msg.subject, date: msg.date }
            }).select().single();

            // --- LEARNING LOOP CONNECTION ---
            // Try to link this outcome to a previous prediction for this company
            if (outcome) {
                const employerName = domain.split('.')[0];
                const { data: prediction } = await supabaseClient
                    .from('prediction_logs')
                    .select('id')
                    .eq('user_id', user_id)
                    .ilike('context->>company', `%${employerName}%`) // Fuzzy match company name
                    .is('outcome_id', null) // Only link if not already linked (or maybe we want to overwrite?)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (prediction) {
                    await supabaseClient
                        .from('prediction_logs')
                        .update({ outcome_id: outcome.id })
                        .eq('id', prediction.id);
                    console.log(`[GMAIL_WORKER] Linked outcome ${outcome.id} to prediction ${prediction.id}`);

                    // 5. TRIGGER INTELLIGENCE LOOP (AUTO-OPTIMIZATION)
                    // Fire and forget - don't hold up the worker
                    console.log("[GMAIL_WORKER] Triggering Intelligence Engine Optimization...");
                    fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/optimize-weights`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({})
                    }).catch(err => console.error("Failed to trigger optimization:", err));
                }
            }

            // Record Learning Event (Redirected to integrity_events for observability v2.5)
            await supabaseClient.from('integrity_events').insert({
                user_id,
                event_type: 'SYSTEM',
                source: 'GMAIL_WORKER',
                message: `Outcome detected: ${matchedType} from ${domain}`,
                metadata: { subject: msg.subject, weight: baseWeight, outcome_id: outcome?.id }
            });

            // NOTE: worker-gmail EXPLICITLY DOES NOT write to career_* tables
        }

        // 4. CONVERGENCE GATE (v2.5)
        if (sessionId) {
            await supabaseClient.rpc('increment_session_completion', { session_id: sessionId });

            const { data: sessionData } = await supabaseClient.from('ingestion_sessions').select('*').eq('id', sessionId).single();
            if (sessionData && sessionData.completed_workers >= sessionData.expected_workers) {
                await supabaseClient.from('ingestion_sessions').update({ state: 'converged' }).eq('id', sessionId);

                // Trigger Snapshot Builder
                await supabaseClient.functions.invoke('snapshot-builder', {
                    headers: { 'Authorization': authHeader },
                    body: { user_id, session_id: sessionId }
                });
            }
        }

        if (commandId) {
            await supabaseClient.from('ingestion_commands').update({ status: 'completed' }).eq('id', commandId);
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        if (commandId) {
            await supabaseClient.from('ingestion_commands').update({ status: 'failed', error_reason: error.message }).eq('id', commandId);
        }
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
