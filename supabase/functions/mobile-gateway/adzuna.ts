import { JobPointer } from "./shared/types.ts";
import { normalizeJob } from "./shared/job-normalizer.ts";
import { generateFingerprint } from "./shared/fingerprint.ts";
import { getRandomUserAgent } from "./user-agents.ts";

export class AdzunaService {
    static async fetchJobs(query: string, location: string, limit: number = 20, debug: boolean = false): Promise<JobPointer[]> {
        const appId = Deno.env.get('ADZUNA_APP_ID');
        const appKey = Deno.env.get('ADZUNA_APP_KEY');
        const country = 'us'; // Default to US for now, can be parameterized

        if (!appId || !appKey) {
            console.error("Missing ADZUNA_APP_ID or ADZUNA_APP_KEY");
            if (debug) throw new Error("Missing ADZUNA_APP_ID or ADZUNA_APP_KEY");
            return [];
        }

        const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${appId}&app_key=${appKey}&what=${encodeURIComponent(query)}&where=${encodeURIComponent(location)}&results_per_page=${limit}&content-type=application/json`;

        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': getRandomUserAgent(), // Mimic mobile request
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                console.error(`[Adzuna] Failed to fetch: ${response.status}`);
                if (debug) {
                    const text = await response.text();
                    throw new Error(`[Adzuna] Failed to fetch: ${response.status} - ${text}`);
                }
                return [];
            }

            const data = await response.json();
            const results = data.results || [];

            if (debug) {
                return await Promise.all(results.map(async (job: any) => {
                    // Return a dummy pointer for debugging
                    return {
                        fingerprint: "DEBUG_" + Math.random(),
                        company_id: "ADZUNA_RAW: " + job.title,
                        role_category: "debug",
                        seniority_band: "mid",
                        location_type: "remote",
                        source_url: job.redirect_url,
                        source_type: "DEBUG",
                        confidence_tier: "low",
                        quality_score: 0,
                        discovery_method: "DEBUG",
                        validation_status: "DEBUG",
                        last_verified_at: new Date().toISOString()
                    } as any as JobPointer;
                }));
            }

            return await Promise.all(results.map(async (job: any) => {
                const norm = normalizeJob({
                    title: job.title,
                    location: job.location?.display_name || "Unknown",
                    url: job.redirect_url,
                    description: job.description
                });

                const fingerprint = await generateFingerprint(
                    job.company?.display_name || "Unknown Company",
                    norm.title,
                    norm.location_raw
                );

                return {
                    // id: fingerprint, // Let DB generate UUID
                    fingerprint: fingerprint,
                    company_id: null, // Aggregator jobs often don't map to our internal company IDs directly
                    role_category: norm.role_category,
                    seniority_band: norm.seniority_band,
                    location_type: norm.location_type,
                    source_url: job.redirect_url,
                    source_type: 'ADZUNA_MOBILE_AGGREGATOR', // Marking as aggregator
                    confidence_tier: 'medium',
                    quality_score: norm.quality_score,
                    discovery_method: 'MOBILE_GATEWAY',
                    validation_status: 'UNVERIFIED', // Needs manual verification or click-through
                    last_verified_at: new Date().toISOString()
                } as JobPointer;
            }));

        } catch (error) {
            console.error("[Adzuna] Error fetching jobs:", error);
            if (debug) throw error;
            return [];
        }
    }
}
