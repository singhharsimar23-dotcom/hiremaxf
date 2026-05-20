-- Migration: Candidate Intelligence & Vector Schema
-- Derived from db-fix/index.ts

CREATE INDEX IF NOT EXISTS idx_jobs_embedding_hnsw ON public.jobs USING hnsw (embedding vector_cosine_ops);

-- match_jobs_v3: Deterministic and Semantic Job Matching
CREATE OR REPLACE FUNCTION public.match_jobs_v3(
    p_candidate_role TEXT,
    p_candidate_skills TEXT[],
    p_candidate_experience_years INT,
    p_candidate_location TEXT,
    p_remote_preference BOOLEAN,
    p_candidate_embedding VECTOR(1536)
)
RETURNS TABLE (
    job_id UUID,
    company_id UUID,
    title TEXT,
    normalized_role TEXT,
    work_mode TEXT,
    location_raw TEXT,
    source_url TEXT,
    source_platform TEXT,
    dedupe_hash TEXT,
    created_at TIMESTAMPTZ,
    skills JSONB,
    experience_min INT,
    experience_max INT,
    vector_similarity FLOAT,
    skill_overlap_ratio FLOAT,
    match_score FLOAT
)
LANGUAGE sql
STABLE
AS $$
    WITH candidate_skills AS (
        SELECT unnest(p_candidate_skills) AS skill
    ),
    filtered_jobs AS (
        SELECT 
            j.id, j.company_id, j.title, j.normalized_role, j.work_mode, j.location_raw, j.source_url, j.source_platform, j.dedupe_hash, j.created_at, j.skills, j.experience_min, j.experience_max, j.embedding
        FROM public.jobs j
        WHERE j.status = 'ACTIVE'
            AND (j.normalized_role = p_candidate_role OR to_tsvector('english', j.title) @@ plainto_tsquery('english', p_candidate_role))
            AND ((p_remote_preference AND j.work_mode = 'remote') OR j.location_raw ILIKE '%' || p_candidate_location || '%' OR (p_candidate_location IS NULL OR p_candidate_location = ''))
    ),
    scored_jobs AS (
        SELECT 
            f.id, f.company_id, f.title, f.normalized_role, f.work_mode, f.location_raw, f.source_url, f.source_platform, f.dedupe_hash, f.created_at, f.skills, f.experience_min, f.experience_max,
            GREATEST(0.0, 1.0 - (f.embedding <=> p_candidate_embedding))::FLOAT AS vector_similarity,
            CASE 
                WHEN f.skills IS NULL OR jsonb_array_length(f.skills) = 0 THEN 0.0
                ELSE
                    COALESCE((SELECT count(*)::float / GREATEST(jsonb_array_length(f.skills), 1) FROM jsonb_array_elements_text(f.skills) AS job_skill WHERE job_skill IN (SELECT skill FROM candidate_skills)), 0.0)::FLOAT
            END AS skill_overlap_ratio
        FROM filtered_jobs f
    )
    SELECT id as job_id, company_id, title, normalized_role, work_mode, location_raw, source_url, source_platform, dedupe_hash, created_at, skills, experience_min, experience_max, vector_similarity, skill_overlap_ratio, (vector_similarity * 0.7 + skill_overlap_ratio * 0.3)::FLOAT AS match_score
    FROM scored_jobs
    ORDER BY match_score DESC
    LIMIT 200;
$$;

-- candidate_feature_vectors: Principal Engineer Audit Scores
CREATE TABLE IF NOT EXISTS public.candidate_feature_vectors (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    system_design_depth FLOAT DEFAULT 0.0,
    distributed_systems_experience FLOAT DEFAULT 0.0,
    data_pipeline_experience FLOAT DEFAULT 0.0,
    machine_learning_experience FLOAT DEFAULT 0.0,
    open_source_activity FLOAT DEFAULT 0.0,
    project_complexity FLOAT DEFAULT 0.0,
    technical_depth FLOAT DEFAULT 0.0,
    seniority_score FLOAT DEFAULT 0.0,
    domain_expertise FLOAT DEFAULT 0.0,
    capability_vector VECTOR(5),
    last_extracted_at TIMESTAMPTZ DEFAULT now()
);

-- get_candidate_intelligence: Consolidated Intelligence Profile
CREATE OR REPLACE FUNCTION public.get_candidate_intelligence(p_user_id UUID)
RETURNS TABLE (snapshot_data JSONB, embedding_text TEXT, embedding_confidence FLOAT, features JSONB)
LANGUAGE sql
SECURITY DEFINER
AS $$
    WITH latest_snapshot AS (SELECT snapshot_data FROM public.profile_snapshots WHERE user_id = p_user_id ORDER BY version DESC LIMIT 1),
    ml_embeds AS (SELECT embedding::text AS embedding_text, confidence_score FROM public.ml_candidate_embeddings WHERE user_id = p_user_id),
    cand_features AS (SELECT to_jsonb(cfv) AS features FROM public.candidate_feature_vectors cfv WHERE user_id = p_user_id)
    SELECT (SELECT snapshot_data FROM latest_snapshot) AS snapshot_data, (SELECT embedding_text FROM ml_embeds) AS embedding_text, COALESCE((SELECT confidence_score FROM ml_embeds), 0.0) AS embedding_confidence, (SELECT features FROM cand_features) AS features;
$$;
