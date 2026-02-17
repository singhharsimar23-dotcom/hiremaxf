import { JobPointer } from "./types.ts";
import { normalizeJob, isTechJob } from "./job-normalizer.ts";
import { generateFingerprint, generateCanonicalHash } from "./fingerprint.ts";

export class UniversalAtsScraper {
    static async scrape(slug: string, companyId: string, provider: string): Promise<JobPointer[]> {
        let url = "";
        let method = "GET";
        let headers: Record<string, string> = {};
        let body: any = null;

        // Map provider to known public API patterns
        switch (provider.toUpperCase()) {
            case 'SMARTRECRUITERS':
                url = `https://api.smartrecruiters.com/v1/companies/${slug}/postings`;
                break;
            case 'RECRUITEE':
                url = `https://${slug}.recruitee.com/api/offers`;
                break;
            case 'TEAMTAILOR':
                // Teamtailor often uses a specific slug in their public board
                url = `https://api.teamtailor.com/v1/jobs?company_slug=${slug}`;
                break;
            case 'JOBVITE':
                url = `https://api.jobvite.com/v1/jobboard/${slug}`;
                break;
            case 'BAMBOOHR':
                url = `https://${slug}.bamboohr.com/jobs/embed2.php?show_json=true`;
                break;
            case 'PERSONIO':
                url = `https://${slug}.jobs.personio.de/xml`; // Personio often uses XML, but we handle it as far as possible or use their dev API if common
                // If we want JSON, some use specific subdomains
                break;
            case 'WORKDAY':
                // Workday is complex, usually requires a specific 'cxs' endpoint
                // Typical: https://{slug}.wd1.myworkdayjobs.com/wday/cxs/developer/job_board/jobs
                url = `https://${slug}.wd1.myworkdayjobs.com/wday/cxs/developer/job_board/jobs`;
                method = "POST";
                headers = { "Content-Type": "application/json" };
                body = JSON.stringify({
                    appliedFacets: {},
                    limit: 20,
                    offset: 0,
                    searchText: ""
                });
                break;
            default:
                console.warn(`[UniversalScraper] No pattern for ${provider}, skipping.`);
                return [];
        }

        try {
            const response = await fetch(url, { method, headers, body });
            if (!response.ok) return [];

            const data = await response.json();
            let rawJobs: any[] = [];

            // Extract jobs based on provider schema
            switch (provider.toUpperCase()) {
                case 'SMARTRECRUITERS':
                    rawJobs = data.content || [];
                    break;
                case 'RECRUITEE':
                    rawJobs = data.offers || [];
                    break;
                case 'TEAMTAILOR':
                    rawJobs = data.data || [];
                    break;
                case 'WORKDAY':
                    rawJobs = data.jobPostings || [];
                    break;
                default:
                    rawJobs = Array.isArray(data) ? data : (data.jobs || data.results || []);
            }

            const jobs: JobPointer[] = [];

            for (const item of rawJobs) {
                // Map fields based on provider
                let title = "";
                let location = "Remote";
                let jobUrl = "";
                let description = "";

                if (provider === 'SMARTRECRUITERS') {
                    title = item.name;
                    location = item.location?.city || "Unknown";
                    jobUrl = `https://jobs.smartrecruiters.com/${slug}/${item.id}`;
                } else if (provider === 'WORKDAY') {
                    title = item.title;
                    location = item.locationsText || "Unknown";
                    jobUrl = `https://${slug}.wd1.myworkdayjobs.com${item.externalPath}`;
                } else if (provider === 'TEAMTAILOR') {
                    title = item.attributes?.title;
                    location = item.attributes?.location || "Unknown";
                    jobUrl = item.links?.self;
                } else {
                    title = item.title || item.name || item.text;
                    location = item.location || item.city || "Unknown";
                    jobUrl = item.url || item.jobUrl || item.hostedUrl;
                }

                if (!title) continue;

                // TECH JOB FILTER
                if (!isTechJob(title)) continue;

                const norm = normalizeJob({ title, location, url: jobUrl, description });

                const fingerprint = await generateFingerprint(slug, title, norm.location_raw);
                const canonicalHash = await generateCanonicalHash(slug, title, norm.location_raw);

                jobs.push({
                    fingerprint,
                    company_id: companyId,
                    company_name: slug,
                    role_category: norm.role_category,
                    seniority_band: norm.seniority_band,
                    location_type: norm.location_type,
                    location_name: norm.location_raw,
                    source_url: jobUrl,
                    source_type: `ATS_${provider.toUpperCase()}`,
                    confidence_tier: 'high',
                    quality_score: norm.quality_score,
                    discovery_method: 'ATS_DIRECT',
                    validation_status: 'VERIFIED',
                    last_verified_at: new Date().toISOString(),
                    raw_payload: item,
                    canonical_hash: canonicalHash,
                    is_direct_ats: true,
                    is_direct_company: true,
                    source_origin_type: 'ats',
                    ingestion_origin: 'ats',
                    redirect_depth: 0,
                    canonical_verified: true,
                    application_endpoint: jobUrl,
                    ats_provider: provider.toLowerCase()
                });
            }

            return jobs;

        } catch (error) {
            console.error(`[UniversalScraper] Error for ${provider} (${slug}):`, error);
            return [];
        }
    }
}
