import { normalizeJob } from "./job-normalizer.ts";
import { generateFingerprint } from "./fingerprint.ts";
export class WorkableScraper {
    /**
     * Scrapes Workable public API: https://apply.workable.com/api/v1/accounts/{slug}/jobs
     */
    static async scrape(slug, companyId) {
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
        const jobs = [];
        for (const job of results) {
            // Workable provides shortcodes and slugs
            const jobUrl = `https://apply.workable.com/${slug}/j/${job.shortcode}/`;
            const normalized = normalizeJob({
                title: job.title,
                company: slug, // Use slug for mapping
                location: job.remote ? "Remote" : (job.location?.city || "Unknown"),
                url: jobUrl,
                description: job.description || ""
            });
            const fingerprint = await generateFingerprint(slug, job.title, normalized.location_raw);
            jobs.push({
                fingerprint,
                company_id: companyId,
                role_category: normalized.role_category,
                seniority_band: normalized.seniority_band,
                location_type: normalized.location_type,
                source_url: jobUrl,
                source_type: "ATS_WORKABLE",
                confidence_tier: "high",
                quality_score: normalized.quality_score,
                discovery_method: "ATS_ENGINE",
                validation_status: "VERIFIED",
                last_verified_at: new Date().toISOString()
            });
        }
        return jobs;
    }
}
