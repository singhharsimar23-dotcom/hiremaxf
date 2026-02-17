import { JobPointer } from "./types.ts";
import { normalizeJob, isTechJob } from "./job-normalizer.ts";
import { generateFingerprint, generateCanonicalHash } from "./fingerprint.ts";

export class BambooHRScraper {
    static async scrape(companyIdentifier: string, companyId: string): Promise<JobPointer[]> {
        // Common public JSON endpoint: https://{company}.bamboohr.com/jobs/embed2.php
        const url = `https://${companyIdentifier}.bamboohr.com/jobs/embed2.php`;

        try {
            const response = await fetch(url);
            if (!response.ok) return [];

            const data = await response.json();
            const jobs = data.jobs || [];

            const processedJobs: JobPointer[] = [];

            for (const job of jobs) {
                if (!isTechJob(job.jobTitle)) continue;

                const norm = normalizeJob({
                    title: job.jobTitle,
                    location: job.location?.city || "Unknown",
                    url: `https://${companyIdentifier}.bamboohr.com/jobs/view.php?id=${job.id}`,
                    description: "Details on site"
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
                    source_url: `https://${companyIdentifier}.bamboohr.com/jobs/view.php?id=${job.id}`,
                    source_type: 'BAMBOOHR_DIRECT',
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
                    external_id: job.id,
                    ats_provider: 'bamboohr'
                });
            }
            return processedJobs;
        } catch (e) {
            console.error(`[BambooHR] Error:`, e);
            return [];
        }
    }
}
