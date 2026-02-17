import { JobPointer } from "./types.ts";

export class UsajobsConnector {
    private static API_KEY = Deno.env.get('USAJOBS_API_KEY') || '';
    private static BASE_URL = 'https://data.usajobs.gov/api/search';

    static async fetchJobs(keyword: string = 'software'): Promise<JobPointer[]> {
        if (!this.API_KEY) {
            console.warn('[USAJOBS] Missing API Key');
            return [];
        }

        try {
            const url = `${this.BASE_URL}?Keyword=${encodeURIComponent(keyword)}&ResultLimit=500`;
            const res = await fetch(url, {
                headers: {
                    "User-Agent": "hprad@hiremax.com", // Valid email required by USAJOBS
                    "Authorization-Key": this.API_KEY
                }
            });

            if (!res.ok) return [];
            const data = await res.json();

            return (data.SearchResult?.SearchResultItems || []).map((item: any) => ({
                fingerprint: `usajobs-${item.MatchedObjectId}`,
                company_name: item.MatchedObjectDescriptor.OrganizationName,
                role_category: 'government_tech',
                seniority_band: item.MatchedObjectDescriptor.JobGrade[0]?.Code || 'mid',
                location_type: 'onsite',
                location_name: item.MatchedObjectDescriptor.PositionLocation[0]?.LocationName,
                source_url: item.MatchedObjectDescriptor.PositionURI,
                source_type: 'USAJOBS_API',
                ats_provider: 'usajobs',
                external_id: item.MatchedObjectId,
                is_government: true,
                confidence_tier: 'high',
                quality_score: 1.0,
                discovery_method: 'API',
                last_verified_at: new Date().toISOString()
            }));

        } catch (e) {
            console.error('[USAJOBS] Error:', e);
            return [];
        }
    }
}
