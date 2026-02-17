import { JobPointer } from "./types.ts";
import { normalizeJob, isTechJob } from "./job-normalizer.ts";
import { generateFingerprint, generateCanonicalHash } from "./fingerprint.ts";

export class PersonioScraper {
    static async scrape(companyIdentifier: string, companyId: string): Promise<JobPointer[]> {
        // Personio often exposes an XML feed at https://{company}.jobs.personio.de/xml
        const url = `https://${companyIdentifier}.jobs.personio.de/xml`;

        try {
            const response = await fetch(url);
            if (!response.ok) return [];

            const text = await response.text();
            // Simple regex parsing for XML to avoid heavy DOM parser deps in Edge if possible, 
            // or use a lightweight XML parser if available. 
            // For robustness, strict regex extraction of <job> blocks.

            const jobBlocks = text.match(/<job>[\s\S]*?<\/job>/g) || [];
            const processedJobs: JobPointer[] = [];

            for (const block of jobBlocks) {
                const idMatch = block.match(/<id>(.*?)<\/id>/);
                const titleMatch = block.match(/<name><!\[CDATA\[(.*?)\]\]><\/name>/) || block.match(/<name>(.*?)<\/name>/);
                const urlMatch = block.match(/<url><!\[CDATA\[(.*?)\]\]><\/url>/) || block.match(/<url>(.*?)<\/url>/);
                const locMatch = block.match(/<office><!\[CDATA\[(.*?)\]\]><\/office>/) || block.match(/<office>(.*?)<\/office>/);

                const id = idMatch ? idMatch[1] : `p-${Math.random()}`; // Fallback unique
                const title = titleMatch ? titleMatch[1] : "Unknown Role";
                const jobUrl = urlMatch ? urlMatch[1] : "";
                const location = locMatch ? locMatch[1] : "Unknown";

                if (!isTechJob(title)) continue;

                const norm = normalizeJob({
                    title: title,
                    location: location,
                    url: jobUrl,
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
                    source_url: jobUrl,
                    source_type: 'PERSONIO_DIRECT',
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
                    external_id: id,
                    ats_provider: 'personio'
                });
            }

            return processedJobs;

        } catch (e) {
            console.error(`[Personio] Error:`, e);
            return [];
        }
    }
}
