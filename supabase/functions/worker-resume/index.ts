import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let commandId: string | null = null;

    try {
        // 1. IDENTITY VERIFICATION (SEC-003)
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error("Missing Authorization header")

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
        if (authError || !user) throw new Error("Invalid or expired session")

        const payload = await req.json()
        const { file_path, file_name, session_id } = payload
        commandId = payload.command_id
        const user_id = user.id

        console.log(`[DEBUG] Resume Worker invoked for user: ${user_id}, file: ${file_name}`);

        // 1.1 RAW LAYER: STORE FILE METADATA
        const { data: rawSnapshot, error: rawError } = await supabaseClient
            .from('raw_external_snapshots')
            .insert({
                user_id,
                command_id: commandId,
                url: `file://${file_path}`,
                raw_payload: { file_name, file_path, source_type: 'RESUME_UPLOAD' }
            })
            .select().single();

        if (rawError) throw rawError;

        // 2. EVIDENCE LEDGER: MANUAL CLAIM WITH MEDIUM CONFIDENCE
        const { error: evidenceError } = await supabaseClient.from('evidence_ledger').insert({
            user_id,
            claim_type: 'EXPERIENCE',
            source: 'MANUAL',
            raw_reference_id: rawSnapshot.id,
            ingestion_session_id: session_id,
            claim_data: {
                title: "Manual Resume Artifact",
                file_name,
                verification_note: "User-uploaded document"
            },
            trust_score: 0.80,
            verification_strength: 0.60,
            final_weight: 0.70
        });

        if (evidenceError) throw evidenceError;

        // 3. TRIGGER SNAPSHOT BUILDER (With Authorization)
        await supabaseClient.functions.invoke('snapshot-builder', {
            headers: { 'Authorization': authHeader },
            body: { user_id, session_id }
        });

        // 4. LOG SYSTEM INTEGRITY
        await supabaseClient.from('integrity_events').insert({
            user_id,
            event_type: 'INGESTION',
            source: 'RESUME_WORKER',
            message: `Artifact Processed: ${file_name}. Evidence node ${rawSnapshot.id} linked.`,
            metadata: { command_id: commandId, session_id }
        });

        // 5. UPDATE COMMAND STATUS
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
