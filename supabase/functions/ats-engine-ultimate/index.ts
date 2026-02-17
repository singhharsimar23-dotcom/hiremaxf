
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

// --- TYPES ---
export interface JobPointer {
    id?: string;
    fingerprint: string;
    company_name: string;
    company_id?: string;
    title?: string;
    role_category?: string; // Legacy support
    location_name?: string;
    location_type: string;
    source_url: string;
    source_type: string;
    ats_provider?: string;
    external_id?: string;
    is_direct_ats: boolean;
    confidence_tier: 'low' | 'medium' | 'high';
    quality_score: number;
    discovery_method: 'API' | 'SCRAPE' | 'RSS';
    last_verified_at: string;
    last_checked_at?: string;
    salary_raw?: string;
    canonical_hash?: string;
    state_code?: string;
    description?: string; // Transitional for enrichment
}

// --- CONNECTORS ---

class ReedConnector {
    static async fetchJobs(identifier: string, apiKey: string): Promise<JobPointer[]> {
        if (!apiKey) return [];
        const parts = identifier.split(':');
        const keywords = parts[0] || 'developer';
        const location = parts[1] || '';
        const allJobs: JobPointer[] = [];

        for (let page = 1; page <= 5; page++) {
            const url = `https://www.reed.co.uk/api/1.0/search?keywords=${encodeURIComponent(keywords)}${location ? `&locationName=${encodeURIComponent(location)}` : ''}&resultsToTake=100&resultsToSkip=${(page - 1) * 100}`;
            try {
                const res = await fetch(url, { headers: { 'Authorization': 'Basic ' + btoa(apiKey + ':') } });
                if (!res.ok) break;
                const data = await res.json();
                const jobs = (data.results || []).map((item: any) => ({
                    fingerprint: `reed-${item.jobId}`,
                    company_name: item.employerName,
                    role_category: 'engineering',
                    seniority_band: 'mid',
                    location_type: 'onsite',
                    location_name: item.locationName,
                    source_url: item.jobUrl,
                    source_type: 'REED_API',
                    ats_provider: 'reed',
                    external_id: item.jobId.toString(),
                    is_direct_ats: false,
                    confidence_tier: 'medium',
                    quality_score: 0.85,
                    discovery_method: 'API',
                    last_verified_at: new Date().toISOString()
                }));
                allJobs.push(...jobs);
                if (jobs.length < 100) break;
            } catch { break; }
        }
        return allJobs;
    }
}

class AdzunaConnector {
    static async fetchJobs(identifier: string, appId: string, appKey: string): Promise<JobPointer[]> {
        if (!appId || !appKey) return [];
        const parts = identifier.split(':');
        const country = parts[0] || 'gb';
        const keywords = parts[1] || 'developer';
        const allJobs: JobPointer[] = [];

        for (let page = 1; page <= 10; page++) {
            const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}?app_id=${appId}&app_key=${appKey}&what=${encodeURIComponent(keywords)}&content-type=application/json&results_per_page=50`;
            try {
                const res = await fetch(url);
                if (!res.ok) break;
                const data = await res.json();
                const jobs = (data.results || []).map((item: any) => ({
                    fingerprint: `adzuna-${item.id}`,
                    company_name: item.company?.display_name || "Unknown",
                    role_category: 'engineering',
                    seniority_band: 'mid',
                    location_type: 'onsite',
                    location_name: item.location?.display_name || "Unknown",
                    source_url: item.redirect_url,
                    source_type: 'ADZUNA_API',
                    ats_provider: 'adzuna',
                    external_id: item.id.toString(),
                    is_direct_ats: false,
                    confidence_tier: 'low',
                    quality_score: 0.7,
                    discovery_method: 'API',
                    last_verified_at: new Date().toISOString()
                }));
                allJobs.push(...jobs);
                if (jobs.length < 50) break;
            } catch { break; }
        }
        return allJobs;
    }
}

class UsajobsConnector {
    static async fetchJobs(keyword: string, apiKey: string): Promise<JobPointer[]> {
        if (!apiKey) return [];
        const url = `https://data.usajobs.gov/api/search?Keyword=${encodeURIComponent(keyword)}&ResultLimit=500`;
        try {
            const res = await fetch(url, { headers: { "User-Agent": "hprad@hiremax.com", "Authorization-Key": apiKey } });
            if (!res.ok) return [];
            const data = await res.json();
            return (data.SearchResult?.SearchResultItems || []).map((item: any) => ({
                fingerprint: `usajobs-${item.MatchedObjectId}`,
                company_name: item.MatchedObjectDescriptor.OrganizationName,
                role_category: 'government_tech',
                seniority_band: 'mid',
                location_type: 'onsite',
                location_name: item.MatchedObjectDescriptor.PositionLocation[0]?.LocationName,
                source_url: item.MatchedObjectDescriptor.PositionURI,
                source_type: 'USAJOBS_API',
                ats_provider: 'usajobs',
                external_id: item.MatchedObjectId,
                is_direct_ats: false,
                confidence_tier: 'high',
                quality_score: 1.0,
                discovery_method: 'API',
                last_verified_at: new Date().toISOString()
            }));
        } catch { return []; }
    }
}

