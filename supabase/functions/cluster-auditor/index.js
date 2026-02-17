import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    try {
        console.log("[CLUSTER_AUDITOR] Auditing user clusters...");
        // 1. GET CLUSTER RECAP
        const { data: clusters, error: cError } = await supabaseClient
            .from('user_clusters')
            .select('id, name, user_count, last_rebalanced_at');
        if (cError)
            throw cError;
        // 2. IDENTIFY ANOMALIES
        // Anomaly: Cluster with < 2 members (No amortization benefit)
        // Anomaly: Cluster not rebalanced in > 7 days
        const fragmented = clusters.filter(c => (c.user_count || 0) < 2);
        const stale = clusters.filter(c => {
            const last = new Date(c.last_rebalanced_at).getTime();
            return (Date.now() - last) > (7 * 24 * 60 * 60 * 1000);
        });
        const healthScore = clusters.length ? (1 - (fragmented.length / clusters.length)) : 1;
        console.log(`[CLUSTER_AUDITOR] Health: ${healthScore} | Fragmented: ${fragmented.length}`);
        // 3. LOG INTEGRITY EVENT
        await supabaseClient.from('integrity_events').insert({
            event_type: 'CLUSTER_AUDIT',
            severity: healthScore < 0.7 ? 'WARNING' : 'INFO',
            message: `Cluster Health: ${healthScore.toFixed(2)}. Fragmented: ${fragmented.length}. Stale: ${stale.length}.`,
            payload: { health_score: healthScore, fragmented_ids: fragmented.map(f => f.id) }
        });
        return new Response(JSON.stringify({
            success: true,
            health_score: healthScore,
            fragmented_count: fragmented.length,
            stale_count: stale.length
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }
    catch (error) {
        console.error(`[CLUSTER_AUDITOR_ERROR]:`, error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
