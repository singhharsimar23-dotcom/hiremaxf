-- ============================================================
-- SYSTEM REPAIR MODE - 10-PHASE FIX
-- ============================================================

BEGIN;

-- 🔥 PHASE 8.1 — ORPHAN CLEANUP
DELETE FROM public.job_pointers
WHERE id NOT IN (
    SELECT job_pointer_id FROM public.raw_job_documents WHERE job_pointer_id IS NOT NULL
);

-- 🔥 PHASE 8.2 — ADD FOREIGN KEY CASCADE
-- If there's an existing constraint, we might need to drop it, but typically it doesn't exist if orphans happened.
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'raw_job_documents_job_pointer_id_fkey') THEN
    ALTER TABLE public.raw_job_documents
    ADD CONSTRAINT raw_job_documents_job_pointer_id_fkey
    FOREIGN KEY (job_pointer_id) REFERENCES public.job_pointers(id) ON DELETE CASCADE;
  END IF;
END $$;


-- 🔥 PHASE 3 — ENFORCE TEXT CONTRACT
UPDATE public.raw_job_documents
SET full_text = COALESCE(raw_payload->>'description', raw_payload->>'content', '')
WHERE full_text IS NULL;

-- If there are still empty strings or nulls that prevent NOT NULL (or if payload had nulls), force coalesce
UPDATE public.raw_job_documents SET full_text = 'NO_DESCRIPTION_PROVIDED' WHERE full_text IS NULL;

ALTER TABLE public.raw_job_documents
ALTER COLUMN full_text SET DEFAULT 'NO_DESCRIPTION_PROVIDED',
ALTER COLUMN full_text SET NOT NULL;

-- 🔥 PHASE 4 — PARSER DEADLOCK RECOVERY
UPDATE public.raw_job_documents
SET parse_status = 'retry',
    parse_attempts = 0
WHERE parse_status = 'processing'
AND last_parsed_at < NOW() - INTERVAL '10 minutes';

-- 🔥 PHASE 5 — EMBEDDING PIPELINE FIX
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'uq_job_embeddings_canonical_job_id') THEN
    ALTER TABLE public.job_embeddings
    ADD CONSTRAINT uq_job_embeddings_canonical_job_id UNIQUE (canonical_job_id);
  END IF;
END $$;

-- 🔥 PHASE 9 — READINESS GATE
ALTER TABLE public.canonical_jobs
ADD COLUMN IF NOT EXISTS is_ready BOOLEAN DEFAULT FALSE;

-- Update existing ready jobs (if any)
UPDATE public.canonical_jobs c
SET is_ready = TRUE
FROM public.job_embeddings e
WHERE e.canonical_job_id = c.id AND c.parse_status = 'parsed';

-- 🔥 PHASE 1 — QUEUE CONCURRENCY FIX (RPCs for SKIP LOCKED)
CREATE OR REPLACE FUNCTION public.checkout_pending_raw_documents(p_limit int)
RETURNS SETOF public.raw_job_documents
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH selected AS (
        SELECT id FROM public.raw_job_documents
        WHERE is_parsed = false
          AND parse_status IN ('pending', 'retry', 'low_quality')
          AND (retry_after IS NULL OR retry_after < now())
          AND parse_attempts < 3
        ORDER BY ingested_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT p_limit
    )
    UPDATE public.raw_job_documents r
    SET parse_status = 'processing',
        parse_attempts = COALESCE(parse_attempts, 0) + 1,
        last_parsed_at = now()
    FROM selected
    WHERE r.id = selected.id
    RETURNING r.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.checkout_pending_embeddings(p_limit int)
