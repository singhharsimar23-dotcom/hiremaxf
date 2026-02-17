
import { JobPointer } from "./shared/types.ts"
import { generateFingerprint } from "./shared/fingerprint.ts"

export class CrtShService {
    static async checkDomains(domains: string[], debug: boolean = false): Promise<JobPointer[]> {
        const pointers: JobPointer[] = [];

        for (const domain of domains) {
            try {
                if (debug) console.log(`[Crt.sh] Checking ${domain}...`);
                const subdomains = await this.fetchSubdomains(domain);

                const careerSubdomains = subdomains.filter(s =>
                    /^(career|jobs|work|join|hiring|scout|talent)\./i.test(s)
                );

                if (careerSubdomains.length > 0) {
                    if (debug) console.log(`[Crt.sh] Found career subdomains for ${domain}:`, careerSubdomains);

                    for (const sub of careerSubdomains) {
                        const fingerprint = await generateFingerprint(
                            domain.split('.')[0], // Company name approx
                            "Technographic Signal: " + sub,
                            "Remote"
                        );

                        pointers.push({
                            fingerprint: fingerprint,
                            company_id: null,
                            role_category: "other",
                            seniority_band: "mid",
                            location_type: "remote",
                            source_url: `https://${sub}`,
                            source_type: "TECHNOGRAPHIC",
                            confidence_tier: "medium", // Specific subdomain is high signal
                            quality_score: 0.3, // It's just a URL
                            discovery_method: "SSL_CT_MONITOR",
                            validation_status: "UNVERIFIED",
                            last_verified_at: new Date().toISOString()
                        } as JobPointer);
                    }
                }
            } catch (e) {
                console.error(`[Crt.sh] Error checking ${domain}:`, e);
            }
        }

        return pointers;
    }

    private static async fetchSubdomains(domain: string): Promise<string[]> {
        const url = `https://crt.sh/?q=%.${domain}&output=json`;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!res.ok) throw new Error(`Status ${res.status}`);

            const data = await res.json();
            const subs = new Set<string>();

            for (const item of data) {
                const names = item.name_value.split('\n');
                for (const name of names) {
                    subs.add(name.trim().toLowerCase().replace('*.', ''));
                }
            }

            return Array.from(subs);
        } catch (e) {
            if (e.name === 'AbortError') console.error(`[Crt.sh] Timeout on ${domain}`);
            return [];
        }
    }
}
