import { JobPointer } from "./types.ts";

export class ReedConnector {
    private static API_KEY = Deno.env.get('REED_API_KEY') || '';

    static async fetchJobs(identifier?: string): Promise<JobPointer[]> {
        if (!this.API_KEY) return [];

        let keywords = 'developer';
        let location = '';

        if (identifier) {
            const parts = identifier.split(':');
            keywords = parts[0] || keywords;
            location = parts[1] || '';
        }

        const baseUrl = `https://www.reed.co.uk/api/1.0/search?keywords=${encodeURIComponent(keywords)}${location ? `&locationName=${encodeURIComponent(location)}` : ''}`;

        console.log(`[Reed] Fetching keyword: ${keywords}, location: ${location || 'NONE'}`);

        try {
            const response = await fetch(baseUrl, {
                headers: {
                    'Authorization': 'Basic ' + btoa(this.API_KEY + ':')
                }
            });

            if (!response.ok) {
                console.error(`[Reed] API Error: ${response.status} ${response.statusText}`);
                return [];
            }

            const data = await response.json();
            console.log(`[Reed] Found ${data.results?.length || 0} jobs`);

            if (!data.results) return [];

            return (data.results || []).map((item: any) => ({
                fingerprint: `reed-${item.jobId}`,
                company_name: item.employerName,
                role_category: 'engineering',
                seniority_band: 'mid',
                location_type: 'onsite',
                location_name: item.locationName,
                source_url: item.jobUrl,
                source_type: 'REED_API',
                ats_provider: 'reed',
                external_id: item.jobId.toString(),
                is_direct_ats: false,
                confidence_tier: 'medium',
                quality_score: 0.85,
                discovery_method: 'API',
                last_verified_at: new Date().toISOString()
            }));
        } catch (e) {
            console.error('[REED] Unexpected error:', e.message);
            return [];
        }
    }
}