RETURNS SETOF public.canonical_jobs
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH selected AS (
        SELECT id FROM public.canonical_jobs
        WHERE needs_embedding = true
          AND parse_status = 'parsed'
        ORDER BY last_seen_at DESC
        FOR UPDATE SKIP LOCKED
        LIMIT p_limit
    )
    UPDATE public.canonical_jobs c
    -- Optional: set a status or lock flag if desired, but we map needs_embedding = false inside the worker.
    -- To prevent concurrent checkout of the SAME row, we just mark needs_embedding = false immediately, 
    -- and if embedding fails, we revert it in the worker. Or add embedding_status = 'processing'.
    -- We will add an embedding_status to canonical_jobs for safer locking.
    SET parse_status = 'embedding_processing' 
    FROM selected
    WHERE c.id = selected.id
    RETURNING c.*;
END;
$$;

-- 🔥 PHASE 2 — ATOMIC INGESTION FIX
CREATE OR REPLACE FUNCTION public.ingest_job_atomic_v2(
    p_company_name text,
    p_title text,
    p_location_name text,
    p_source_url text,
    p_source_type text,
    p_raw_payload jsonb,
    p_fingerprint text,
    p_signal_tier text DEFAULT 'T3'
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
    v_pointer_id uuid;
    v_raw_doc_id uuid;
    v_full_text text;
    v_inserted_pointer boolean := false;
BEGIN
    -- ATOMIC BEGIN (Implicit in plpgsql execution block unless exception occurs)
    
    -- 1. Upsert or Get Pointer
    INSERT INTO public.job_pointers (
        company_name, title, location_name, source_url, source_type, fingerprint, confidence_tier, discovery_method
    ) VALUES (
        p_company_name, p_title, p_location_name, p_source_url, p_source_type, p_fingerprint, 'medium', 'INGEST_V3'
    )
    ON CONFLICT (fingerprint) DO UPDATE 
    SET source_url = EXCLUDED.source_url,
        last_seen_at = now()
    RETURNING id INTO v_pointer_id;
    
    IF v_pointer_id IS NULL THEN
        -- If DO UPDATE somehow bypassed returning (e.g. identical data trigger weirdness), select it manually
        SELECT id INTO v_pointer_id FROM public.job_pointers WHERE fingerprint = p_fingerprint;
    END IF;

    -- 2. Extract full_text from payload
    v_full_text := COALESCE(p_raw_payload->>'description', p_raw_payload->>'content', 'NO_DESCRIPTION_PROVIDED');

    -- 3. Insert Raw Document linked strictly to pointer
    INSERT INTO public.raw_job_documents (
        source_url, source_type, raw_payload, checksum, full_text, job_pointer_id, parse_status, is_parsed, signal_tier
    ) VALUES (
        p_source_url, p_source_type, p_raw_payload, p_fingerprint, v_full_text, v_pointer_id, 'pending', false, p_signal_tier::signal_tier
    )
    RETURNING id INTO v_raw_doc_id;

    RETURN jsonb_build_object(
        'status', 'success',
        'pointer_id', v_pointer_id,
        'raw_job_id', v_raw_doc_id
    );
EXCEPTION WHEN OTHERS THEN
    -- Phase 2 requirement: ROLLBACK on any failure
    RAISE WARNING 'Atomic ingestion failed: %', SQLERRM;
    -- The transaction is automatically rolled back by Postgres when an unhandled exception exits the block,
    -- but we can explicitly raise it to ensure caller knows.
    RAISE EXCEPTION 'Atomic ingestion abort: %', SQLERRM;
END;
$$;

-- 🔥 PHASE 7 — RANKING TRUTH FIX
CREATE OR REPLACE FUNCTION public.match_jobs_v4(
    p_candidate_role text,
    p_candidate_skills text[],
    p_candidate_experience_years integer,
    p_candidate_location text,
    p_remote_preference boolean,
    p_candidate_embedding vector,
    p_user_id uuid DEFAULT NULL::uuid
) RETURNS TABLE(
    job_id uuid,
    company_name text,
    title text,
    role_category text,
    source_url text,
    required_skills text[],
    years_required integer,
    vector_similarity double precision,
    skill_overlap_ratio double precision,
    causal_penalty_factor double precision,
    bayesian_prior_boost double precision,
    base_relevance_score double precision,
    final_rank_score double precision,
    strategic_risk_indicator text
)
LANGUAGE plpgsql
STABLE
AS $function$
BEGIN
    RETURN QUERY
    WITH candidate_skills AS (
        SELECT unnest(p_candidate_skills) AS skill
    ),
    filtered_jobs AS (
        SELECT 
            j.id, j.company_name, j.title, j.role_category, j.source_url, 
            j.required_skills, j.years_required, e.embedding,
            COALESCE(co.bayesian_callback_rate, 0.05) AS bayesian_boost
        FROM public.job_pointers j
        LEFT JOIN public.companies co ON co.id = j.company_id
        LEFT JOIN public.canonical_jobs c ON c.job_pointer_id = j.id
        LEFT JOIN public.job_embeddings e ON e.canonical_job_id = c.id
        WHERE j.validation_status IS NOT NULL
            AND c.is_ready = TRUE -- 🔥 PHASE 9: ONLY USE is_ready = TRUE jobs
            AND (j.role_category = p_candidate_role OR to_tsvector('english', j.title) @@ plainto_tsquery('english', p_candidate_role))
    ),
    scored_jobs AS (
        SELECT 
            f.id, f.company_name, f.title, f.role_category, f.source_url, 
            f.required_skills, f.years_required, f.bayesian_boost,
            -- 🔥 PHASE 7: REMOVE 0.1 fallback, apply -1 for NULL embeddings
            CASE 
                WHEN f.embedding IS NOT NULL THEN GREATEST(0.0, 1.0 - (f.embedding <=> p_candidate_embedding))::FLOAT
                ELSE -1.0 
            END AS v_sim,
            CASE 
                WHEN f.required_skills IS NULL OR array_length(f.required_skills, 1) = 0 THEN 0.0
                ELSE
                    COALESCE((SELECT count(*)::float / GREATEST(array_length(f.required_skills, 1), 1) FROM unnest(f.required_skills) AS job_skill WHERE job_skill IN (SELECT skill FROM candidate_skills)), 0.0)::FLOAT
            END AS s_overlap,
            CASE
                WHEN f.years_required IS NOT NULL AND p_candidate_experience_years < f.years_required THEN
                    EXP(-0.5 * (f.years_required - p_candidate_experience_years))::FLOAT
                ELSE 1.0
            END AS c_penalty
        FROM filtered_jobs f
    ),
    final_output AS (
        SELECT 
            id, company_name, title, role_category, source_url, required_skills, years_required,
            v_sim, s_overlap, c_penalty, bayesian_boost,
            (v_sim * 0.7 + s_overlap * 0.3)::FLOAT AS base_score
        FROM scored_jobs
        WHERE v_sim >= -0.5 -- 🔥 PHASE 7: EXCLUDE heavy penalty non-embeddings natively
    )
    SELECT 
        fo.id as job_id, fo.company_name, fo.title, fo.role_category, fo.source_url, 
        fo.required_skills, fo.years_required,
        fo.v_sim AS vector_similarity, 
        fo.s_overlap AS skill_overlap_ratio,
        fo.c_penalty AS causal_penalty_factor,
        fo.bayesian_boost AS bayesian_prior_boost,
        fo.base_score AS base_relevance_score,
        (fo.base_score * fo.c_penalty + (fo.bayesian_boost * 0.1))::FLOAT AS final_rank_score,
        CASE
            WHEN fo.base_score > 0.75 AND fo.c_penalty >= 0.8 THEN 'HIGH_PROBABILITY'
            WHEN fo.base_score > 0.55 AND fo.c_penalty >= 0.4 THEN 'REACH'
            ELSE 'EXTREME_REACH'
        END AS strategic_risk_indicator
    FROM final_output fo
    ORDER BY final_rank_score DESC
    LIMIT 200;
END;
$function$;

COMMIT;
