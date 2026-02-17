// 20260213_ingest_friction_telemetry.ts
// Receives application telemetry and computes Friction Index
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { Guardrails } from "../_shared/guardrails.ts"

const corsHeaders = Guardrails.getCorsHeaders();

console.log("Friction Telemetry Ingestion: Active")

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const payload = await req.json();
        const {
            domain,
            field_count,
            custom_question_count,
            captcha_present,
            login_required,
            time_to_fill_ms
        } = payload;

        if (!domain) throw new Error("MISSING_DOMAIN");

        // 1. Compute Friction Index (Formula from User Spec)
        // friction_index = sigmoid(α1 * log(field_count + 1) + ... )

        const ln_fields = Math.log((field_count || 0) + 1);
        const norm_time = (time_to_fill_ms || 60000) / 300000; // Normalized to 5 mins baseline

        // Weights (Heuristic)
        const w1 = 0.5; // Fields
        const w2 = 0.8; // Custom Questions
        const w3 = 0.4; // Time
        const w4 = 2.0; // CAPTCHA (High Penalty)
        const w5 = 1.5; // Login

        const raw_score =
            (w1 * ln_fields) +
            (w2 * (custom_question_count || 0)) +
            (w3 * norm_time) +
            (w4 * (captcha_present ? 1 : 0)) +
            (w5 * (login_required ? 1 : 0));

        const friction_index = 1.0 / (1.0 + Math.exp(-(raw_score - 3.0))); // Shift sigmoid center

        // 2. Log Telemetry
        await supabase.from('ml_application_friction').insert({
            domain,
            field_count,
            custom_question_count,
            captcha_present,
            login_required,
            avg_time_to_fill: (time_to_fill_ms || 0) / 1000.0,
            friction_index
        });

        return new Response(
            JSON.stringify({ success: true, friction_index }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
