import { JobPointer } from "./shared/types.ts";
import { normalizeJob } from "./shared/job-normalizer.ts";
import { generateFingerprint } from "./shared/fingerprint.ts";
import { getRandomUserAgent } from "./user-agents.ts";

export class RemoteOKService {
    static async fetchJobs(query: string = "software monitor", debug: boolean = false): Promise<JobPointer[]> {
        const url = "https://remoteok.com/api"; // Returns all jobs, filtering is client-side usually or via tags

        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': getRandomUserAgent()
                }
            });

            if (!response.ok) {
                console.error(`[RemoteOK] Failed to fetch: ${response.status}`);
                return [];
            }

            const jobs = await response.json();
            // First item is legal info, skip it
            const actualJobs = jobs.slice(1);

            if (debug) {
                return await Promise.all(actualJobs.slice(0, 5).map(async (job: any) => {
                    const norm = normalizeJob({
                        title: job.position || "No Position",
                        location: job.location || "Remote",
                        url: job.url,
                        description: (job.description || "").substring(0, 100)
                    });

                    // Return a dummy pointer for debugging
                    return {
                        // Abuse title field to show what we saw
                        // company_id: "RAW_POS: " + job.position, // Commented out to avoid duplicate
                        fingerprint: "DEBUG_" + Math.random(),
                        company_id: "RAW_POS: " + job.position,
                        last_verified_at: new Date().toISOString()
                    } as any as JobPointer;
                }));
            }

            return await Promise.all(actualJobs.map(async (job: any) => {
                // Determine if relevant based on query (simple includes check)
                const text = (job.position + " " + job.description).toLowerCase();
                if (query && !text.includes(query.toLowerCase())) return null;

                const norm = normalizeJob({
                    title: job.position,
                    location: job.location || "Remote",
                    url: job.url,
                    description: job.description
                });

                const fingerprint = await generateFingerprint(
                    job.company,
                    norm.title,
                    norm.location_raw
                );

                return {
                    // id: fingerprint,
                    fingerprint: fingerprint,
                    company_id: null,
                    role_category: norm.role_category,
                    seniority_band: norm.seniority_band,
                    location_type: 'remote',
                    source_url: job.url,
                    source_type: 'REMOTEOK_API',
                    confidence_tier: 'medium',
                    quality_score: norm.quality_score,
                    discovery_method: 'MOBILE_GATEWAY',
                    validation_status: 'VERIFIED', // RemoteOK is generally high quality
                    last_verified_at: new Date().toISOString()
                } as JobPointer;
            }));

        } catch (error) {
            console.error("[RemoteOK] Error fetching jobs:", error);
            throw error; // Re-throw to see in response
        }
    }
}
