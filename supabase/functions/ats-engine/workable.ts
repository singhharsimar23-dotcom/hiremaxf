import { normalizeJob, isTechJob } from "./job-normalizer.ts"
import { generateFingerprint, generateCanonicalHash } from "./fingerprint.ts"

export class WorkableScraper {
    /**
     * Scrapes Workable public API: https://apply.workable.com/api/v1/accounts/{slug}/jobs
     */
    static async scrape(slug: string, companyId: string): Promise<JobPointer[]> {
        const url = `https://apply.workable.com/api/v1/accounts/${slug}/jobs`;
        const res = await fetch(url, {
            method: 'POST', // Workable uses POST for job search
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: "",
                location: [],
                department: [],
                worktype: [],
                remote: []
            })
        });

        if (!res.ok) {
            console.error(`[Workable] Failed to fetch ${slug}: ${res.status}`);
            return [];
        }

        const data = await res.json();
        const results = data.results || [];
        const jobs: JobPointer[] = [];

        for (const job of results) {
            // TECH JOB FILTER
            if (!isTechJob(job.title)) continue;

            // Workable provides shortcodes and slugs
            const jobUrl = `https://apply.workable.com/${slug}/j/${job.shortcode}/`;

            const normalized = normalizeJob({
                title: job.title,
                company: slug, // Use slug for mapping
                location: job.remote ? "Remote" : (job.location?.city || "Unknown"),
                url: jobUrl,
                description: job.description || ""
            });

            const fingerprint = await generateFingerprint(
                slug,
                job.title,
                normalized.location_raw
            );
            const canonicalHash = await generateCanonicalHash(slug, job.title, normalized.location_raw);

            jobs.push({
                fingerprint,
                company_id: companyId,
                company_name: slug,
                role_category: normalized.role_category,
                seniority_band: normalized.seniority_band,
                location_type: normalized.location_type,
                location_name: normalized.location_raw,
                source_url: jobUrl,
                source_type: "ATS_WORKABLE",
                confidence_tier: "high",
                quality_score: normalized.quality_score,
                discovery_method: "ATS_ENGINE",
                validation_status: "VERIFIED",
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
                application_endpoint: jobUrl,
                ats_provider: 'workable'
            });
        }

        return jobs;
    }
}
