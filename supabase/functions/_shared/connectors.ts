import { JobPointer } from "./types.ts";

export class GreenhouseConnector {
    /**
     * Hardened fetcher for Greenhouse Boards API.
     */
    static async fetch(companyId: string, token: string): Promise<JobPointer[]> {
        const url = `https://boards-api.greenhouse.io/v1/boards/${token}/jobs`;

        try {
            const resp = await fetch(url);
            if (!resp.ok) {
                console.error(`[GREENHOUSE] HTTP_${resp.status} for ${token}`);
                return [];
            }

            const data = await resp.json();
            const rawJobs: any[] = data.jobs || [];

            return rawJobs
                .filter(j => this.isUSTech(j))
                .map(j => ({
                    company_id: companyId,
                    role_category: this.mapRole(j.title || ""),
                    seniority_band: this.mapSeniority(j.title || ""),
                    location_type: (j.location?.name || "").toUpperCase().includes('REMOTE') ? 'REMOTE' : 'ONSITE',
                    source_url: j.absolute_url || "",
                    source_type: 'GREENHOUSE',
                    confidence_tier: 'high',
                    quality_score: 0.95,
                    discovery_method: 'API_POLL',
                    fingerprint: "" // Computed later by StorageManager
                }));
        } catch (error: any) {
            console.error(`[GREENHOUSE_FETCH_ERROR]: ${error.message}`);
            return [];
        }
    }

    private static isUSTech(job: any): boolean {
        const title = (job.title || "").toLowerCase();
        const location = (job.location?.name || "").toLowerCase();

        const isUS = location.includes('united states') || location.includes('usa') || location.includes('remote');
        const isTech = /(software|engineer|developer|data|ml|ai|devops|cloud|backend|frontend|fullstack|product|security)/.test(title);

        return isUS && isTech;
    }

    private static mapRole(title: string): string {
        const t = title.toLowerCase();
        if (t.includes('backend')) return 'BACKEND';
        if (t.includes('frontend')) return 'FRONTEND';
        if (t.includes('data')) return 'DATA';
        if (t.includes('product')) return 'PRODUCT';
        return 'GENERAL_TECH';
    }

    private static mapSeniority(title: string): string {
        const t = title.toLowerCase();
        if (t.includes('senior')) return 'SENIOR';
        if (t.includes('staff') || t.includes('principal')) return 'STAFF';
        if (t.includes('junior')) return 'JUNIOR';
        return 'MID';
    }
}

export class LeverConnector {
    /**
     * Hardened fetcher for Lever Postings API.
     */
    static async fetch(companyId: string, token: string): Promise<JobPointer[]> {
        const url = `https://api.lever.co/v0/postings/${token}?mode=json`;

        try {
            const resp = await fetch(url);
            if (!resp.ok) {
                console.error(`[LEVER] HTTP_${resp.status} for ${token}`);
                return [];
            }

            const data = await resp.json();
            const postings: any[] = Array.isArray(data) ? data : [];

            return postings
                .filter(p => this.isUSTech(p))
                .map(p => ({
                    company_id: companyId,
                    role_category: this.mapRole(p.text || ""),
                    seniority_band: this.mapSeniority(p.text || ""),
                    location_type: (p.categories?.location || "").toUpperCase().includes('REMOTE') ? 'REMOTE' : 'ONSITE',
                    source_url: p.hostedUrl || "",
                    source_type: 'LEVER',
                    confidence_tier: 'high',
                    quality_score: 0.95,
                    discovery_method: 'API_POLL',
                    fingerprint: "" // Computed later
                }));
        } catch (error: any) {
            console.error(`[LEVER_FETCH_ERROR]: ${error.message}`);
            return [];
        }
    }

    private static isUSTech(post: any): boolean {
        const text = (post.text || "").toLowerCase();
        const location = (post.categories?.location || "").toLowerCase();

        const isUS = location.includes('united states') || location.includes('usa') || location.includes('remote');
        const isTech = /(engineer|developer|data|product|security)/.test(text);

        return isUS && isTech;
    }

    private static mapRole(text: string): string {
        const t = text.toLowerCase();
        if (t.includes('backend')) return 'BACKEND';
        return 'GENERAL_TECH';
    }

    private static mapSeniority(text: string): string {
        if (text.toLowerCase().includes('senior')) return 'SENIOR';
        return 'MID';
    }
}
