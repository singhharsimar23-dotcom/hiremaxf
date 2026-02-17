import { normalizeJob } from "./job-normalizer.ts";
import { generateFingerprint } from "./fingerprint.ts";
export class GreenhouseScraper {
    static async scrape(boardToken, companyId) {
        const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.error(`[Greenhouse] Failed to fetch for ${boardToken}: ${response.status}`);
                return [];
            }
            const data = await response.json();
            const jobs = data.jobs || [];
            return await Promise.all(jobs.map(async (job) => {
                const norm = normalizeJob({
                    title: job.title,
                    location: job.location?.name || "Unknown",
                    url: job.absolute_url,
                    description: job.content
                });
                const fingerprint = await generateFingerprint(boardToken, // company
                norm.title, // title
                norm.location_raw // location
                );
                return {
                    // id: fingerprint, // Let DB generate UUID
                    fingerprint: fingerprint,
                    company_id: companyId,
                    role_category: norm.role_category,
                    seniority_band: norm.seniority_band,
                    location_type: norm.location_type,
                    source_url: job.absolute_url,
                    source_type: 'GREENHOUSE_DIRECT',
                    confidence_tier: 'high',
                    quality_score: norm.quality_score,
                    discovery_method: 'ATS_DIRECT',
                    validation_status: 'VERIFIED',
                    last_verified_at: new Date().toISOString()
                };
            }));
        }
        catch (error) {
            console.error(`[Greenhouse] Error scraping ${boardToken}:`, error);
            return [];
        }
    }
}
