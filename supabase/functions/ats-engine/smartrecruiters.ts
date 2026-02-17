import { JobPointer } from "./types.ts";
import { normalizeJob, isTechJob } from "./job-normalizer.ts";
import { generateFingerprint, generateCanonicalHash } from "./fingerprint.ts";

export class SmartRecruitersScraper {
    static async scrape(companyIdentifier: string, companyId: string): Promise<JobPointer[]> {
        // Pattern: https://api.smartrecruiters.com/v1/companies/{company}/postings
        const url = `https://api.smartrecruiters.com/v1/companies/${companyIdentifier}/postings`;

        try {
            const response = await fetch(url);
            if (!response.ok) return [];

            const data = await response.json();
            const jobs = data.content || [];

            const processedJobs: JobPointer[] = [];

            for (const job of jobs) {
                if (!isTechJob(job.name)) continue;

                const norm = normalizeJob({
                    title: job.name,
                    location: job.location?.city || "Unknown",
                    url: `https://jobs.smartrecruiters.com/${companyIdentifier}/${job.id}`, // Constructing URL as API returns ref
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
                    source_url: `https://jobs.smartrecruiters.com/${companyIdentifier}/${job.id}`,
                    source_type: 'SMARTRECRUITERS_DIRECT',
                    confidence_tier: 'high',
                    quality_score: norm.quality_score,
                    discovery_method: 'ATS_DIRECT',
                    validation_status: 'VERIFIED',
                    last_verified_at: new Date().toISOString(),
                    raw_payload: job,
                    canonical_hash: canonicalHash,
                    is_direct_ats: true,
                    is_direct_company: true,
                    source_origin_type: 'ats',
                    ingestion_origin: 'ats',
                    redirect_depth: 0,
                    canonical_verified: true,
                    external_id: job.id,
                    ats_provider: 'smartrecruiters'
                });
            }
            return processedJobs;
        } catch (e) {
            console.error(`[SmartRecruiters] Error:`, e);
            return [];
        }
    }
}
