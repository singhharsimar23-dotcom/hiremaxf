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
        const TTL_DAYS = 30;
        const RETENTION_DAYS = 90;

        const jobExpiry = new Date();
        jobExpiry.setDate(jobExpiry.getDate() - TTL_DAYS);

        const telemetryExpiry = new Date();
        telemetryExpiry.setDate(telemetryExpiry.getDate() - RETENTION_DAYS);

        // 1. STALE JOB PURGE
        const { count: jobCount } = await supabaseClient
            .from('job_pointers')
            .delete({ count: 'exact' })
            .lt('last_verified_at', jobExpiry.toISOString());

        // 2. TELEMETRY RETENTION PURGE (Invariant 7)
        const { count: discCount } = await supabaseClient
            .from('discovery_events')
            .delete({ count: 'exact' })
            .lt('timestamp', telemetryExpiry.toISOString());

        const { count: integCount } = await supabaseClient
            .from('integrity_events')
            .delete({ count: 'exact' })
            .lt('timestamp', telemetryExpiry.toISOString());

        await supabaseClient.from('integrity_events').insert({
            event_type: 'STORAGE_PURGE',
            severity: 'INFO',
            message: `Cleanup Complete: Removed ${jobCount} jobs, ${discCount} disc events, ${integCount} integ events.`,
            payload: { jobCount, discCount, integCount }
        });

        return new Response(JSON.stringify({ success: true, jobCount, discCount, integCount }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
})
