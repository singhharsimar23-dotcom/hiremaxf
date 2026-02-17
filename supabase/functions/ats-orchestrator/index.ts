import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    try {
        // Phase 4: Scale to 300 Concurrent Requests (15 Worker Groups x 20 Workers)
        const groups = Array.from({ length: 15 }, (_, i) => i + 1);

        console.log(`[ORCHESTRATOR-MAX] Triggering 15 worker groups (300 threads)...`);

        // We don't await full resolution, just trigger
        groups.map(group_id =>
            fetch(`https://ssuknybhzcuusjardsve.supabase.co/functions/v1/scanning-worker`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
                },
                body: JSON.stringify({ group_id })
            }).catch(e => console.error(`Group ${group_id} fail:`, e))
        );

        return new Response(JSON.stringify({ success: true, message: "Triggered 300 concurrent workers" }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: corsHeaders
        });
    }
});
