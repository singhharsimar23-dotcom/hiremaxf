// 20260213_multichannel_ingestion_edge_function.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { Guardrails } from "../_shared/guardrails.ts"

const corsHeaders = Guardrails.getCorsHeaders();

console.log("Multi-Channel Ingestion Worker: Active")

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Payload: { user_id, platform, raw_data }
        const { user_id, platform, raw_data } = await req.json()

        if (!user_id || !platform || !raw_data) {
            throw new Error("MISSING_PARAMS");
        }

        // 1. Normalize Score based on Platform Logic
        // This is the "Representation Learning" preprocessing step
        let normalizedScore = 0.5; // Default

        switch (platform) {
            case 'github':
                // Logic: PRs merged + Consistency > Raw Commits
                // Example: 100 PRs merged = 1.0, 0 = 0.0
                const prs = raw_data.merged_prs || 0;
                normalizedScore = Math.min(prs / 50.0, 1.0);
                break;
            case 'kaggle':
                // Logic: Medal count or ranking
                // Example: Grandmaster = 1.0
                const rank = raw_data.rank || 'novice';
                if (rank === 'grandmaster') normalizedScore = 1.0;
                else if (rank === 'expert') normalizedScore = 0.8;
                else normalizedScore = 0.2;
                break;
            case 'leetcode':
                // Logic: Hard problems solved
                const solved = raw_data.solved_hard || 0;
                normalizedScore = Math.min(solved / 20.0, 1.0);
                break;
            default:
                normalizedScore = 0.5;
        }

        // 2. Store Raw Data & Score
        const { error } = await supabase
            .from('raw_integrations_data')
            .upsert({
                user_id,
                platform,
                raw_data,
                normalized_score: normalizedScore,
                last_updated: new Date().toISOString()
            })

        if (error) throw error;

        // 3. Trigger Re-Embedding (Ideally Async via Database Webhook, here direct)
        // We update the structured embedding by calling a future Python service or
        // for MVP, updating the SQL coherence check directly.

        // Calculate new coherence
        const { data: coherence } = await supabase.rpc('check_signal_consistency', { p_user_id: user_id });

        // Update candidate embedding metadata (simplified)
        await supabase
            .from('ml_candidate_embeddings')
            .update({ channel_coherence_score: coherence })
            .eq('user_id', user_id);

        return new Response(
            JSON.stringify({ success: true, normalized_score: normalizedScore, coherence }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
