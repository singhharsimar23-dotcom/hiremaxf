import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
// --- CORS HEADERS ---
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};
// --- MAIN HANDLER ---
serve(async (req) => {
    if (req.method === 'OPTIONS')
        return new Response('ok', { headers: corsHeaders });
    const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    const runId = crypto.randomUUID();
    console.log(`[EXPIRE_OLD_JOBS] Run ${runId} started`);
    try {
        const expiryDays = 30; // Jobs older than 30 days are marked expired
        const expiryDate = new Date(Date.now() - expiryDays * 24 * 60 * 60 * 1000);
        // Find and mark expired jobs
        const { data: expiredJobs, error } = await supabase
            .from('job_pointers')
            .update({
            validation_status: 'EXPIRED',
            updated_at: new Date().toISOString()
        })
            .lt('first_seen_at', expiryDate.toISOString())
            .eq('validation_status', 'VERIFIED')
            .select('id');
        if (error)
            throw error;
        const expiredCount = expiredJobs?.length || 0;
        console.log(`[EXPIRE_OLD_JOBS] Marked ${expiredCount} jobs as expired`);
        // Log run
        await supabase.from('discovery_runs').insert({
            id: runId,
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
            source: 'EXPIRE_OLD_JOBS',
            jobs_found: 0,
            jobs_new: 0,
            jobs_updated: expiredCount,
            errors: null
        });
        return new Response(JSON.stringify({
            success: true,
            run_id: runId,
            expired_count: expiredCount
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    catch (error) {
        console.error('[EXPIRE_OLD_JOBS] Fatal error:', error.message);
        return new Response(JSON.stringify({
            success: false,
            error: error.message,
            run_id: runId
        }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
});
