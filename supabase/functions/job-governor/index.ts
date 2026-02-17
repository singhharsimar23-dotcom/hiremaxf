import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { Guardrails } from "../_shared/guardrails.ts"

const corsHeaders = Guardrails.getCorsHeaders();

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        Guardrails.checkEnv();
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }

    const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    if (Deno.env.get('ENGINE_GLOBAL_DISABLE') === 'true') {
        return new Response(JSON.stringify({ mode: 'READ_ONLY', status: 'DISABLED' }), { status: 200, headers: corsHeaders });
    }

    try {
        const { data: state, error: stateError } = await supabaseClient.from('governor_state').select('*').single();
        if (stateError || !state) throw new Error("GOVERNOR_STATE_MISSING");

        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const { data: events } = await supabaseClient.from('discovery_events').select('success, pointers_created').gt('timestamp', twentyFourHoursAgo);

        const { count: pointersTotal } = await supabaseClient.from('job_pointers').select('*', { count: 'exact', head: true }).gt('created_at', sevenDaysAgo);
        const { count: integrityTotal } = await supabaseClient.from('integrity_events').select('*', { count: 'exact', head: true }).eq('event_type', 'ZOMBIE_POINTER_EXPIRED').gt('timestamp', sevenDaysAgo);

        const sentinelRatio = pointersTotal && pointersTotal > 0 ? (pointersTotal - (integrityTotal || 0)) / pointersTotal : 1.0;
        const sentinelCritical = sentinelRatio < 0.60;

        const { data: clusters } = await supabaseClient.from('user_clusters').select('id');
        const clusterCount = clusters?.length || 0;
        const discoveryRuns = events?.length || 0;
        const amortizationRatio = clusterCount > 0 ? discoveryRuns / clusterCount : 0;

        const amortizationCritical = clusterCount > 0 && amortizationRatio > 1.0;
        const telemetryCount = discoveryRuns;
        const successCount = events?.filter((e: any) => e.success && e.pointers_created > 0).length || 0;
        const scrapeSuccessRate = telemetryCount > 0 ? successCount / telemetryCount : 0;
        const blindnessFlag = telemetryCount === 0;

        const isStuckInSafe = state.current_mode === 'SAFE' && (Date.now() - new Date(state.last_updated_at).getTime() > 48 * 60 * 60 * 1000);

        const redConditions = [
            { name: 'BLINDNESS', val: blindnessFlag },
            { name: 'SENTINEL_CRITICAL', val: sentinelCritical },
            { name: 'AMORTIZATION_CRITICAL', val: amortizationCritical },
            { name: 'AUTO_DEGRADE', val: telemetryCount >= 3 && scrapeSuccessRate < 0.50 }
        ];

        const redCount = redConditions.filter(c => c.val).length;
        let nextMode: 'FULL' | 'CONTROLLED' | 'SAFE' | 'READ_ONLY' = 'FULL';

        if (redCount >= 3) nextMode = 'READ_ONLY';
        else if (blindnessFlag || redCount >= 1) nextMode = 'SAFE';
        else if (successCount > 0 && scrapeSuccessRate < 0.85) nextMode = 'CONTROLLED';

        if (nextMode !== state.current_mode || isStuckInSafe) {
            await supabaseClient.from('governor_state').update({
                current_mode: nextMode,
                scrape_success_rate: scrapeSuccessRate,
                last_updated_at: new Date().toISOString()
            }).eq('id', state.id);

            if (isStuckInSafe) {
                await supabaseClient.from('integrity_events').insert({
                    event_type: 'CRITICAL_STUCK_IN_SAFE',
                    severity: 'CRITICAL',
                    message: "Governor stuck in SAFE mode for > 48h."
                });
            }
        }

        return new Response(JSON.stringify({ success: true, mode: nextMode }), { status: 200, headers: corsHeaders });

    } catch (error: any) {
        return Guardrails.handleError(supabaseClient, error, "JOB_GOVERNOR");
    }
})
