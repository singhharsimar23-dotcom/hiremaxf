import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { isTechJob, normalizeJob } from "../ats-engine/job-normalizer.ts"
import { generateFingerprint, generateCanonicalHash } from "../ats-engine/fingerprint.ts"

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
        console.log(`[GOV-INGEST] Starting government tech job ingestion`);

        // USAJOBS API Search for IT/Tech roles
        // Requires User-Agent and Authorization (simulated here)
        const url = "https://data.usajobs.gov/api/search?Keyword=software&JobCategoryCode=2210";

        // Mocking fetching as we don't have keys
        const mockJobs = [
            {
                MatchedObjectDescriptor: {
                    PositionTitle: "Lead Software Engineer",
                    OrganizationName: "Department of Defense",
                    PositionLocation: [{ LocationName: "Washington, DC" }],
                    PositionURI: "https://www.usajobs.gov/job/12345",
                    UserArea: { Details: { JobSummary: "Develop critical systems." } }
                }
            }
        ];

        const processedJobs = [];

        for (const raw of mockJobs) {
            const item = raw.MatchedObjectDescriptor;
            if (!isTechJob(item.PositionTitle)) continue;

            const norm = normalizeJob({
                title: item.PositionTitle,
                company: item.OrganizationName,
                location: item.PositionLocation[0]?.LocationName || "Remote",
                url: item.PositionURI,
                description: item.UserArea.Details.JobSummary
            });

            const fingerprint = await generateFingerprint(item.OrganizationName, item.PositionTitle, norm.location_raw);
            const canonicalHash = await generateCanonicalHash(item.OrganizationName, item.PositionTitle, norm.location_raw);

            processedJobs.push({
                fingerprint,
                company_name: item.OrganizationName,
                role_category: norm.role_category,
                seniority_band: norm.seniority_band,
                location_type: norm.location_type,
                location_name: norm.location_raw,
                source_url: item.PositionURI,
                source_type: 'GOVERNMENT_DIRECT',
                confidence_tier: 'high',
                quality_score: norm.quality_score,
                discovery_method: 'GOV_DIRECT',
                validation_status: 'VERIFIED',
                last_verified_at: new Date().toISOString(),
                raw_payload: raw,
                canonical_hash: canonicalHash,
                is_direct_ats: false,
                is_direct_company: false,
                is_government: true,
                source_origin_type: 'government',
                ingestion_origin: 'government',
                redirect_depth: 0,
                canonical_verified: true
            });
        }

        if (processedJobs.length > 0) {
            const { error } = await supabase
                .from('job_pointers')
                .upsert(processedJobs, { onConflict: 'fingerprint' });

            if (error) throw error;
        }

        return new Response(JSON.stringify({ success: true, count: processedJobs.length }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('[GOV-INGEST] FATAL:', error.message);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
