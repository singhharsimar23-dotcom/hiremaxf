import { JobPointer } from "./types.ts";
import { normalizeJob, isTechJob } from "./job-normalizer.ts";
import { generateFingerprint, generateCanonicalHash } from "./fingerprint.ts";

export class IcimsScraper {
    static async scrape(companyIdentifier: string, companyId: string): Promise<JobPointer[]> {
        // iCIMS usually hosts at https://{company}.icims.com/jobs/search?pr=0
        // We will try to fetch the page and parsing the HTML for job data.
        // iCIMS pages often contain JSON data in a script tag or are rendered server-side.

        const offset = 0;
        const url = `https://${companyIdentifier}.icims.com/jobs/search?pr=${offset}&schema=json`;
        // Note: ?schema=json is not a standard public API, but often works on some configurations or we need to parse HTML.
        // Let's try to fetch the main search page which often has schema.org data.

        const searchUrl = `https://${companyIdentifier}.icims.com/jobs/search?pr=0`;

        try {
            const response = await fetch(searchUrl);
            if (!response.ok) return [];
            const html = await response.text();

            // Attempt to extract Schema.org JSON-LD
            const ldJsonMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
            let jobs: any[] = [];

            if (ldJsonMatch) {
                try {
                    const json = JSON.parse(ldJsonMatch[1]);
                    if (json['@type'] === 'JobPosting') {
                        jobs = [json];
                    } else if (Array.isArray(json)) {
                        jobs = json.filter(j => j['@type'] === 'JobPosting');
                    } else if (json['@graph']) {
                        jobs = json['@graph'].filter((j: any) => j['@type'] === 'JobPosting');
                    }
                } catch (e) {
                    console.error("Failed to parse LD+JSON for iCIMS", e);
                }
            }

            // iCIMS specific fallback: Look for "icims-job-title" or similar classes if JSON fails
            // But for now, let's rely on JSON-LD as it's common for accessibility.

            const processedJobs: JobPointer[] = [];

            for (const job of jobs) {
                if (!isTechJob(job.title)) continue;

                const norm = normalizeJob({
                    title: job.title,
                    location: job.jobLocation?.address?.addressLocality || "Unknown",
                    url: job.url || searchUrl,
                    description: job.description || "Details on site"
                });

                const fingerprint = await generateFingerprint(companyIdentifier, norm.title, norm.location_raw);
                const canonicalHash = await generateCanonicalHash(companyIdentifier, norm.title, norm.location_raw);

                processedJobs.push({
                    fingerprint: fingerprint,
                    company_id: companyId,
                    company_name: companyIdentifier,
                    role_category: norm.role_category,
                    seniority_band: norm.seniority_band,
                    location_type: norm.location_type,
                    location_name: norm.location_raw,
                    source_url: job.url || searchUrl,
                    source_type: 'ICIMS_DIRECT',
                    confidence_tier: 'high',
                    quality_score: norm.quality_score,
                    discovery_method: 'ATS_DIRECT',
                    validation_status: 'VERIFIED',
                    last_verified_at: new Date().toISOString(),
                    canonical_hash: canonicalHash,
                    is_direct_ats: true,
                    is_direct_company: true,
                    source_origin_type: 'ats',
                    ingestion_origin: 'ats',
                    redirect_depth: 0,
                    canonical_verified: true,
                    external_id: job.identifier?.value || `icims-${Math.random()}`,
                    ats_provider: 'icims'
                });
            }

            return processedJobs;

        } catch (e) {
            console.error(`[iCIMS] Error:`, e);
            return [];
        }
    }
}
