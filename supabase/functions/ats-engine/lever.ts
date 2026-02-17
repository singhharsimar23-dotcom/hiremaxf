import { JobPointer } from "./types.ts";
import { normalizeJob, isTechJob } from "./job-normalizer.ts";
import { generateFingerprint, generateCanonicalHash } from "./fingerprint.ts";

export class LeverScraper {
    static async scrape(companyName: string, companyId: string): Promise<JobPointer[]> {
        const url = `https://api.lever.co/v0/postings/${companyName}?mode=json`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.error(`[Lever] Failed to fetch for ${companyName}: ${response.status}`);
                return [];
            }

            const jobs = await response.json();

            const processedJobs: JobPointer[] = [];

            for (const job of jobs) {
                // TECH JOB FILTER
                if (!isTechJob(job.text)) continue;

                const norm = normalizeJob({
                    title: job.text,
                    location: job.categories?.location || "Unknown",
                    url: job.hostedUrl,
                    description: job.descriptionPlain
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
                    source_url: job.hostedUrl,
                    source_type: 'LEVER_DIRECT',
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
                    external_id: job.id,
                    ats_provider: 'lever'
                });
            }
            return processedJobs;

        } catch (error) {
            console.error(`[Lever] Error scraping ${companyName}:`, error);
            return [];
        }
    }
}
