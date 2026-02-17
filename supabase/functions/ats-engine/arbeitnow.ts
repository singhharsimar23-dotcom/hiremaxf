import { JobPointer } from "./types.ts";

export class ArbeitnowConnector {
    private static BASE_URL = 'https://arbeitnow.com/api/job-board-api';

    static async fetchJobs(): Promise<JobPointer[]> {
        try {
            const res = await fetch(this.BASE_URL);
            if (!res.ok) return [];
            const data = await res.json();

            return (data.data || []).map((item: any) => ({
                fingerprint: `arbeitnow-${item.slug}`,
                company_name: item.company_name,
                role_category: 'engineering',
                seniority_band: 'mid',
                location_type: item.remote ? 'remote' : 'onsite',
                location_name: item.location,
                source_url: item.url,
                source_type: 'ARBEITNOW_API',
                ats_provider: 'arbeitnow',
                external_id: item.slug,
                is_direct_ats: false,
                confidence_tier: 'medium',
                quality_score: 0.9,
                discovery_method: 'API',
                last_verified_at: new Date().toISOString()
            }));
        } catch (e) {
            console.error('[ARBEITNOW] Error:', e);
            return [];
        }
    }
}
