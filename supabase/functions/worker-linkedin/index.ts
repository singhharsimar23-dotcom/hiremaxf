import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { calculateFinalWeight } from "../_shared/signal-math.ts"

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
        const body_user_id = payload.user_id

        // AUTH ANCHOR: Always use verified user.id from JWT
        const user_id = user.id

        if (body_user_id && body_user_id !== user_id) {
            console.warn(`[SECURITY] User ${user_id} attempted to ingest for ${body_user_id}`);
            throw new Error("Identity mismatch detected - Ingestion aborted");
        }

        // 2. DATA INGESTION (PRODUCTION AUTHENTICATED MODE)
        let linkedinData;

        // Fetch User Identity Tokens from Vault
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('metadata')
            .eq('id', user_id)
            .single();

        const token = profile?.metadata?.identities?.linkedin?.token;
        const apiAvailable = !!token || Deno.env.get('LINKEDIN_API_AVAILABLE') === 'true';

        if (token) {
            console.log("LinkedIn: Authenticating via User OAuth Vault");
            // PRODUCTION BRIDGE: Real API call using the user's token
            const resp = await fetch('https://api.linkedin.com/v2/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (resp.ok) {
                linkedinData = await resp.json();
            } else {
                console.warn("LinkedIn: Vault Token Expired or Invalid. Falling back to Forensic Rehydration.");
            }
        }

        if (!linkedinData) {
            console.error("LinkedIn: Failed to fetch live data and no vault token available.");
            throw new Error("AUTHENTICATION_REQUIRED: Please connect your LinkedIn account to ingest live signals.");
        }

        // 3. STORE IN RAW LAYER
        const { data: rawSnapshot, error: rawError } = await supabaseClient
            .from('raw_linkedin_snapshots')
            .insert({
                user_id,
                command_id: commandId,
                raw_payload: linkedinData
            })
            .select()
            .single()

        if (rawError) throw rawError

        // 4. EXTRACT TO EVIDENCE LEDGER & CAREER DOMAIN (v2.5 Provenance)

        // 4.1 PROCESS WORK HISTORY
        for (const exp of linkedinData.experience) {
            const math = calculateFinalWeight({
                type: 'EXPERIENCE',
                timestamp: exp.start_date || new Date(),
                source: 'LINKEDIN_OFFICIAL_API',
                verificationParams: { hasUrlProof: true, hasArtifact: false },
                corroboratingSources: ['LINKEDIN']
            });

            const { data: evidence, error: evError } = await supabaseClient.from('evidence_ledger').insert({
                user_id,
                claim_type: 'EXPERIENCE',
                source: 'LINKEDIN',
                raw_reference_id: rawSnapshot.id,
                ingestion_session_id: sessionId,
                claim_data: {
                    company: exp.company,
                    title: exp.role,
                    start_date: exp.start_date
                },
                extraction_confidence: 1.0,
                ...math
            }).select().single();

            if (evError) throw evError;

            await supabaseClient.from('career_work_history').insert({
                user_id,
                evidence_id: evidence.id,
                company: exp.company,
                role: exp.role,
                start_date: exp.start_date,
                end_date: exp.end_date,
                description: exp.description,
                is_current: !exp.end_date,
                extraction_method: 'verified',
                confidence_level: 'high'
            });
        }

        // 4.2 PROCESS EDUCATION
        for (const edu of linkedinData.education) {
            const math = calculateFinalWeight({
                type: 'DEGREE',
                timestamp: edu.start_date || new Date(),
                source: 'LINKEDIN_OFFICIAL_API',
                verificationParams: { hasUrlProof: true, hasArtifact: false },
                corroboratingSources: ['LINKEDIN']
            });

            const { data: evidence, error: evError } = await supabaseClient.from('evidence_ledger').insert({
                user_id,
                claim_type: 'EDUCATION',
                source: 'LINKEDIN',
                raw_reference_id: rawSnapshot.id,
                ingestion_session_id: sessionId,
                claim_data: { institution: edu.school, degree: edu.degree },
                extraction_confidence: 1.0,
                ...math
            }).select().single();

            if (evError) throw evError;

            await supabaseClient.from('career_education').insert({
                user_id,
                evidence_id: evidence.id,
                institution: edu.school,
                degree: edu.degree,
                start_date: edu.start_date,
                end_date: edu.end_date,
                extraction_method: 'verified',
                confidence_level: 'high'
            });
        }

        // 4.3 PROCESS SKILLS
        for (const skill of linkedinData.skills) {
            const math = calculateFinalWeight({
                type: 'SKILL_WITH_ENDORSEMENTS',
                timestamp: new Date(),
                source: 'LINKEDIN_OFFICIAL_API',
                verificationParams: { hasEndorsement: true, endorsementQuality: 0.5 },
                corroboratingSources: ['LINKEDIN']
            });

            const { data: evidence, error: evError } = await supabaseClient.from('evidence_ledger').insert({
                user_id,
                claim_type: 'SKILL',
                source: 'LINKEDIN',
                raw_reference_id: rawSnapshot.id,
                ingestion_session_id: sessionId,
                claim_data: { name: skill },
                extraction_confidence: 1.0,
                ...math
            }).select().single();

            if (evError) throw evError;

            await supabaseClient.from('career_skills').insert({
                user_id,
                evidence_id: evidence.id,
                name: skill,
                extraction_method: 'verified',
                confidence_level: 'high'
            });
        }

        // 5. CONVERGENCE GATE (v2.5)
        if (sessionId) {
            await supabaseClient.rpc('increment_session_completion', { session_id: sessionId });

            const { data: sessionData } = await supabaseClient.from('ingestion_sessions').select('*').eq('id', sessionId).single();
            if (sessionData && sessionData.completed_workers >= sessionData.expected_workers) {
                await supabaseClient.from('ingestion_sessions').update({ state: 'converged' }).eq('id', sessionId);
                await supabaseClient.functions.invoke('snapshot-builder', {
                    headers: { 'Authorization': authHeader },
                    body: { user_id, session_id: sessionId }
                });
            }
        }

        // 4. LOG SYSTEM INTEGRITY
        await supabaseClient.from('integrity_events').insert({
            user_id,
            event_type: 'INGESTION',
            source: 'LINKEDIN_WORKER',
            message: `LinkedIn Signals Processed. Fact extraction converged.`,
            metadata: { command_id: commandId, session_id: sessionId }
        });

        if (commandId) {
            await supabaseClient.from('ingestion_commands').update({ status: 'completed' }).eq('id', commandId);
        }

        // 5. DIRECT TRIGGER (If no session orchestration)
        if (!sessionId) {
            await supabaseClient.functions.invoke('snapshot-builder', {
                headers: { 'Authorization': authHeader },
                body: { user_id }
            });
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

