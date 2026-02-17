import { JobPointer } from "./types.ts";
import { normalizeJob, isTechJob } from "./job-normalizer.ts";
import { generateFingerprint, generateCanonicalHash } from "./fingerprint.ts";

export class AshbyScraper {
    static async scrape(companyName: string, companyId: string): Promise<JobPointer[]> {
        const url = `https://api.ashbyhq.com/posting-api/job-board/${companyName}`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.error(`[Ashby] Failed to fetch for ${companyName}: ${response.status}`);
                return [];
            }

            const data = await response.json();
            const jobs = data.jobs || [];

            const processedJobs: JobPointer[] = [];

            for (const job of jobs) {
                // TECH JOB FILTER
                if (!isTechJob(job.title)) continue;

                const norm = normalizeJob({
                    title: job.title,
                    location: job.location || "Unknown",
                    url: job.jobUrl,
                    description: "Details available on site"
                });

                const fingerprint = await generateFingerprint(companyName, norm.title, norm.location_raw);
                const canonicalHash = await generateCanonicalHash(companyName, norm.title, norm.location_raw);

                processedJobs.push({
                    fingerprint: fingerprint,
                    company_id: companyId,
                    company_name: companyName,
                    role_category: norm.role_category,
                    seniority_band: norm.seniority_band,
                    location_type: norm.location_type,
                    location_name: norm.location_raw,
                    source_url: job.jobUrl,
                    source_type: 'ASHBY_DIRECT',
                    confidence_tier: 'high',
                    quality_score: norm.quality_score,
                    discovery_method: 'ATS_DIRECT',
                    validation_status: 'VERIFIED',
                    last_verified_at: new Date().toISOString(),
                    // New Fields
                    raw_payload: job,
                    canonical_hash: canonicalHash,
                    is_direct_ats: true,
                    is_direct_company: true,
                    source_origin_type: 'ats',
                    ingestion_origin: 'ats',
                    redirect_depth: 0,
                    canonical_verified: true,
                    application_endpoint: job.jobUrl,
                    ats_provider: 'ashby',
                    external_id: job.id
                });
            }
            return processedJobs;

        } catch (error) {
            console.error(`[Ashby] Error scraping ${companyName}:`, error);
            return [];
        }
    }
}
