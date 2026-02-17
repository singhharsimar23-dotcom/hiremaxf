import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { getSkillLevel } from "../_shared/signal-math.ts";
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }
    try {
        const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
        // 1. IDENTITY VERIFICATION (SEC-003)
        const authHeader = req.headers.get('Authorization');
        if (!authHeader)
            throw new Error("Missing Authorization header");
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''));
        if (authError || !user)
            throw new Error("Invalid or expired session");
        const { user_id: body_user_id, session_id } = await req.json();
        const user_id = user.id;
        if (body_user_id && body_user_id !== user_id) {
            console.warn(`[SECURITY] User ${user_id} attempted to rebuild snapshot for ${body_user_id}`);
            throw new Error("Identity mismatch detected - Rebuild aborted");
        }
        // 2. CONVERGENCE GATE (v2.5)
        if (session_id) {
            const { data: sessionData, error: sessionError } = await supabaseClient
                .from('ingestion_sessions')
                .select('state')
                .eq('id', session_id)
                .single();
            if (sessionError || !sessionData) {
                console.warn(`Snapshot Builder: Ingestion session ${session_id} not found. Proceeding with caution.`);
            }
            else if (sessionData.state !== 'converged') {
                console.log(`Snapshot Builder: Session ${session_id} is in state '${sessionData.state}'. Aborting build to prevent phantom state.`);
                return new Response(JSON.stringify({ success: false, reason: 'unconverged_session' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 202,
                });
            }
        }
        console.log(`Snapshot Builder: Starting atomic rebuild for ${user_id}`);
        // 3. FETCH CAREER DOMAIN DATA (THE CANONICAL TRUTH)
        const [{ data: work }, { data: projects }, { data: skills }, { data: edu }, { data: achievements }, { data: pubs }, { data: oss }, { data: profile }] = await Promise.all([
            supabaseClient.from('career_work_history').select('*').eq('user_id', user_id).order('start_date', { ascending: false }),
            supabaseClient.from('career_projects').select('*').eq('user_id', user_id),
            supabaseClient.from('career_skills').select('*').eq('user_id', user_id),
            supabaseClient.from('career_education').select('*').eq('user_id', user_id),
            supabaseClient.from('career_achievements').select('*').eq('user_id', user_id),
            supabaseClient.from('career_publications').select('*').eq('user_id', user_id),
            supabaseClient.from('career_oss_contributions').select('*').eq('user_id', user_id),
            supabaseClient.from('profiles').select('target_role').eq('id', user_id).single()
        ]);
        // 4. FETCH EVIDENCE LEDGER (THE MATHEMATICAL SIGNAL)
        const { data: evidence } = await supabaseClient
            .from('evidence_ledger')
            .select('*')
            .eq('user_id', user_id);
        const signals = evidence || [];
        const coverage = {
            linkedin: signals.some(s => s.source === 'LINKEDIN'),
            github: signals.some(s => s.source === 'GITHUB'),
            gmail: signals.some(s => s.source === 'GMAIL'),
            external: signals.some(s => s.source === 'EXTERNAL')
        };
        // 5. ATOMIC RECONSTRUCTION (FORENSICS MODE)
        const snapshot_data = {
            work_history: (work || []).map(w => ({
                ...w,
                proof: signals.filter(s => s.id === w.evidence_ledger_id)
            })),
            projects: (projects || []).map(p => ({
                ...p,
                proof: signals.filter(s => s.id === p.evidence_ledger_id)
            })),
            skills: (skills || []).map(sk => {
                const signal = signals.find(s => s.id === sk.evidence_ledger_id);
                const score = signal?.final_weight || 0.5;
                return {
                    ...sk,
                    proficiency: { score, level: getSkillLevel(score) },
                    proof_signals: signals.filter(s => s.claim_data?.name === sk.name)
                };
            }),
            education: edu || [],
            achievements: achievements || [],
            publications: pubs || [],
            oss_activity: oss || [],
            target_role: profile?.target_role || null
        };
        // 5.4 DETERMINE SEGMENT
        // Simple heuristic to map target_role to a category
        const role = (snapshot_data.target_role || '').toLowerCase();
        let roleCategory = 'global';
        if (role.includes('engineer') || role.includes('developer') || role.includes('programmer') || role.includes('data')) {
            roleCategory = 'engineering';
        }
        else if (role.includes('sales') || role.includes('account') || role.includes('business dev')) {
            roleCategory = 'sales';
        }
        // 5.5 FETCH ACTIVE SCORING WEIGHTS (INTELLIGENCE ENGINE)
        // Try specific segment first, then fallback to global (criteria is null or empty)
        const { data: weightSets } = await supabaseClient
            .from('scoring_weight_sets')
            .select('id, weights, segment_criteria, version')
            .eq('status', 'ACTIVE')
            .order('deployed_at', { ascending: false });
        let weightSet = weightSets?.find((ws) => ws.segment_criteria?.role_category === roleCategory);
        // Fallback to global if no specific segment found
        if (!weightSet) {
            weightSet = weightSets?.find((ws) => !ws.segment_criteria || Object.keys(ws.segment_criteria).length === 0);
        }
        const weights = weightSet?.weights || {
            work_experience_weight: 10,
            skills_weight: 10,
            education_weight: 5,
            projects_weight: 5,
            verified_multiplier: 1.25,
            recency_decay_factor: 0.9
        };
        // 6. SIGNAL HEALTH & MATH (v2.5 Provenance-Filtered)
        let completeness = 0;
        if (work?.length)
            completeness += (weights.work_experience_weight || 10);
        if (edu?.length)
            completeness += (weights.education_weight || 5);
        if (skills?.length && skills.length >= 5)
            completeness += (weights.skills_weight || 10);
        if (projects?.length)
            completeness += (weights.projects_weight || 5);
        // V2.5 Hardening: Verified count ONLY includes 'verified' extraction method
        const verifiedSignals = signals.filter(s => s.verification_strength > 0.85);
        const verifiedCount = verifiedSignals.length;
        const verificationRate = signals.length > 0 ? (verifiedCount / signals.length) * 25 : 0;
        const avgWeight = signals.length > 0 ? (signals.reduce((acc, s) => acc + s.final_weight, 0) / signals.length) : 0;
        const qualityScore = avgWeight * 25;
        const lastSig = signals.sort((a, b) => new Date(b.ingested_at).getTime() - new Date(a.ingested_at).getTime())[0];
        const daysSinceUpdate = lastSig ? (Date.now() - new Date(lastSig.ingested_at).getTime()) / (1000 * 3600 * 24) : 99;
        const recencyScore = Math.max(20 - (daysSinceUpdate / 30), 0);
        const totalScore = Math.round(completeness + verificationRate + qualityScore + recencyScore);
        // 6.5 RECOMMENDATIONS (v2.5)
        const recommendations = [];
        if (!coverage.github) {
            recommendations.push({
                title: "Connect GitHub",
                impact: 50,
                timeEstimate: "2 min",
                action: "Connect Now"
            });
        }
        if (!coverage.linkedin) {
            recommendations.push({
                title: "Connect LinkedIn",
                impact: 40,
                timeEstimate: "1 min",
                action: "Connect Now"
            });
        }
        if (signals.length < 5) {
            recommendations.push({
                title: "Increase Evidence Density",
                impact: 20,
                timeEstimate: "5 min",
                action: "Upload Artifacts"
            });
        }
        // Add recommendations to snapshot_data
        snapshot_data.recommendations = recommendations;
        // 7. VERSIONED PERSISTENCE
        const { data: lastSnapshot } = await supabaseClient.from('profile_snapshots').select('version').eq('user_id', user_id).order('version', { ascending: false }).limit(1).maybeSingle();
        const newVersion = (lastSnapshot?.version || 0) + 1;
        const { data: snapshot, error: snapError } = await supabaseClient.from('profile_snapshots').insert({
            user_id,
            version: newVersion,
            verification_state: (totalScore > 75 && coverage.linkedin) ? 'VERIFIED' : 'PROVISIONAL',
            evidence_coverage_percentage: Math.min(100, Math.round((signals.length / 20) * 100)),
            coverage_by_source: coverage,
            signal_health: {
                overall_score: totalScore,
                component_scores: {
                    completeness,
                    verification: Math.round(verificationRate),
                    quality: Math.round(qualityScore),
                    recency: Math.round(recencyScore)
                },
                identity_forensics: {
                    total_verified_claims: verifiedCount,
                    total_raw_nodes: signals.length,
                    evidence_density: totalScore // Reflecting the new UX term
                }
            },
            snapshot_data: {
                ...snapshot_data,
                meta: {
                    generated_by: 'snapshot-builder',
                    weight_set_id: weightSet?.id || null,
                    scoring_version: weightSet ? 'v' + weightSet.id.substring(0, 8) : 'static'
                }
            }
        }).select().single();
        if (snapError)
            throw snapError;
        await supabaseClient.from('profile_strength_history').insert({
            user_id,
            total_score: totalScore,
            snapshot_version: newVersion,
            quality_score: Math.round(qualityScore)
        });
        // 8. LOG INTEGRITY
        await supabaseClient.from('integrity_events').insert({
            user_id,
            event_type: 'SYSTEM',
            source: 'SNAPSHOT_BUILDER',
            message: `Forensics Engine: Rebuilt Human-Readable Identity v${newVersion}. Strength: ${totalScore}`,
            metadata: { snapshot_id: snapshot.id, session_id }
        });
        return new Response(JSON.stringify({ success: true, snapshot }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }
    catch (error) {
        console.error(`Snapshot Builder Error:`, error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
