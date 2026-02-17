import { JobPointer } from "./types.ts";

export class RemotiveConnector {
    private static BASE_URL = 'https://remotive.com/api/remote-jobs?category=software-dev';

    static async fetchJobs(): Promise<JobPointer[]> {
        try {
            const res = await fetch(this.BASE_URL);
            if (!res.ok) return [];
            const data = await res.json();

            return (data.jobs || []).map((item: any) => ({
                fingerprint: `remotive-${item.id}`,
                company_name: item.company_name,
                role_category: 'engineering',
                seniority_band: 'mid',
                location_type: 'remote',
                location_name: item.candidate_required_location,
                source_url: item.url,
                source_type: 'REMOTIVE_API',
                ats_provider: 'remotive',
                external_id: item.id.toString(),
                is_direct_ats: false,
                confidence_tier: 'medium',
                quality_score: 0.95,
                discovery_method: 'API',
                last_verified_at: new Date().toISOString()
            }));
        } catch (e) {
            console.error('[REMOTIVE] Error:', e);
            return [];
        }
    }
}
