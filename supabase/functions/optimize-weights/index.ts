import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OutcomeMap {
    [key: string]: number;
}

const OUTCOME_SCORES: OutcomeMap = {
    'JOB_OFFER': 100,
    'INTERVIEW_INVITATION': 80,
    'SCREENING': 60,
    'REJECTION': 30, // Getting rejected implies you weren't good enough, but not zero.
    'GHOSTED': 30
};

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 1. Fetch Training Data (Predictions with Outcomes)
        // We only want recent data to avoid overfitting to old dynamics
        const { data: logs, error: logError } = await supabase
            .from('prediction_logs')
            .select(`
                id,
                predicted_score,
                weight_set_id,
                outcome_id,
                profile_outcomes!inner (
                    funnel_stage
                ),
                profile_snapshots (
                    signal_health
                )
            `)
            .not('outcome_id', 'is', null)
            .order('created_at', { ascending: false })
            .limit(100);

        if (logError) throw logError;
        if (!logs || logs.length < 5) {
            return new Response(JSON.stringify({ message: "Insufficient data for optimization", count: logs?.length || 0 }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            });
        }

        // 2. Fetch ALL Active Weight Sets (Global + Segments)
        const { data: activeSets } = await supabase
            .from('scoring_weight_sets')
            .select('*')
            .eq('status', 'ACTIVE');

        if (!activeSets || activeSets.length === 0) throw new Error("No active weight sets found");

        const results = [];

        // 3. Optimize Each Segment Independently
        for (const activeSet of activeSets) {
            const currentWeights = activeSet.weights;
            const newWeights = { ...currentWeights };
            const learningRate = 0.05;

            // Filter logs relevant to this weight set (or its lineage)
            // ideally we track lineage, but for now we look for direct usage
            // OR usage of a parent that matches the segment criteria?
            // Simplest for Phase 4: Match by weight_set_id in the log
            // But if we just deployed v2, logs from v1 are still relevant?
            // Yes, so we should filter logs by the segment criteria of the weight set?
            // OR just rely on the fact that snapshot-builder stamped the weight_set_id.
            // Problem: After a new deployment, the weight_set_id changes.
            // So we need to map `log.weight_set_id` -> `segment`.

            // Let's try this:
            // For each Active Set, we want to create a new key.
            // Use the logs that apply to it.
            // If we can't easily link logs to the active set (e.g. because ID changed), we might skip optimization for that cycle.
            // BETTER: The snapshot `meta` has `segment_logic`. We should log that to `prediction_logs`!
            // But we didn't add that column yet.

            // Workaround:
            // Process ONLY logs that match the current `activeSet.id`.
            // This means we only learn from the *current* version.
            // This is "Online Learning" - valid.
            const segmentLogs = logs.filter((l: any) => l.weight_set_id === activeSet.id);

            if (segmentLogs.length < 5) {
                results.push({ segment: activeSet.segment_criteria, status: 'insufficient_data' });
                continue;
            }

            let totalError = 0;
            const adjustments: Record<string, number> = {};

            for (const log of segmentLogs) {
                const actual = OUTCOME_SCORES[log.profile_outcomes.funnel_stage] || 0;
                const predicted = log.predicted_score;
                const error = actual - predicted;
                totalError += (error * error);

                const direction = error > 0 ? 1 : -1;
                const magnitude = Math.min(Math.abs(error) / 100, 1.0);
                const delta = direction * magnitude * learningRate;

                // Update rules
                newWeights.work_experience_weight = Math.max(1, (newWeights.work_experience_weight || 10) + delta);
                newWeights.skills_weight = Math.max(1, (newWeights.skills_weight || 10) + delta);
                newWeights.projects_weight = Math.max(0, (newWeights.projects_weight || 5) + delta);
                newWeights.education_weight = Math.max(0, (newWeights.education_weight || 5) + delta);

                adjustments['work_experience_weight'] = (adjustments['work_experience_weight'] || 0) + delta;
            }

            const mse = totalError / segmentLogs.length;

            // Safety Bounds
            const BOUNDS: any = {
                work_experience_weight: { min: 0, max: 20 },
                skills_weight: { min: 0, max: 20 },
                projects_weight: { min: 0, max: 15 },
                education_weight: { min: 0, max: 10 }
            };
            Object.keys(newWeights).forEach(key => {
                if (BOUNDS[key]) {
                    newWeights[key] = Math.max(BOUNDS[key].min, Math.min(BOUNDS[key].max, newWeights[key]));
                }
            });

            // Auto-Promotion
            const shouldPromote = true; // Aggressive mode

            if (shouldPromote) {
                await supabase.from('scoring_weight_sets').update({ status: 'ARCHIVED' }).eq('id', activeSet.id);
            }

            const { data: newSet, error: insertError } = await supabase
                .from('scoring_weight_sets')
                .insert({
                    version: activeSet.version + 1,
                    weights: newWeights,
                    status: shouldPromote ? 'ACTIVE' : 'CANDIDATE',
                    parent_weight_set_id: activeSet.id,
                    segment_criteria: activeSet.segment_criteria,
                    deployed_at: shouldPromote ? new Date().toISOString() : null
                })
                .select()
                .single();

            if (insertError) throw insertError;

            results.push({
                segment: activeSet.segment_criteria,
                mse,
                samples: segmentLogs.length,
                candidate: newSet.version,
                promoted: shouldPromote
            });
        }

        return new Response(JSON.stringify({
            success: true,
            results
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
