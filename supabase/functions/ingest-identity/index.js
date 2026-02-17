import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }
    try {
        const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
        // 1. IDENTITY ANCHORING (SEC-003)
        const authHeader = req.headers.get('Authorization');
        if (!authHeader)
            throw new Error("Missing Authorization header");
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''));
        if (authError || !user)
            throw new Error("Invalid or expired session");
        const body = await req.json();
        const { source, source_type, action, payload, url_classification } = body;
        // Force user_id from verified JWT
        const user_id = user.id;
        // 2. HARDENED IDEMPOTENCY (v2.5)
        // includes classification and 1-hour time epoch to allow intentional re-syncs
        const epoch = Math.floor(Date.now() / (1000 * 60 * 60)); // 1-hour window
        const normalized_source = source_type === 'URL' ? payload?.url : source;
        const idempotency_key = `${user_id}-${normalized_source}-${url_classification || 'DEFAULT'}-${epoch}`.toLowerCase();
        // 3. VALIDATE INGESTION COMMAND SCHEMA (CONTRACT-DRIVEN)
        if (!source || !source_type || !action) {
            throw new Error("Missing mandatory IngestionCommand fields: source, source_type, action");
        }
        // Strict Routing & Classification Rules
        if (source_type === 'URL') {
            const ALLOWED_UR_TYPES = ['PORTFOLIO', 'BLOG', 'SCHOLAR', 'KAGGLE', 'HUGGINGFACE', 'STACKOVERFLOW', 'OS_DOCS'];
            if (!url_classification || !ALLOWED_UR_TYPES.includes(url_classification)) {
                await supabaseClient.from('integrity_events').insert({
                    user_id,
                    event_type: 'INGESTION_REJECTED',
                    source,
                    message: `Ingestion rejected: Missing or invalid URL classification (${url_classification})`,
                    metadata: { payload }
                });
                throw new Error(`URL ingestion MUST be classified as one of: ${ALLOWED_UR_TYPES.join(', ')}`);
            }
            if (!payload?.url)
                throw new Error("URL sources MUST receive payload.url");
        }
        if (source_type === 'OAUTH' && payload?.url) {
            throw new Error("OAuth sources MUST NOT receive URLs in payload - Contract Violation");
        }
        // 4. CREATE INGESTION SESSION (THE CONVERGENCE GATE)
        const { data: session, error: sessError } = await supabaseClient
            .from('ingestion_sessions')
            .insert({
            user_id,
            command_hash: idempotency_key,
            expected_workers: 1, // Scalable to multi-worker batches (e.g. Full Profile Sync)
            state: 'open'
        })
            .select()
            .single();
        if (sessError)
            throw sessError;
        // 5. REGISTER COMMAND
        const { data: command, error: cmdError } = await supabaseClient
            .from('ingestion_commands')
            .upsert({
            user_id,
            source,
            source_type,
            action,
            url_classification,
            metadata: payload || {},
            idempotency_key,
            ingestion_session_id: session.id,
            status: 'processing'
        }, { onConflict: 'idempotency_key' })
            .select()
            .single();
        if (cmdError)
            throw cmdError;
        // 6. TRIGGER INTEGRITY LOG
        await supabaseClient.from('integrity_events').insert({
            user_id,
            event_type: 'INGESTION',
            source,
            message: `Ingestion v2.5 Session Initialized: ${session.id}`,
            metadata: { command_id: command.id, session_id: session.id }
        });
        // 7. HANDOFF TO ASYNC WORKER
        let workerName = `worker-${source.toLowerCase()}`;
        if (source_type === 'URL')
            workerName = 'worker-external';
        if (source_type === 'FILE')
            workerName = 'worker-resume';
        console.log(`Invoking worker: ${workerName} for session ${session.id}`);
        // Await invocation to ensure it reaches the orchestrator before responding
        try {
            await supabaseClient.functions.invoke(workerName, {
                headers: { 'Authorization': authHeader },
                body: {
                    user_id,
                    command_id: command.id,
                    session_id: session.id,
                    source,
                    source_type,
                    action,
                    payload
                }
            });
        }
        catch (workerErr) {
            console.error(`Worker ${workerName} trigger failed:`, workerErr);
            // Still return 202 as the session is recorded and can be retried/debugged
        }
        return new Response(JSON.stringify({
            command_id: command.id,
            session_id: session.id,
            status: 'processing',
            message: `Forensic session ${session.id} opened for ${source}`
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 202,
        });
    }
    catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