class JoobleConnector {
    static async fetchJobs(keyword: string, location: string, apiKey: string): Promise<JobPointer[]> {
        if (!apiKey) return [];
        const allJobs: JobPointer[] = [];
        const url = `https://jooble.org/api/${apiKey}`;

        for (let page = 1; page <= 5; page++) {
            const body = JSON.stringify({
                keywords: keyword,
                location: location,
                page: page,
                ResultOnPage: 100
            });
            try {
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: body
                });
                if (!res.ok) break;
                const data = await res.json();
                const jobs = (data.jobs || []).map((item: any) => ({
                    fingerprint: `jooble-${item.id}`,
                    company_name: item.company || "Unknown",
                    role_category: item.title || 'software', // Store real title in role_category for now
                    seniority_band: 'mid',
                    location_type: item.location?.toLowerCase().includes('remote') ? 'remote' : 'onsite',
                    location_name: item.location || "US",
                    source_url: item.link,
                    source_type: 'JOOBLE_API',
                    ats_provider: 'jooble',
                    external_id: item.id.toString(),
                    is_direct_ats: false,
                    confidence_tier: 'medium',
                    quality_score: 0.8,
                    discovery_method: 'API',
                    last_verified_at: new Date().toISOString(),
                    last_checked_at: new Date().toISOString(),
                    title: item.title,
                    salary_raw: item.salary,
                    state_code: (item.location || "").match(/,\s*([A-Z]{2})(?:\s|$)/)?.[1],
                    description: item.snippet // Snippet for initial enrichment
                }));
                allJobs.push(...jobs);
                if (jobs.length < 100) break; // No more jobs on next page
            } catch { break; }
        }
        return allJobs;
    }
}

class CareerjetConnector {
    static async fetchJobs(keywords: string, location: string, apiKey: string): Promise<JobPointer[]> {
        // Careerjet requires affid and user_ip/user_agent always
        const url = `http://public.api.careerjet.net/search?keywords=${encodeURIComponent(keywords)}&location=${encodeURIComponent(location)}&affid=${apiKey || 'c6b8c9d0d1e2f3a4'}&user_ip=1.1.1.1&user_agent=Mozilla/5.0&locale_code=en_US`;
        try {
            const res = await fetch(url);
            if (!res.ok) {
                console.error(`[CAREERJET] HTTP Error: ${res.status}`);
                return [];
            }
            const data = await res.json();
            if (data.type === 'error' || data.error) {
                console.error(`[CAREERJET] API Error: ${data.error || 'Empty response'}`);
                return [];
            }
            const jobs = data.jobs || [];
            return jobs.map((item: any) => ({
                fingerprint: `cjet-${item.url?.split('/').pop() || crypto.randomUUID().slice(0, 8)}`,
                company_name: item.company || "Unknown",
                role_category: 'engineering',
                seniority_band: 'mid',
                location_type: 'onsite',
                location_name: item.location || "US",
                source_url: item.url,
                source_type: 'CAREERJET_API',
                ats_provider: 'careerjet',
                is_direct_ats: false,
                confidence_tier: 'low',
                quality_score: 0.6,
                discovery_method: 'API',
                last_verified_at: new Date().toISOString()
            }));
        } catch (e) {
            console.error(`[CAREERJET] Fetch fail: ${e.message}`);
            return [];
        }
    }
}

