-- ============================================================
-- MIGRATION: 20260405_pipeline_contract_v4_ranking.sql
-- Fixes:
--   - Rewrites match_jobs_v4 and match_jobs_v4_bayesian to properly join
--     the new job_embeddings table structure (which is decoupled from job_pointers/canonical_jobs).
-- ============================================================

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
            AND (j.role_category = p_candidate_role OR to_tsvector('english', j.title) @@ plainto_tsquery('english', p_candidate_role))
    ),
    scored_jobs AS (
        SELECT 
            f.id, f.company_name, f.title, f.role_category, f.source_url, 
            f.required_skills, f.years_required, f.bayesian_boost,
            CASE 
                WHEN f.embedding IS NOT NULL THEN GREATEST(0.0, 1.0 - (f.embedding <=> p_candidate_embedding))::FLOAT
                ELSE 0.1 -- Fallback for un-vectorized jobs
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

CREATE OR REPLACE FUNCTION public.match_jobs_v4_bayesian(
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
    RETURN QUERY SELECT * FROM public.match_jobs_v4(
        p_candidate_role,
        p_candidate_skills,
        p_candidate_experience_years,
        p_candidate_location,
        p_remote_preference,
        p_candidate_embedding,
        p_user_id
    );
END;
$function$;
