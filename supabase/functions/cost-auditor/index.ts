import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

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

    try {
        console.log("[AUDITOR] Starting observability audit...");

        // 1. CALCULATE DISCOVERY HIT RATE
        // Count pointers vs intent intents (materialization requests)
        const { count: totalPointers } = await supabaseClient
            .from('job_pointers')
            .select('*', { count: 'exact', head: true });

        // Simulated: In production, query a 'job_materializations' or logs table
        const intentCount = 12;
        const hitRate = totalPointers ? (intentCount / (totalPointers || 1)) : 0;

        // 2. AUDIT COST VELOCITY
        // Scrapes per User
        const { count: userCount } = await supabaseClient
            .from('profiles') // Assuming profiles table exists
            .select('*', { count: 'exact', head: true });

        const { data: governor } = await supabaseClient
            .from('governor_state')
            .select('daily_scrape_count')
            .single();

        const costPerUser = userCount ? (governor.daily_scrape_count / userCount) : 0;

        // 3. LOG TELEMETRY
        console.log(`[AUDITOR] Hit Rate: ${hitRate.toFixed(4)} | Cost/User: ${costPerUser.toFixed(4)}`);

        await supabaseClient.from('integrity_events').insert({
            event_type: 'METRIC_AUDIT',
            severity: 'INFO',
            message: `Snapshot: HitRate=${hitRate.toFixed(4)}, CostPerUser=${costPerUser.toFixed(4)}`,
            payload: { hit_rate: hitRate, cost_per_user: costPerUser, user_count: userCount }
        });

        return new Response(JSON.stringify({
            success: true,
            metrics: { hit_rate: hitRate, cost_per_user: costPerUser }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        console.error(`[AUDITOR_ERROR]:`, error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
})