class FindworkConnector {
    static async fetchJobs(token: string): Promise<JobPointer[]> {
        if (!token) return [];
        const allJobs: JobPointer[] = [];
        let url: string | null = `https://findwork.dev/api/jobs/`;

        try {
            for (let i = 0; i < 3; i++) { // Fetch up to 3 pages
                if (!url) break;
                const res = await fetch(url, { headers: { 'Authorization': `Token ${token}` } });
                if (!res.ok) break;
                const data = await res.json();
                const jobs = (data.results || []).map((item: any) => ({
                    fingerprint: `findwork-${item.id}`,
                    company_name: item.company_name,
                    role_category: 'engineering',
                    seniority_band: 'mid',
                    location_type: item.remote ? 'remote' : 'onsite',
                    location_name: item.location || "Remote",
                    source_url: item.url,
                    source_type: 'FINDWORK_API',
                    ats_provider: 'findwork',
                    external_id: item.id.toString(),
                    is_direct_ats: false,
                    confidence_tier: 'high',
                    quality_score: 0.9,
                    discovery_method: 'API',
                    last_verified_at: new Date().toISOString()
                }));
                allJobs.push(...jobs);
                url = data.next;
                if (!url) break;
            }
        } catch { }
        return allJobs;
    }
}

class StaticFeedConnector {
    static async fetch(provider: string): Promise<JobPointer[]> {
        const url = provider === 'ARBEITNOW' ? 'https://www.arbeitnow.com/api/job-board-api' : 'https://remotive.com/api/remote-jobs';
        try {
            const res = await fetch(url);
            const data = await res.json();
            return (data.data || data.jobs || []).map((item: any) => ({
                fingerprint: `${provider.toLowerCase()}-${item.slug || item.id}`,
                company_name: item.company_name,
                role_category: 'engineering',
                seniority_band: 'mid',
                location_type: 'remote',
                location_name: item.location || 'Remote',
                source_url: item.url,
                source_type: `${provider}_API`,
                ats_provider: provider.toLowerCase(),
                external_id: (item.slug || item.id).toString(),
                is_direct_ats: false,
                confidence_tier: 'medium',
                quality_score: 0.8,
                discovery_method: 'API',
                last_verified_at: new Date().toISOString()
            }));
        } catch { return []; }
    }
}

// --- UTILS ---

const BLACKLIST = [
    'driver', 'delivery', 'warehouse', 'clerk', 'cashier', 'retail', 'server', 'cleaner',
    'guard', 'nurse', 'technician (non-it)', 'mechanic', 'laborer', 'janitor', 'cook',
    'restaurant', 'hotel', 'hospitality', 'aramark', 'mcdonald', 'starbucks', 'pretzel',
    'walmart', 'target', 'kroger', 'cvs', 'walgreens', 'supermarket', 'receptionist'
];

function isQualityJob(job: any): boolean {
    const checkString = `${job.title} ${job.company_name} ${job.source_url}`.toLowerCase();
    const isBs = BLACKLIST.some(term => checkString.includes(term));
    return !isBs;
}

