import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    try {
        // 1. Fetch pending items from queue
        const { data: queueItems, error: fetchError } = await supabase
            .from('ingestion_queue')
            .select('*, company_registry_expanded(*)')
            .eq('status', 'pending')
            .limit(500);

        if (fetchError) throw fetchError;

        console.log(`[SCANNING-WORKER] Processing ${queueItems?.length || 0} items from queue`);

        const results = [];

        for (const item of queueItems || []) {
            const company = item.company_registry_expanded;
            const name = company.company_name;
            const slug = name.toLowerCase().replace(/\s+/g, '');
            let detectedProvider = 'NONE';
            let identifier = null;

            // Pattern Check List (Phase 3 Expanded)
            const patterns = [
                { provider: 'GREENHOUSE', url: `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs` },
                { provider: 'LEVER', url: `https://api.lever.co/v0/postings/${slug}?mode=json` },
                { provider: 'ASHBY', url: `https://api.ashbyhq.com/posting-api/job-board/${slug}` },
                { provider: 'WORKDAY', url: `https://${slug}.myworkdayjobs.com/` },
                { provider: 'SMARTRECRUITERS', url: `https://api.smartrecruiters.com/v1/companies/${slug}/postings` },
                { provider: 'ICIMS', url: `https://${slug}.icims.com/` },
                { provider: 'JOBVITE', url: `https://api.jobvite.com/v1/jobfeed/${slug}` },
                { provider: 'BAMBOOHR', url: `https://${slug}.bamboohr.com/jobs/` }
            ];

            // Rate limit: 200ms delay between fetches (5 req/sec)
            await new Promise(r => setTimeout(r, 200));

            for (const p of patterns) {
                try {
                    const res = await fetch(p.url, { method: 'HEAD' });
                    if (res.ok) {
                        detectedProvider = p.provider;
                        identifier = slug;
                        break;
                    }
                } catch { continue; }
            }

            // Update Registry & Queue
            await supabase.from('company_registry_expanded').update({
                ats_detected: detectedProvider,
                ats_provider: detectedProvider,
                ats_identifier: identifier,
                last_scanned_at: new Date().toISOString()
            }).eq('id', company.id);

            await supabase.from('ingestion_queue').update({
                status: 'completed',
                ats_detected: detectedProvider,
                last_attempted_at: new Date().toISOString()
            }).eq('id', item.id);

            results.push({ company: name, ats: detectedProvider });

            // TRIGGER INGESTION via ATS-ENGINE
            if (detectedProvider !== 'NONE' && identifier) {
                console.log(`[SCANNING-WORKER] Triggering ingestion for ${name} (${detectedProvider})`);
                await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ats-engine`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
                    },
                    body: JSON.stringify({
                        company_id: company.id,
                        name: name,
                        ats_provider: detectedProvider,
                        ats_identifier: identifier
                    })
                }).catch(e => console.error(`[SCANNING-WORKER] Failed to trigger ats-engine for ${name}:`, e));
            }
        }

        return new Response(JSON.stringify({ success: true, processed_count: results.length }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('[SCANNING-WORKER] FATAL:', error.message);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
