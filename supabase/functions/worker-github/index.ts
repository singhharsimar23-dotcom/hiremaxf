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
        const user_id = user.id

        // 1.1 FETCH GITHUB DATA (PRODUCTION AUTHENTICATED MODE)
        let githubData;

        // Fetch User Identity Tokens from Vault
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('metadata')
            .eq('id', user_id)
            .single();

        const token = profile?.metadata?.identities?.github?.token;

        if (token) {
            console.log("GitHub: Authenticating via User OAuth Vault");
            // PRODUCTION BRIDGE: Real API calls to GitHub
            const [userResp, reposResp] = await Promise.all([
                fetch('https://api.github.com/user', { headers: { 'Authorization': `token ${token}` } }),
                fetch('https://api.github.com/user/repos?sort=updated', { headers: { 'Authorization': `token ${token}` } })
            ]);

            if (userResp.ok && reposResp.ok) {
                const userData = await userResp.json();
                const reposData = await reposResp.json();
                githubData = {
                    user: userData.login,
                    repos: reposData.slice(0, 10).map((r: any) => ({
                        name: r.name,
                        language: r.language,
                        stars: r.stargazers_count,
                        description: r.description
                    })),
                    languages: {}, // To be populated if needed
                    contributions: 0 // Requires GraphQL API for real count
                };
            }
        }

        if (!githubData) {
            console.error("GitHub: Failed to fetch live repos and no vault token available.");
            throw new Error("AUTHENTICATION_REQUIRED: Please connect your GitHub account to ingest live signals.");
        }

        // 2. STORE IN RAW LAYER
        const { data: rawSnapshot, error: rawError } = await supabaseClient
            .from('raw_github_snapshots')
            .insert({
                user_id,
                command_id: commandId,
                raw_payload: githubData
            })
            .select()
            .single()

        if (rawError) throw rawError

        // 3. EXTRACT FACTS (v2.5 Provenance)

        // 3.1 PROCESS REPOS AS PROJECTS
        for (const repo of githubData.repos) {
            const math = calculateFinalWeight({
                type: 'GITHUB_ACTIVE_PROJECT',
                timestamp: new Date(),
                source: 'GITHUB_OFFICIAL_API',
                verificationParams: { hasUrlProof: true, hasArtifact: true, artifactType: 'CODE' },
                corroboratingSources: ['GITHUB']
            });

            const { data: evidence, error: evError } = await supabaseClient.from('evidence_ledger').insert({
                user_id,
                claim_type: 'PROJECT',
                source: 'GITHUB',
                raw_reference_id: rawSnapshot.id,
                ingestion_session_id: sessionId,
                claim_data: {
                    name: repo.name,
                    url: `https://github.com/${githubData.user}/${repo.name}`,
                    stars: repo.stars
                },
                extraction_confidence: 1.0,
                ...math
            }).select().single();

            if (evError) throw evError;

            await supabaseClient.from('career_projects').insert({
                user_id,
                evidence_id: evidence.id,
                name: repo.name,
                description: repo.description,
                technologies: [repo.language],
                url: `https://github.com/${githubData.user}/${repo.name}`,
                extraction_method: 'verified',
                confidence_level: 'high'
            });
        }

        // 3.2 PROCESS LANGUAGES AS SKILLS
        for (const [lang, ratio] of Object.entries(githubData.languages)) {
            const math = calculateFinalWeight({
                type: 'SKILL_WITH_GITHUB_PROOF',
                timestamp: new Date(),
                source: 'GITHUB_OFFICIAL_API',
                verificationParams: { hasUrlProof: true, hasArtifact: true, artifactType: 'CODE' },
                corroboratingSources: ['GITHUB']
            });

            const { data: evidence, error: evError } = await supabaseClient.from('evidence_ledger').insert({
                user_id,
                claim_type: 'SKILL',
                source: 'GITHUB',
                raw_reference_id: rawSnapshot.id,
                ingestion_session_id: sessionId,
                claim_data: { name: lang, ratio },
                extraction_confidence: 1.0,
                ...math
            }).select().single();

            if (evError) throw evError;

            await supabaseClient.from('career_skills').insert({
                user_id,
                evidence_id: evidence.id,
                name: lang,
                extraction_method: 'verified',
                confidence_level: 'high'
            });
        }

        // 3.3 PROCESS OSS CONTRIBUTIONS
        if (githubData.contributions > 0) {
            const { data: evidence, error: evError } = await supabaseClient.from('evidence_ledger').insert({
                user_id,
                claim_type: 'OUTCOME',
                source: 'GITHUB',
                raw_reference_id: rawSnapshot.id,
                ingestion_session_id: sessionId,
                claim_data: { contributions: githubData.contributions, type: "OSS_CONTRIBUTION_GRAPH" },
                source_authority: 1.0,
                extraction_confidence: 1.0,
                verification_strength: 1.0,
                final_weight: 1.0
            }).select().single();

            if (!evError) {
                await supabaseClient.from('career_oss_contributions').insert({
                    user_id,
                    evidence_ledger_id: evidence.id,
                    raw_snapshot_id: rawSnapshot.id,
                    repo_name: "GitHub Profile",
                    contribution_type: "GRAPH",
                    impact_signal: { total_contributions: githubData.contributions },
                    extraction_method: 'verified',
                    confidence_level: 'high'
                });
            }
        }

        // 4. CONVERGENCE GATE (v2.5)
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
            source: 'GITHUB_WORKER',
            message: `GitHub Signals Processed. Fact extraction converged.`,
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