function extractSalary(text: string) {
    if (!text) return null;
    const cleanStr = text.toLowerCase();
    let min, max, annualized_min, annualized_max;

    // Hourly: $50-$70/hr or $60/hour
    const hourly = cleanStr.match(/\$?(\d+(?:\.\d+)?)(?:\s*-\s*\$?(\d+(?:\.\d+)?))?\s*(?:\/|per|an)?\s*(?:hr|hour)/);
    if (hourly) {
        min = parseFloat(hourly[1]);
        max = hourly[2] ? parseFloat(hourly[2]) : min;
        return { min, max, currency: 'USD', annualized_min: min * 2080, annualized_max: max * 2080 };
    }

    // Annual: 120k-150k or 120,000-150,000
    const parseVal = (s: string) => s.includes('k') ? parseFloat(s) * 1000 : parseFloat(s.replace(/,/g, '').replace(/\$/g, ''));
    const annual = cleanStr.match(/\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|(?:\d+(?:\.\d+)?)k)(?:\s*-\s*\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|(?:\d+(?:\.\d+)?)k))?\s*(?:\/|per|an)?\s*(?:year|yr|annually)?/);
    if (annual) {
        min = parseVal(annual[1]);
        max = annual[2] ? parseVal(annual[2]) : min;
        return { min, max, currency: 'USD', annualized_min: min, annualized_max: max };
    }
    return null;
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        const { ats_provider, ats_identifier, company_id, api_keys } = await req.json();

        const requestId = crypto.randomUUID();
        const startTime = Date.now();
        console.log(`[ULTIMATE] Processing ${ats_provider} for ${ats_identifier} [ID: ${requestId}]`);

        let jobs: JobPointer[] = [];
        const provider = ats_provider.toUpperCase();

        // Use provided keys OR environmental secrets
        const keys = {
            reed: api_keys?.reed || Deno.env.get('REED_API_KEY'),
            adzuna_id: api_keys?.adzuna_id || Deno.env.get('ADZUNA_APP_ID'),
            adzuna_key: api_keys?.adzuna_key || Deno.env.get('ADZUNA_APP_KEY'),
            usajobs: api_keys?.usajobs || Deno.env.get('USAJOBS_API_KEY'),
            jooble: api_keys?.jooble || Deno.env.get('JOOBLE_API_KEY'),
            findwork: api_keys?.findwork || Deno.env.get('FINDWORK_TOKEN'),
            careerjet: api_keys?.careerjet || Deno.env.get('CAREERJET_KEY')
        };

        if (provider === 'REED') jobs = await ReedConnector.fetchJobs(ats_identifier, keys.reed);
        else if (provider === 'ADZUNA') jobs = await AdzunaConnector.fetchJobs(ats_identifier, keys.adzuna_id, keys.adzuna_key);
        else if (provider === 'USAJOBS') jobs = await UsajobsConnector.fetchJobs(ats_identifier, keys.usajobs);
        else if (provider === 'JOOBLE') {
            const [k, l] = ats_identifier.split(':');
            jobs = await JoobleConnector.fetchJobs(k || 'developer', l || 'US', keys.jooble);
        }
        else if (provider === 'CAREERJET') {
            const [k, l] = ats_identifier.split(':');
            jobs = await CareerjetConnector.fetchJobs(k || 'developer', l || 'us', keys.careerjet);
        }
        else if (provider === 'FINDWORK') jobs = await FindworkConnector.fetchJobs(keys.findwork);
        else if (['ARBEITNOW', 'REMOTIVE'].includes(provider)) jobs = await StaticFeedConnector.fetch(provider);

        if (jobs.length > 0) {
            const filteredJobs = jobs.filter(isQualityJob);

            for (const job of filteredJobs) {
                // 1. Prepare Minimal Pointer
                const pointer = {
                    fingerprint: job.fingerprint,
                    company_name: job.company_name,
                    company_id: company_id || '00000000-0000-0000-0000-000000000000',
                    title: job.title || job.role_category,
                    location_name: job.location_name,
                    location_type: job.location_type,
                    source_url: job.source_url,
                    source_type: job.source_type,
                    ats_provider: job.ats_provider,
                    external_id: job.external_id,
                    is_direct_ats: job.is_direct_ats,
                    confidence_tier: job.confidence_tier,
                    quality_score: job.quality_score,
                    discovery_method: job.discovery_method,
                    last_verified_at: new Date().toISOString(),
                    last_checked_at: new Date().toISOString(),
                    salary_raw: job.salary_raw,
                    state_code: job.state_code,
                    request_id: requestId
                };

                // 2. Upsert Pointer & Get ID
                const { data: upserted, error: pointerError } = await supabase
                    .from('job_pointers')
                    .upsert(pointer, { onConflict: 'fingerprint' })
                    .select('id')
                    .single();

                if (!pointerError && upserted) {
                    // 3. Enrich & Cache
                    const salaryData = extractSalary(job.salary_raw || '');
                    await supabase.from('job_enrichment_cache').upsert({
                        job_pointer_id: upserted.id,
                        description: job.description || '', // From connector
                        salary_json: salaryData || {},
                        salary_raw: job.salary_raw,
                        expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
                    }, { onConflict: 'job_pointer_id' });
                }
            }
            console.log(`[ULTIMATE] Ingested ${filteredJobs.length}/${jobs.length} jobs with transient enrichment.`);
        }

        // Log Ingestion Event
        await supabase.from('ingestion_logs').insert({
            request_id: requestId,
            function_name: 'ats-engine-ultimate',
            jobs_inserted: jobs.length,
            errors_count: 0,
            status: 'SUCCESS',
            execution_duration_ms: Date.now() - startTime,
            payload: { provider: ats_provider, identifier: ats_identifier }
        });

        return new Response(JSON.stringify({ success: true, count: jobs.length, request_id: requestId }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
});
