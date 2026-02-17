import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Guardrails } from "./guardrails.ts";
import { GreenhouseScraper } from "./greenhouse.ts";
import { LeverScraper } from "./lever.ts";
import { AshbyScraper } from "./ashby.ts";
import { WorkableScraper } from "./workable.ts";
const corsHeaders = Guardrails.getCorsHeaders();
serve(async (req) => {
    if (req.method === 'OPTIONS')
        return new Response('ok', { headers: corsHeaders });
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    try {
        // 1. Parse Request
        const { company_id, name, ats_provider, ats_identifier } = await req.json();
        if (!ats_provider || !ats_identifier) {
            throw new Error("Missing ATS configuration (provider or identifier)");
        }
        console.log(`[ATS-ENGINE] Scraping ${name} via ${ats_provider} (${ats_identifier})`);
        // 2. Select Scraper
        let jobs = [];
        switch (ats_provider.toUpperCase()) {
            case 'GREENHOUSE':
                jobs = await GreenhouseScraper.scrape(ats_identifier, company_id);
                break;
            case 'LEVER':
                jobs = await LeverScraper.scrape(ats_identifier, company_id);
                break;
            case 'ASHBY':
                jobs = await AshbyScraper.scrape(ats_identifier, company_id);
                break;
            case 'WORKABLE':
                jobs = await WorkableScraper.scrape(ats_identifier, company_id);
                break;
            default:
                throw new Error(`Unsupported ATS Provider: ${ats_provider}`);
        }
        console.log(`[ATS-ENGINE] Found ${jobs.length} jobs for ${name}`);
        // 3. Storage (Upsert)
        if (jobs.length > 0) {
            // Deduplicate jobs by fingerprint to avoid "ON CONFLICT DO UPDATE command cannot affect row a second time"
            const uniqueJobsMap = new Map();
            for (const job of jobs) {
                uniqueJobsMap.set(job.fingerprint, job);
            }
            const uniqueJobs = Array.from(uniqueJobsMap.values());
            const { error } = await supabaseClient
                .from('job_pointers')
                .upsert(uniqueJobs, {
                onConflict: 'fingerprint',
                ignoreDuplicates: false
            });
            if (error)
                throw error;
        }
        // 4. Return Summary
        return new Response(JSON.stringify({
            success: true,
            company: name,
            job_count: jobs.length,
            provider: ats_provider
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
    catch (error) {
        return Guardrails.handleError(supabaseClient, error, "ATS_ENGINE", { payload: "Request Body" });
    }
});
