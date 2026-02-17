// 20260213_simulation_engine.ts
// Batch Monte Carlo Simulation for Career Trajectories
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { Guardrails } from "../_shared/guardrails.ts"

const corsHeaders = Guardrails.getCorsHeaders();

console.log("Simulation Engine: Active")

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Fetch Candidates Needing Simulation (e.g. updated recently)
        // FIREWALL: Only read computed state
        const { data: candidates } = await supabase
            .from('ml_talent_state')
            .select('candidate_id, capability_index, market_position_index')
            .order('state_computed_at', { ascending: false })
            .limit(10); // Batch size

        if (!candidates || candidates.length === 0) {
            return new Response(JSON.stringify({ msg: "No candidates to simulate" }), { headers: corsHeaders })
        }

        const results = [];

        // 2. Run Simulation Per Candidate
        for (const cand of candidates) {
            // [BEHAVIORAL INTELLIGENCE]
            // Mock fetching signals (In prod, would query ml_application_friction etc.)
            const friction_index = 0.2; // Low friction
            const attention_likelihood = 0.8; // High attention
            const saturation_index = 0.4; // Moderate saturation

            // Mock Monte Carlo: Propose 3 strategies
            const strategies = [
                { action: 'Target Series B', prob_lift: 0.12, optionality_lift: 0.05 },
                { action: 'Learn Rust', prob_lift: 0.08, optionality_lift: 0.15 },
                { action: 'Contribute to OSS', prob_lift: 0.05, optionality_lift: 0.02 }
            ];

            // Apply Friction & Attention Penalties to Strategies
            if (friction_index > 0.7) {
                strategies.push({ action: 'Avoid High Friction Sites', prob_lift: 0.05, optionality_lift: 0.0 });
            }

            if (attention_likelihood > 0.6) {
                strategies.forEach(s => s.prob_lift += 0.02); // Timing Boost
            }

            if (saturation_index > 0.8) {
                strategies.forEach(s => s.prob_lift -= 0.05); // Saturation Penalty
            }

            // Store Result
            const bestStrategy = strategies.sort((a, b) => b.prob_lift - a.prob_lift)[0];

            await supabase
                .from('ml_simulation_results')
                .upsert({
                    candidate_id: cand.candidate_id,
                    strategy_vector: strategies,
                    projected_offer_probability: 0.5 + (cand.capability_index * 0.4), // Base + Skill
                    projected_optionality_gain: bestStrategy.optionality_lift,
                    simulation_timestamp: new Date().toISOString()
                });

            results.push({ id: cand.candidate_id, best: bestStrategy });
        }

        return new Response(
            JSON.stringify({ success: true, simulated: results.length }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
