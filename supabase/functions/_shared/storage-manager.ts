import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { JobPointer } from "./types.ts"

export class StorageManager {
    constructor(private supabase: SupabaseClient) { }

    /**
     * Generates a deterministic SHA-256 fingerprint for a job posting.
     */
    async generateFingerprint(job: Partial<JobPointer>): Promise<string> {
        const raw = `${job.company_id}-${job.role_category}-${job.location_type}-${job.source_url}`.toLowerCase();
        const encoder = new TextEncoder();
        const data = encoder.encode(raw);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Saves or updates a job pointer with automated fingerprinting.
     */
    async upsertJobPointer(job: JobPointer): Promise<JobPointer> {
        const fingerprint = await this.generateFingerprint(job);

        const { data, error } = await this.supabase
            .from('job_pointers')
            .upsert({
                ...job,
                fingerprint,
                updated_at: new Date().toISOString(),
                validation_status: job.validation_status || 'VERIFIED',
                last_verified_at: new Date().toISOString()
            }, {
                onConflict: 'fingerprint'
            })
            .select()
            .single();

        if (error) throw new Error(`STORAGE_UPSERT_FAILED: ${error.message}`);
        if (!data) throw new Error("STORAGE_UPSERT_RETURNED_NULL");

        return data as JobPointer;
    }
}
