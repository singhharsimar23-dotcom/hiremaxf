-- Phase 1: Database Foundation for Omni-US Tech Launch
-- Purpose: Enable state-sharding, bulk ingestion, and storage-safe TTL.

-- 1. Checkpoints for state-sharding
CREATE TABLE IF NOT EXISTS public.system_checkpoints (
    key TEXT PRIMARY KEY,
    value JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO public.system_checkpoints (key, value) 
VALUES ('state_index', '0'::jsonb) 
ON CONFLICT (key) DO NOTHING;

-- 2. User Interaction Tables (Hardening)
CREATE TABLE IF NOT EXISTS public.user_bookmarks (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id UUID NOT NULL, 
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, job_id)
);

-- 3. Bulk Resolution v4 (unnest logic)
CREATE OR REPLACE FUNCTION public.bulk_resolve_pointers_v4(p_jobs jsonb[])
RETURNS TABLE (id UUID, fingerprint TEXT) AS $$
BEGIN
    RETURN QUERY
    INSERT INTO public.job_pointers (
        fingerprint, company_name, title, location_name, 
        source_url, source_type, discovery_method, confidence_tier, 
        raw_payload, request_id, last_checked_at
    )
    SELECT 
        (j->>'fingerprint')::TEXT,
        (j->>'company_name')::TEXT,
        (j->>'title')::TEXT,
        (j->>'location_name')::TEXT,
        (j->>'source_url')::TEXT,
        (j->>'source_type')::TEXT,
        (j->>'discovery_method')::TEXT,
        (j->>'confidence_tier')::TEXT,
        (j->'raw_payload')::JSONB,
        (j->>'request_id')::UUID,
        now()
    FROM unnest(p_jobs) AS j
    ON CONFLICT (fingerprint) DO UPDATE SET
        last_checked_at = EXCLUDED.last_checked_at,
        request_id = EXCLUDED.request_id
    RETURNING public.job_pointers.id, public.job_pointers.fingerprint;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Adaptive Storage Purge v2 (48h TTL)
CREATE OR REPLACE FUNCTION public.purge_stale_data_v2()
RETURNS TABLE (deleted_pointers INT, deleted_docs INT) AS $$
DECLARE
    v_deleted_docs INT;
    v_deleted_pointers INT;
BEGIN
    -- Delete from raw_job_documents
    DELETE FROM public.raw_job_documents
    WHERE job_pointer_id IN (
        SELECT id FROM public.job_pointers 
        WHERE last_checked_at < (NOW() - INTERVAL '7 days')
          AND id NOT IN (SELECT job_id FROM public.user_bookmarks)
          AND id NOT IN (SELECT job_id FROM public.applications)
          AND id NOT IN (SELECT job_pointer_id FROM public.canonical_jobs)
    );
    GET DIAGNOSTICS v_deleted_docs = ROW_COUNT;

    -- Delete from job_pointers
    DELETE FROM public.job_pointers
    WHERE last_checked_at < (NOW() - INTERVAL '7 days')
      AND id NOT IN (SELECT job_id FROM public.user_bookmarks)
      AND id NOT IN (SELECT job_id FROM public.applications)
      AND id NOT IN (SELECT job_pointer_id FROM public.canonical_jobs);
    GET DIAGNOSTICS v_deleted_pointers = ROW_COUNT;

    -- Log the purge
    INSERT INTO public.integrity_events (event_type, source, message, severity, metadata)
    VALUES ('STORAGE_PURGE', 'SYSTEM', 'Purged stale jobs: ' || v_deleted_pointers || ' pointers, ' || v_deleted_docs || ' docs.', 'INFO', 
            jsonb_build_object('pointers', v_deleted_pointers, 'docs', v_deleted_docs));

    RETURN QUERY SELECT v_deleted_pointers, v_deleted_docs;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. GIN Indexes for High-Speed Search
CREATE INDEX IF NOT EXISTS idx_canonical_jobs_title_gin ON public.canonical_jobs USING GIN (to_tsvector('english', normalized_title));
CREATE INDEX IF NOT EXISTS idx_canonical_jobs_location_gin ON public.canonical_jobs USING GIN (to_tsvector('english', COALESCE(normalized_location, '')));

