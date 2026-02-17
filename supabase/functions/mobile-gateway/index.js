import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Guardrails } from "./shared/guardrails.ts";
import { AdzunaService } from "./adzuna.ts";
import { RemoteOKService } from "./remoteok.ts";
const corsHeaders = Guardrails.getCorsHeaders();
serve(async (req) => {
    if (req.method === 'OPTIONS')
        return new Response('ok', { headers: corsHeaders });
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    try {
        // 1. Parse Request
        const { query = "software engineer", location = "remote", source = "all", limit = 50, debug = false } = await req.json();
        console.log(`[MOBILE-GATEWAY] specific_query="${query}" location="${location}" source="${source}" debug="${debug}"`);
        // 2. Fetch Jobs
        let allJobs = [];
        const promises = [];
        if (source === 'all' || source === 'adzuna') {
            promises.push(AdzunaService.fetchJobs(query, location, limit, debug));
        }
        if (source === 'all' || source === 'remoteok') {
            promises.push(RemoteOKService.fetchJobs(query, debug));
        }
        const results = await Promise.all(promises);
        results.forEach(jobs => allJobs.push(...jobs));
        // Filter out nulls
        allJobs = allJobs.filter(j => j !== null);
        console.log(`[MOBILE-GATEWAY] Found ${allJobs.length} jobs total.`);
        if (debug) {
            return new Response(JSON.stringify({
                success: true,
                debug_mode: true,
                adzuna_keys_present: !!Deno.env.get('ADZUNA_APP_ID') && !!Deno.env.get('ADZUNA_APP_KEY'),
                jobs: allJobs
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        // 3. Deduplicate (locally)
        const uniqueJobsMap = new Map();
        for (const job of allJobs) {
            uniqueJobsMap.set(job.fingerprint, job);
        }
        const uniqueJobs = Array.from(uniqueJobsMap.values());
        // 4. Upsert
        if (uniqueJobs.length > 0) {
            const { error } = await supabaseClient
                .from('job_pointers')
                .upsert(uniqueJobs, {
                onConflict: 'fingerprint',
                ignoreDuplicates: false
            });
            if (error)
                throw error;
        }
        // 5. Return Summary
        return new Response(JSON.stringify({
            success: true,
            job_count: uniqueJobs.length,
            sources: source === 'all' ? ['adzuna', 'remoteok'] : [source]
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
    catch (error) {
        return Guardrails.handleError(supabaseClient, error, "MOBILE_GATEWAY", { payload: "Request Body" });
    }
});
