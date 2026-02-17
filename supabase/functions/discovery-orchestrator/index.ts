
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { Guardrails } from "./shared/guardrails.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-scheduler',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
};

serve(async (req: Request) => {
    // 1. PERFECT CORS HANDLER
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const runId = crypto.randomUUID();
    const startedAt = new Date();

    try {
        // 2. GOVERNOR CHECK (Safety First)
        const { data: governor } = await supabase.from('governor_state').select('*').single();
        if (governor && (governor.current_mode === 'READ_ONLY' || governor.current_mode === 'SAFE')) {
            console.warn(`[ORCHESTRATOR] Run ${runId} blocked by Governor: ${governor.current_mode}`);
            return new Response(JSON.stringify({
                success: false,
                reason: "GOVERNOR_BLOCKED",
                mode: governor.current_mode
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        console.log(`[ORCHESTRATOR] Run ${runId} started - 35+ sources targeted`);

        // 3. DEFINE WORKER CLUSTERS
        const workerUrls = [
            'ats-engine-ultimate', // NEW: Rebalanced & Diversified
            'api-aggregator',
            'job-board-scraper',
            'tech-board-scraper',
            'mobile-gateway',
            'github-watcher',
            'technographic-monitor',
            'ats-scraper'
        ];

        // 4. PARALLEL TRIGGER WITH TIMEOUT PROTECTION
        const clusterResults = await Promise.allSettled(workerUrls.map(async (slug) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 120000); // 2-minute limit per cluster

            try {
                const res = await fetch(`${supabaseUrl}/functions/v1/${slug}`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                    signal: controller.signal,
                    body: JSON.stringify({ orchestrator_run_id: runId })
                });
                clearTimeout(timeoutId);

                if (!res.ok) throw new Error(`HTTP_${res.status}`);
                return { slug, data: await res.json() };
            } catch (e: any) {
                clearTimeout(timeoutId);
                console.error(`[ORCHESTRATOR] Cluster failed: ${slug}`, e.message);
                return { slug, error: e.message };
            }
        }));

        // 5. POST-INGESTION HOOKS (Clustering & Sanitization)
        console.log(`[ORCHESTRATOR] Discovery complete. Triggering clustering and execution sweep...`);
        const { data: clusteringStatus } = await supabase.functions.invoke('user-clustering', {
            body: { mode: 'incremental', run_id: runId }
        });

        // MEGA-SCALE EXECUTION SWEEP: Auto-analyze IDENTIFIED jobs
        const { data: pendingApps, error: sweepError } = await supabase
            .from('applications')
            .select('id, job_pointer_id, user_id')
            .eq('status', 'IDENTIFIED')
            .limit(500);

        if (sweepError) console.error(`[ORCHESTRATOR] Sweep Query Error:`, sweepError);

        if (pendingApps && pendingApps.length > 0) {
            console.log(`[ORCHESTRATOR] Sweeping ${pendingApps.length} pending applications for Kill Zone analysis...`);
            const results = await Promise.allSettled(pendingApps.map(app =>
                supabase.functions.invoke('execution-engine', {
                    body: { action: '/analyze-kill-zone', job_id: app.job_pointer_id, user_id: app.user_id }
                })
            ));

            const successCount = results.filter(r => r.status === 'fulfilled').length;
            console.log(`[ORCHESTRATOR] Sweep complete. Successful invocations: ${successCount}/${pendingApps.length}`);
        } else {
            console.log(`[ORCHESTRATOR] Sweep skipped: No pending 'IDENTIFIED' applications found.`);
        }

        // 6. FINAL ANALYTICS & LOGGING
        const summary = clusterResults.map((r: any) => ({
            worker: r.status === 'fulfilled' ? r.value.slug : 'unknown',
            status: r.status === 'fulfilled' && !r.value.error ? 'SUCCESS' : 'FAILED',
            error: r.status === 'fulfilled' ? r.value.error : r.reason,
            payload: r.status === 'fulfilled' ? r.value.data : null
        }));

        await supabase.from('discovery_runs').insert({
            id: runId,
            started_at: startedAt.toISOString(),
            completed_at: new Date().toISOString(),
            source: 'MASTER_ORCHESTRATOR_V2',
            jobs_found: summary.reduce((acc, s) => acc + (s.payload?.jobs_found || s.payload?.count || 0), 0),
            errors: summary.filter(s => s.status === 'FAILED')
        });

        return new Response(JSON.stringify({
            success: true,
            run_id: runId,
            duration_ms: Date.now() - startedAt.getTime(),
            clusters: summary,
            clustering: clusteringStatus
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error: any) {
        return Guardrails.handleError(supabase, error, "MASTER_ORCHESTRATOR");
    }
});
