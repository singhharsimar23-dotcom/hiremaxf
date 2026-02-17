import { JobPointer } from "./types.ts";

export class AdzunaConnector {
    private static APP_ID = Deno.env.get('ADZUNA_APP_ID') || '';
    private static APP_KEY = Deno.env.get('ADZUNA_APP_KEY') || '';

    static async fetchJobs(identifier?: string): Promise<JobPointer[]> {
        if (!this.APP_ID || !this.APP_KEY) return [];

        let country = 'gb';
        let keywords = 'developer';
        let page = '1';

        if (identifier) {
            const parts = identifier.split(':');
            country = parts[0] || country;
            keywords = parts[1] || keywords;
            page = parts[2] || page;
        }

        try {
            const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}?app_id=${this.APP_ID}&app_key=${this.APP_KEY}&what=${encodeURIComponent(keywords)}&content-type=application/json`;

            console.log(`[Adzuna] Fetching: ${url.replace(this.APP_KEY, '***')}`);

            const response = await fetch(url);

            if (!response.ok) {
                console.error(`[Adzuna] API Error: ${response.status} ${response.statusText} for ${country}`);
                return [];
            }
            const data = await response.json();
            console.log(`[Adzuna] Found ${data.results?.length || 0} jobs`);

            if (!data.results) return [];

            return (data.results || []).map((item: any) => ({
                fingerprint: `adzuna-${item.id}`,
                company_name: item.company?.display_name || "Unknown Company",
                role_category: 'engineering',
                seniority_band: 'mid',
                location_type: 'onsite',
                location_name: item.location?.display_name || "Unknown",
                source_url: item.redirect_url,
                source_type: 'ADZUNA_API',
                ats_provider: 'adzuna',
                external_id: item.id.toString(),
                is_direct_ats: false,
                confidence_tier: 'low',
                quality_score: 0.7,
                discovery_method: 'API',
                last_verified_at: new Date().toISOString()
            }));
        } catch (e) {
            console.error('[ADZUNA] Unexpected error:', e.message);
            return [];
        }
    }
}
