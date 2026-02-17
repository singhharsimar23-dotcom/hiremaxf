import { supabase } from './supabase';

export type GovernorMode = 'FULL' | 'CONTROLLED' | 'SAFE' | 'READ_ONLY';

export interface NormalizedIntent {
    role_normalized: string;
    seniority: string;
    location_raw: string;
    location_bucket: string;
    location_confidence: number;
    confidence_flag: 'OK' | 'LOW_CONFIDENCE' | 'FALLBACK';
    timestamp: string;
    intent_id?: string;
}

export interface ClusterResolution {
    cluster_id: string;
    cluster_bucket: string;
    status: string;
}

export interface JobPointer {
    job_id: string;
    company: string;
    role: string;
    location: string;
    source: string;
    source_url?: string; // Added for correct linking
    pointer_status: string;
    fingerprint?: string;
}

export interface MaterializedJob {
    full_description: string;
    verified_source_url: string;
}

export interface MatchAnalysis {
    role_alignment: 'strong' | 'moderate' | 'weak' | 'misaligned' | 'unknown';
    skill_coverage_pct: number;
    experience_fit: string;
    domain_relevance: string;
    strengths: string[];
    gaps: string[];
    analysis_confidence: number;
    rationale: string;
    cached?: boolean;
    fallback?: boolean;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/**
 * Standardized interface for the Job Intelligence Engine API.
 * Maps to the production Edge Functions in the /v1/ namespace.
 */
export const ApiEngine = {
    /**
     * Retrieves the system's current safety state.
     */
    async getGovernorStatus(): Promise<GovernorMode> {
        const { data, error } = await supabase
            .from('governor_state')
            .select('current_mode')
            .single();

        if (error || !data) return 'READ_ONLY';
        return data.current_mode as GovernorMode;
    },

    /**
     * INTENT SUBMISSION: POST /v1/intent/resolve
     */
    async resolveIntent(payload: Partial<NormalizedIntent>, signal?: AbortSignal): Promise<NormalizedIntent> {
        return this.invokeEngine('/intent/resolve', 'POST', payload, signal);
    },

    /**
     * CLUSTER RESOLUTION: GET /v1/user-clustering/resolve
     */
    async resolveCluster(intent: NormalizedIntent, signal?: AbortSignal): Promise<ClusterResolution> {
        return this.invokeEngine('/user-clustering/resolve', 'GET', {
            intent_id: intent.intent_id,
            location_bucket: intent.location_bucket
        }, signal);
    },

    /**
     * PREVIEW JOB POINTERS: GET /v1/job-pointers/by-cluster
     */
    async fetchJobPointers(clusterId: string, intent?: NormalizedIntent, signal?: AbortSignal): Promise<JobPointer[]> {
        const params: any = { cluster_id: clusterId };
        if (intent) {
            params.role = intent.role_normalized;
            params.location = intent.location_bucket;
        }
        return this.invokeEngine('/job-pointers/by-cluster', 'GET', params, signal);
    },

    /**
     * MATERIALIZATION: POST /v1/materialize-job
     */
    async materializeJob(jobId: string): Promise<MaterializedJob> {
        const mode = await this.getGovernorStatus();
        if (mode === 'READ_ONLY' || mode === 'SAFE') {
            throw new Error(`SYSTEM_GOVERNOR_BLOCK: Materialization forbidden in ${mode} mode`);
        }

        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;

        const response = await fetch(`${SUPABASE_URL}/functions/v1/materialize-job`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
            },
            body: JSON.stringify({ job_id: jobId })
        });

        if (!response.ok) {
            const errorText = await response.text();
            let msg = `Materialization failed: ${response.status}`;
            try { const d = JSON.parse(errorText); msg = d.error || d.reason || msg; } catch { }
            throw new Error(msg);
        }

        const result = await response.json();
        if (!result.success) throw new Error(result.error || result.reason || "Materialization failed");

        return {
            full_description: result.full_description,
            verified_source_url: result.verified_source_url
        };
    },

    /**
     * EXECUTION REGISTRY: GET /execution-engine?action=/list-applications
     */
    async fetchApplications(userId: string): Promise<JobPointer[]> {
        return this.invokeEngine('/list-applications', 'GET', { user_id: userId }, undefined, 'execution-engine');
    },

    /**
     * TRIGGER APPLICATION: POST /execution-engine/submit-application
     */
    async triggerApplication(applicationId: string, userId: string): Promise<any> {
        return this.invokeEngine('/submit-application', 'POST', { application_id: applicationId, user_id: userId }, undefined, 'execution-engine');
    },

    /**
     * KILL ZONE ANALYSIS: POST /execution-engine/analyze-kill-zone
     */
    async analyzeKillZone(jobId: string, userId: string): Promise<any> {
        return this.invokeEngine('/analyze-kill-zone', 'POST', { job_id: jobId, user_id: userId }, undefined, 'execution-engine');
    },

    /**
     * MATCH ANALYSIS: POST /v1/match-analyst (Gemini-powered, advisory only)
     * Now follows an async lifecycle: Inserts record -> Returns ID -> Worker processes.
     */
    async analyzeMatch(jobId: string, userId: string, jobDescription: string, jobTitle: string, jobCompany: string): Promise<{ id: string }> {
        // 1. Insert PENDING record to anchor the UI state
        const { data, error } = await supabase
            .from('match_analysis')
            .insert({
                user_id: userId,
                job_id: jobId,
                status: 'PENDING'
            })
            .select('id')
            .single();

        if (error) throw error;
        const analysisId = data.id;

        // 2. Dispatch worker (Fire and Forget)
        this.invokeEngine('', 'POST', {
            user_id: userId,
            job_id: jobId,
            job_description: jobDescription,
            job_title: jobTitle,
            job_company: jobCompany,
            analysis_id: analysisId
        }, undefined, 'match-analyst').catch(err => {
            console.warn("[API_ENGINE] Worker trigger failed (may be handled by retry logic):", err);
        });

        return { id: analysisId };
    },

    /**
     * Retrieves a specific match analysis by ID.
     */
    async fetchMatchAnalysis(analysisId: string): Promise<any> {
        const { data, error } = await supabase
            .from('match_analysis')
            .select('*')
            .eq('id', analysisId)
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * INGEST AI PROFILE: POST /v1/ingest-ai-layer
     * Wires the frontend to the AI Ingestion Layer for resume parsing/skill extraction.
     */
    async ingestProfile(userId: string, rawSkills: any[], profileContext: any): Promise<any> {
        return this.invokeEngine('', 'POST', {
            user_id: userId,
            raw_skills: rawSkills,
            profile_context: profileContext
        }, undefined, 'ingest-ai-layer');
    },

    /**
     * Enhanced universal function invoker.
     */
    async invokeEngine(path: string, method: 'GET' | 'POST', body?: any, signal?: AbortSignal, functionName: string = 'hiring-engine'): Promise<any> {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;

        const url = new URL(`${SUPABASE_URL}/functions/v1/${functionName}${path}`);
        if (method === 'GET' && body) {
            Object.entries(body).forEach(([k, v]) => url.searchParams.append(k, String(v)));
        }

        const response = await fetch(url.toString(), {
            method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
            },
            body: method === 'POST' ? JSON.stringify({ ...body, action: path }) : undefined,
            signal
        });

        if (!response.ok) {
            const errorText = await response.text();
            let msg = `Engine call failed: ${response.status}`;
            try { const d = JSON.parse(errorText); msg = d.error || msg; } catch { }
            throw new Error(msg);
        }

        return response.json();
    }
};
