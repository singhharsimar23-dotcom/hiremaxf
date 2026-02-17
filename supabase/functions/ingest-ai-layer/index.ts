// 20260213_ingest_ai_layer.ts
// Async background job to process raw skills and update Talent State
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { Guardrails } from "../_shared/guardrails.ts"

const corsHeaders = Guardrails.getCorsHeaders();

console.log("AI Intelligence Ingestion Layer: Active")

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { user_id, raw_skills, profile_context } = await req.json()

        if (!user_id) throw new Error("MISSING_USER_ID");

        // 1. Process Skills (Mocking NLP Extraction for now)
        // Real logic would call an LLM here to canonicalize skills
        const extractedSkills = raw_skills || [
            { name: 'Rust', depth: 0.8, source: 'GitHub', verified: true },
            { name: 'PostgreSQL', depth: 0.6, source: 'Resume', verified: false }
        ];

        const alerts = [];

        // 2. Update Skill Graph (Batch Upsert)
        for (const skill of extractedSkills) {
            // Find Canonical ID (Simplistic lookup)
            const { data: skillReg } = await supabase
                .from('ml_skill_registry')
                .select('skill_id')
                .eq('canonical_name', skill.name)
                .single();

            // If new skill, Auto-Register (Ontology Expansion)
            let finalSkillId = skillReg?.skill_id;
            if (!finalSkillId) {
                const { data: newSkill } = await supabase
                    .from('ml_skill_registry')
                    .insert({ canonical_name: skill.name, skill_category: 'Detected' })
                    .select()
                    .single();

                if (!newSkill) {
                    // Fallback or skip
                    console.error(`Failed to register skill: ${skill.name}`);
                    continue;
                }
                finalSkillId = newSkill.skill_id;
            }

            // Upsert Graph Edge
            await supabase
                .from('ml_skill_graph')
                .upsert({
                    candidate_id: user_id,
                    skill_id: finalSkillId,
                    depth_score: skill.depth,
                    evidence_source: skill.source,
                    cross_platform_validation_score: skill.verified ? 0.9 : 0.4
                }, { onConflict: 'candidate_id, skill_id, evidence_source' });
        }

        // 3. Compute Credibility Vector (Heuristic)
        // Check if high-depth skills have weak evidence
        const highClaimLowProof = extractedSkills.filter(s => s.depth > 0.8 && !s.verified).length;
        let credibility = 1.0;
        if (highClaimLowProof > 2) credibility = 0.4; // Penalty

        await supabase.from('ml_credibility_vector').upsert({
            candidate_id: user_id,
            timeline_consistency: credibility, // Simplification
            last_updated: new Date().toISOString()
        });

        // 4. Update Derived Talent State (STRICT AUTHORITY)
        // We invoke the deterministic computation function.
        const { error: stateError } = await supabase.rpc('compute_talent_state', {
            p_user_id: user_id
        });

        if (stateError) throw new Error(`Talent State Computation Failed: ${stateError.message}`);

        return new Response(
            JSON.stringify({ success: true, credibility, skills_processed: extractedSkills.length }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
