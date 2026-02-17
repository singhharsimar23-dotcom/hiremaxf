import { normalizeJob } from "./job-normalizer.ts";
import { generateFingerprint } from "./fingerprint.ts";
export class LeverScraper {
    static async scrape(companyName, companyId) {
        const url = `https://api.lever.co/v0/postings/${companyName}?mode=json`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.error(`[Lever] Failed to fetch for ${companyName}: ${response.status}`);
                return [];
            }
            const jobs = await response.json();
            return await Promise.all(jobs.map(async (job) => {
                const norm = normalizeJob({
                    title: job.text,
                    location: job.categories?.location || "Unknown",
                    url: job.hostedUrl,
                    description: job.descriptionPlain
                });
                const fingerprint = await generateFingerprint(companyName, norm.title, norm.location_raw);
                return {
                    // id: fingerprint, 
                    fingerprint: fingerprint,
                    company_id: companyId,
                    role_category: norm.role_category,
                    seniority_band: norm.seniority_band,
                    location_type: norm.location_type,
                    source_url: job.hostedUrl,
                    source_type: 'LEVER_DIRECT',
                    confidence_tier: 'high',
                    quality_score: norm.quality_score,
                    discovery_method: 'ATS_DIRECT',
                    validation_status: 'VERIFIED',
                    last_verified_at: new Date().toISOString()
                };
            }));
        }
        catch (error) {
            console.error(`[Lever] Error scraping ${companyName}:`, error);
            return [];
        }
    }
}
