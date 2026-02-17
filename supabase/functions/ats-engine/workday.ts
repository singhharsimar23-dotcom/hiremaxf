import { JobPointer } from "./types.ts";
import { normalizeJob, isTechJob } from "./job-normalizer.ts";
import { generateFingerprint, generateCanonicalHash } from "./fingerprint.ts";

export class WorkdayScraper {
    static async scrape(identifier: string, companyId: string): Promise<JobPointer[]> {
        // Identifier format: tenant:shard:site
        // Example: salesforce:wd12:External_Career_Site
        // Fallback: simple tenant string (tries standard defaults)

        let tenant = identifier;
        let shard = 'wd1';
        let site = 'External_Career_Site'; // Default

        if (identifier.includes(':')) {
            const parts = identifier.split(':');
            tenant = parts[0];
            if (parts.length > 1) shard = parts[1];
            if (parts.length > 2) site = parts[2];
        } else if (identifier.includes('.')) {
            // Handle salesforce.wd12 format
            const parts = identifier.split('.');
            tenant = parts[0];
            shard = parts[1];
        }

        const host = `${tenant}.${shard}.myworkdayjobs.com`;
        const initialUrl = `https://${host}/${site}`;
        const configUrl = `https://${host}/wday/cxs/${tenant}/${site}`;
        const jobsUrl = `${configUrl}/jobs`;

        console.log(`[Workday] Target: ${host}, Tenant: ${tenant}, Site: ${site}`);

        const allJobs: JobPointer[] = [];
        let offset = 0;
        const limit = 20;
        let total = 0;

        // Browser-like headers required for API access
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Accept-Language": "en-US,en;q=0.5",
            "Origin": `https://${host}`,
            "Referer": initialUrl,
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin"
        };

        try {
            while (true) {
                // console.log(`[Workday] Fetching jobs offset ${offset}...`);
                const response = await fetch(jobsUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        "limit": limit,
                        "offset": offset,
                        "searchText": ""
                    })
                });

                if (!response.ok) {
                    console.error(`[Workday] Failed to fetch jobs: ${response.status}`);
                    // logic to try fallback if first request?
                    break;
                }

                const data = await response.json();
                total = data.total;
                const items = data.jobPostings || [];

                for (const job of items) {
                    // Normalize
                    const title = job.title;
                    if (!isTechJob(title)) continue;

                    const location = job.locationsText || job.locations?.[0] || "Unknown";
                    const externalId = job.bulletFields?.[0] || job.externalPath || `wd-${Math.random()}`; // heuristic
                    const jobUrl = `https://${host}/${site}${job.externalPath}`;

                    const norm = normalizeJob({
                        title: title,
                        location: location,
                        url: jobUrl,
                        description: job.bulletFields?.join('\n') || "Details on site"
                    });

                    const fingerprint = await generateFingerprint(tenant, norm.title, norm.location_raw);
                    const canonicalHash = await generateCanonicalHash(tenant, norm.title, norm.location_raw);

                    allJobs.push({
                        fingerprint,
                        company_id: companyId,
                        company_name: tenant,
                        role_category: norm.role_category,
                        seniority_band: norm.seniority_band,
                        location_type: norm.location_type,
                        location_name: norm.location_raw,
                        source_url: jobUrl,
                        source_type: 'WORKDAY_DIRECT',
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
                        external_id: externalId,
                        ats_provider: 'workday'
                    });
                }

                offset += limit;
                if (offset >= total) break;

                // Safety break
                if (offset > 2000) break;
            }

            console.log(`[Workday] Ingested ${allJobs.length} jobs.`);
            return allJobs;

        } catch (e) {
            console.error(`[Workday] Error:`, e);
            return [];
        }
    }
}