-- 6. Updated match_jobs_deterministic (v2)
CREATE OR REPLACE FUNCTION public.match_jobs_deterministic_v2(
  p_candidate_skills  TEXT[],
  p_experience_years  INT     DEFAULT 3,
  p_remote_preference BOOLEAN DEFAULT false,
  p_location          TEXT    DEFAULT NULL,
  p_limit             INT     DEFAULT 50
)
RETURNS TABLE (
  job_id              UUID,
  normalized_title    TEXT,
  company_name        TEXT,
  normalized_location TEXT,
  location_type       TEXT,
  skills              TEXT[],
  salary_min          NUMERIC,
  salary_max          NUMERIC,
  experience_required INT,
  match_score         NUMERIC,
  skill_overlap_count INT,
  recency_score       NUMERIC,
  is_suspected_spam   BOOLEAN,
  created_at          TIMESTAMPTZ
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT
    cj.id,
    cj.normalized_title,
    c.name,
    cj.normalized_location,
    cj.location_type,
    cj.skills,
    cj.salary_min,
    cj.salary_max,
    cj.experience_required,
    ROUND((
      0.60 * CASE
        WHEN cardinality(p_candidate_skills) = 0 THEN 0.5
        ELSE LEAST(1.0,
          cardinality(ARRAY(SELECT unnest(cj.skills) INTERSECT SELECT unnest(p_candidate_skills)))::NUMERIC
          / NULLIF(cardinality(p_candidate_skills), 0)
        )
      END
      + 0.25 * EXP(-GREATEST(0, EXTRACT(EPOCH FROM (NOW() - cj.created_at)) / 2592000.0))
      + 0.15 * GREATEST(0.0, 1.0 - ABS(COALESCE(cj.experience_required, p_experience_years) - p_experience_years)::NUMERIC / 5.0)
    )::NUMERIC, 4)                                         AS match_score,
    cardinality(ARRAY(SELECT unnest(cj.skills) INTERSECT SELECT unnest(p_candidate_skills))) AS skill_overlap_count,
    ROUND(EXP(-GREATEST(0, EXTRACT(EPOCH FROM (NOW() - cj.created_at)) / 2592000.0))::NUMERIC, 4) AS recency_score,
    cj.is_suspected_spam,
    cj.created_at
  FROM public.canonical_jobs cj
  LEFT JOIN public.companies c ON c.id = cj.company_id
  WHERE cj.is_active = true
    AND cj.is_suspected_spam = false
    AND (
          (p_remote_preference AND cj.location_type = 'remote')
          OR (p_location IS NOT NULL AND (to_tsvector('english', cj.normalized_location) @@ plainto_tsquery('english', p_location) OR cj.location_type = 'remote'))
          OR (p_remote_preference IS FALSE AND p_location IS NULL)
        )
  ORDER BY match_score DESC
  LIMIT p_limit;
END;
$$;

-- 7. match_jobs_v3 (Intelligence-Evidence Alignment)
-- Updates original v3 to leverage 64-dim forensic structured embedding
CREATE OR REPLACE FUNCTION public.match_jobs_v3(
    p_candidate_role TEXT,
    p_candidate_skills TEXT[],
    p_candidate_experience_years INT,
    p_candidate_location TEXT,
    p_remote_preference BOOLEAN,
    p_candidate_embedding VECTOR(1536),
    p_user_id UUID DEFAULT NULL
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
    forensic_boost FLOAT,
    match_score FLOAT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_structured_vector VECTOR(64);
    v_eng_score FLOAT := 0;
    v_ml_score FLOAT := 0;
BEGIN
    -- Fetch 64-dim evidence if user_id provided
    IF p_user_id IS NOT NULL THEN
        SELECT embedding_structured INTO v_structured_vector 
        FROM public.ml_candidate_embeddings WHERE user_id = p_user_id;

        IF v_structured_vector IS NOT NULL THEN
            -- Extract max scores from relevant sectors (simplified extraction)
            v_eng_score := (SELECT MAX(val) FROM unnest(CAST(v_structured_vector AS FLOAT[])) WITH ORDINALITY AS t(val, idx) WHERE idx BETWEEN 1 AND 16);
            v_ml_score  := (SELECT MAX(val) FROM unnest(CAST(v_structured_vector AS FLOAT[])) WITH ORDINALITY AS t(val, idx) WHERE idx BETWEEN 29 AND 40);
        END IF;
    END IF;

    RETURN QUERY
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
            GREATEST(0.0, 1.0 - (f.embedding <=> p_candidate_embedding))::FLOAT AS v_sim,
            CASE 
                WHEN f.skills IS NULL OR jsonb_array_length(f.skills) = 0 THEN 0.0
                ELSE
                    COALESCE((SELECT count(*)::float / GREATEST(jsonb_array_length(f.skills), 1) FROM jsonb_array_elements_text(f.skills) AS job_skill WHERE job_skill IN (SELECT skill FROM candidate_skills)), 0.0)::FLOAT
            END AS s_overlap
        FROM filtered_jobs f
    )
    SELECT 
        id as job_id, company_id, title, normalized_role, work_mode, location_raw, source_url, source_platform, dedupe_hash, created_at, skills, experience_min, experience_max, 
        v_sim AS vector_similarity, 
        s_overlap AS skill_overlap_ratio,
        (CASE 
            WHEN normalized_role IN ('Software Engineer', 'DevOps', 'Infrastructure') THEN v_eng_score * 0.15
            WHEN normalized_role IN ('ML Engineer', 'Data Scientist', 'AI Researcher') THEN v_ml_score * 0.15
            ELSE 0.0
        END)::FLOAT AS forensic_boost,
        (v_sim * 0.6 + s_overlap * 0.3 + (CASE 
            WHEN normalized_role IN ('Software Engineer', 'DevOps', 'Infrastructure') THEN v_eng_score * 0.1
            WHEN normalized_role IN ('ML Engineer', 'Data Scientist', 'AI Researcher') THEN v_ml_score * 0.1
            ELSE 0.0
        END))::FLOAT AS match_score
    FROM scored_jobs
    ORDER BY match_score DESC
    LIMIT 200;
END;
$$;
