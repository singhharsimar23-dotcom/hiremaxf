import { JobPointer } from "./types.ts";
import { normalizeJob, isTechJob } from "./job-normalizer.ts";
import { generateFingerprint, generateCanonicalHash } from "./fingerprint.ts";

export class GreenhouseScraper {
    static async scrape(boardToken: string, companyId: string): Promise<JobPointer[]> {
        const hosts = [
            'boards-api.greenhouse.io',
            'boards-api.eu.greenhouse.io'
        ];

        let jobs: any[] = [];
        for (const host of hosts) {
            const url = `https://${host}/v1/boards/${boardToken}/jobs?content=true`;
            try {
                const response = await fetch(url);
                if (response.ok) {
                    const data = await response.json();
                    if (data.jobs && data.jobs.length > 0) {
                        jobs = data.jobs;
                        break;
                    }
                }
            } catch (e) {
                console.error(`[Greenhouse] Failed host ${host}:`, e.message);
            }
        }

        if (jobs.length === 0) return [];

        try {
            const processedJobs: JobPointer[] = [];

            for (const job of jobs) {
                // TECH JOB FILTER
                if (!isTechJob(job.title)) continue;

                const norm = normalizeJob({
                    title: job.title,
                    location: job.location?.name || "Unknown",
                    url: job.absolute_url,
                    description: job.content
                });

                const fingerprint = await generateFingerprint(boardToken, norm.title, norm.location_raw);
                const canonicalHash = await generateCanonicalHash(boardToken, norm.title, norm.location_raw);

                // STRICT PHASE 1: Live Status Enforcement
                // Greenhouse API default is live-only, but strict check if metadata exists
                if (job.status && job.status !== 'open') continue;

                // STRICT PHASE 2: Unique Tenant Validation
                // Map external ID for deduplication
                const externalId = job.id.toString();

                processedJobs.push({
                    fingerprint: fingerprint,
                    company_id: companyId,
                    company_name: boardToken,
                    role_category: norm.role_category,
                    seniority_band: norm.seniority_band,
                    location_type: norm.location_type,
                    location_name: norm.location_raw,
                    source_url: job.absolute_url,
                    source_type: 'GREENHOUSE_DIRECT',
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
                    external_id: externalId,
                    ats_provider: 'greenhouse' // Explicit provider
                });
            }
            return processedJobs;

        } catch (error) {
            console.error(`[Greenhouse] Error scraping ${boardToken}:`, error);
            return [];
        }
    }
}
