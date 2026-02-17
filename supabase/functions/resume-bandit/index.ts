import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { Guardrails } from "../_shared/guardrails.ts"

const corsHeaders = Guardrails.getCorsHeaders();

console.log("Resume Bandit: Production Hardened")

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { job_id, user_id } = await req.json()
        const variants = ['Standard', 'Creative', 'Minimal']

        // 1. Calculate Time-Based Epsilon Decay
        // E(t) = max(0.05, 0.2 * exp(-t/1000))
        // We count total experiments for this user/job to estimate 't'
        const { count, error } = await supabase
            .from('ml_resume_experiments')
            .select('*', { count: 'exact', head: true })
            // Global count for variants? Or per user? 
            // For bandit stability we usually care about total system knowledge (job specific)
            .eq('job_id', job_id)

        const t = count || 1;
        let epsilon = Math.max(0.05, 0.2 * Math.exp(-t / 1000));

        // 2. Fetch Beta Priors (Exploitation Logic)
        // We select the arm with the highest expectation E[X] = alpha / (alpha + beta)
        // In full Thompson Sampling we would sample from Beta, but here we do greedy on expectation
        // as requested ("Maintain Beta prior... determine best variant").

        let bestVariant = variants[0];
        let maxExpectation = -1;

        // In a real high-throughput system, these priors are cached in Redis/Edge Config.
        // Here we query DB.
        const { data: priors } = await supabase
            .from('ml_bandit_priors')
            .select('variant_id, alpha_prior, beta_prior')
            .eq('job_id', job_id)

        // Convert to map for easy lookup
        const priorMap = new Map();
        priors?.forEach(p => priorMap.set(p.variant_id, p));

        for (const v of variants) {
            const p = priorMap.get(v) || { alpha_prior: 2, beta_prior: 8 }; // Default skeptical
            const expectation = p.alpha_prior / (p.alpha_prior + p.beta_prior);
            if (expectation > maxExpectation) {
                maxExpectation = expectation;
                bestVariant = v;
            }
        }

        // 3. Decision
        let selectedVariant = bestVariant;
        let isExploration = false;

        if (Math.random() < epsilon) {
            isExploration = true;
            const idx = Math.floor(Math.random() * variants.length);
            selectedVariant = variants[idx];
        }

        // 4. Log Propensity (for IPW Offline Eval)
        // P(select) = P(explore)*P(random=v) + P(exploit)*I(v=best)
        const probExplore = epsilon / variants.length;
        let propensity = probExplore;
        if (selectedVariant === bestVariant) {
            propensity += (1 - epsilon);
        }

        if (job_id && user_id) {
            await supabase.from('ml_resume_experiments').insert({
                user_id,
                job_id,
                variant_id: selectedVariant,
                propensity_score: propensity,
                epsilon: epsilon,
                outcome_status: 'PENDING'
            });
        }

        return new Response(
            JSON.stringify({
                variant: selectedVariant,
                propensity,
                is_exploration: isExploration,
                debug: { epsilon, t, best_variant: bestVariant }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
