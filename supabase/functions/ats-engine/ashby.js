import { normalizeJob } from "./job-normalizer.ts";
import { generateFingerprint } from "./fingerprint.ts";
export class AshbyScraper {
    static async scrape(companyName, companyId) {
        const url = `https://api.ashbyhq.com/posting-api/job-board/${companyName}`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.error(`[Ashby] Failed to fetch for ${companyName}: ${response.status}`);
                return [];
            }
            const data = await response.json();
            const jobs = data.jobs || [];
            return await Promise.all(jobs.map(async (job) => {
                const norm = normalizeJob({
                    title: job.title,
                    location: job.location || "Unknown",
                    url: job.jobUrl,
                    description: "Details available on site" // Ashby public API is slim on full description sometimes
                });
                const fingerprint = await generateFingerprint(companyName, norm.title, norm.location_raw);
                return {
                    // id: fingerprint,
                    fingerprint: fingerprint,
                    company_id: companyId,
                    role_category: norm.role_category,
                    seniority_band: norm.seniority_band,
                    location_type: norm.location_type,
                    source_url: job.jobUrl,
                    source_type: 'ASHBY_DIRECT',
                    confidence_tier: 'high',
                    quality_score: norm.quality_score,
                    discovery_method: 'ATS_DIRECT',
                    validation_status: 'VERIFIED',
                    last_verified_at: new Date().toISOString()
                };
            }));
        }
        catch (error) {
            console.error(`[Ashby] Error scraping ${companyName}:`, error);
            return [];
        }
    }
}
