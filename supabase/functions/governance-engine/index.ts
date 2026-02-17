// 20260213_governance_engine.ts
// Weekly Governance Job: Drift, Calibration, and Anomaly Detection
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { Guardrails } from "../_shared/guardrails.ts"

const corsHeaders = Guardrails.getCorsHeaders();

console.log("Governance Engine: Active")

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Calibration Audit (ECE)
        // Compare mean predicted probability vs actual hiring rate per bin
        const { data: logs } = await supabase
            .from('ml_inference_logs')
            .select('predicted_score, actual_outcome')
            .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()); // Last 7 days

        let ece = 0.05; // Placeholder for actual binning logic
        // Implementation note: In production, we'd bin 1000s of logs here

        // 2. Embedding Geometry Audit
        // Check if cosine distance distribution is collapsing
        const { data: sample_embeds } = await supabase
            .from('ml_candidate_embeddings')
            .select('embedding')
            .limit(100);

        // Mock Norm Variance Check
        const normVariance = 0.02; // < 0.1 is good

        // 3. Forecast Accuracy Audit (Backtest)
        // Check if 6m old forecasts match today's demand
        const { data: oldForecasts } = await supabase
            .from('ml_skill_demand_forecast')
            .select('*')
            .lt('forecast_timestamp', new Date(Date.now() - 180 * 86400000).toISOString())
            .limit(10);

        // Mock Error Calc
        const forecastError = 0.12;

        // 4. Strict Calibration Check (Statistical)
        // Target Bucket: 0.65 - 0.75 (Midpoint 0.7)
        // In production, count actual interviews in this bucket
        // Mock Data for now
        const n = 100;
        const observed_success = 60; // 0.6 rate
        const observed_rate = observed_success / n;
        const expected_rate = 0.7;

        // Z-Test
        const std_error = Math.sqrt((expected_rate * (1 - expected_rate)) / n);
        const z_score = Math.abs(observed_rate - expected_rate) / std_error;

        // 2-Sigma Rule
        const calibration_drift = z_score > 2.0;

        // 5. Governance Decision
        const alerts = [];
        if (ece > 0.1) alerts.push("High Calibration Error");
        if (normVariance > 0.1) alerts.push("Embedding Collapse");
        if (forecastError > 0.25) alerts.push("Forecast Drift");
        if (calibration_drift) alerts.push(`Calibration Drift Detected (Z=${z_score.toFixed(2)})`);

        const status = alerts.length > 0 ? 'NEEDS_REVIEW' : 'HEALTHY';

        // Log the Governance Run
        // Ideally stored in a specialized table, for now we just return report

        return new Response(
            JSON.stringify({
                success: true,
                status,
                metrics: { ece, normVariance, forecastError },
                alerts
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
