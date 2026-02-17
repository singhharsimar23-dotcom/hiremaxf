
import { JobPointer } from "./shared/types.ts"
import { normalizeJob } from "./shared/job-normalizer.ts"
import { generateFingerprint } from "./shared/fingerprint.ts"

export class GitHubWatcher {
    static async scan(targets: string[], debug: boolean = false): Promise<JobPointer[]> {
        const jobs: JobPointer[] = [];

        await Promise.all(targets.map(async (target) => {
            try {
                // Try common default branches
                let content = await this.fetchReadme(target, "main");
                if (!content) content = await this.fetchReadme(target, "master");
                if (!content) content = await this.fetchReadme(target, "canary"); // Vercel/Next.js
                if (!content) content = await this.fetchReadme(target, "develop");

                if (!content) {
                    console.warn(`[GitHub] No README found for ${target}`);
                    return;
                }

                // Analyze Content
                const intent = this.analyzeIntent(content);
                if (intent) {
                    const fingerprint = await generateFingerprint(
                        target.split("/")[0], // owner
                        intent.title, // "Developer Intent: Hiring"
                        "Remote" // Default for OSS/GitHub
                    );

                    jobs.push({
                        fingerprint: fingerprint,
                        company_id: null,
                        role_category: "other", // Intent is broad
                        seniority_band: "mid",
                        location_type: "remote",
                        source_url: `https://github.com/${target}`,
                        source_type: "GITHUB_INTENT",
                        confidence_tier: "low", // It's just a mention
                        quality_score: 0.1, // Minimal structured data
                        discovery_method: "GITHUB_WATCHER",
                        validation_status: "UNVERIFIED",
                        last_verified_at: new Date().toISOString(),
                        // Store the snippet in description (abusing field slightly for now, or add metadata)
                    } as JobPointer);
                }

            } catch (e) {
                console.error(`[GitHub] Error scanning ${target}`, e);
            }
        }));

        return jobs;
    }

    private static async fetchReadme(repo: string, branch: string): Promise<string | null> {
        const url = `https://raw.githubusercontent.com/${repo}/${branch}/README.md`;
        try {
            const res = await fetch(url);
            if (res.status === 200) return await res.text();
            return null;
        } catch {
            return null;
        }
    }

    private static analyzeIntent(content: string): { title: string, snippet: string } | null {
        // Look for headers like "## Hiring", "## Careers", "## Join Us"
        const headerRegex = /#{1,3}\s*(Hiring|Careers|Join|Jobs).*/i;
        const match = content.match(headerRegex);

        if (match) {
            // Found a section!
            return {
                title: `Developer Intent: ${match[0].replace(/#{1,3}\s*/, '').trim()}`,
                snippet: match[0]
            };
        }

        // Look for strong keywords near links
        if (/we are hiring/i.test(content) || /check out our careers/i.test(content)) {
            return {
                title: "Developer Intent: Hiring Mention",
                snippet: "General hiring mention found in README."
            };
        }

        return null;
    }
}
