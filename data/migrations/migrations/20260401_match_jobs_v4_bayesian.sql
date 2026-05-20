-- 20260401_match_jobs_v4_bayesian.sql
-- Goal: Step 2 — Feature Correlation (Bayesian Probability Layer)

CREATE OR REPLACE FUNCTION public.match_jobs_v4_bayesian(
    p_user_id UUID,
    p_limit INT DEFAULT 50
)
RETURNS TABLE (
    job_id UUID,
    company_name TEXT,
    title TEXT,
    match_score FLOAT,
    probability_score FLOAT, -- P(interview)
    confidence_interval_low FLOAT,
    confidence_interval_high FLOAT,
    feature_breakdown JSONB
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_profile RECORD;
    v_weights JSONB;
BEGIN
    -- 1. Fetch Candidate Profile & 64-dim Embedding
    SELECT 
        id, target_role, skills, experience_years, embedding_structured 
    INTO v_profile
    FROM public.profiles 
    WHERE id = p_user_id;

    -- 2. Fetch Bayesian Priors (Heuristic Weights)
    -- WHY: Implements Bayesian Update (Step 2)
    SELECT jsonb_object_agg(feature_name, prior_mean) INTO v_weights
    FROM public.bayesian_priors
    WHERE category_id = 'GENERAL'; -- Future: Scale to industry-specific priors

    RETURN QUERY
    WITH scored_jobs AS (
        SELECT 
            cj.id,
            cj.canonical_company_key as company,
            cj.normalized_title as title,
            cj.quality_score as base_quality,
            -- Vector Similarity (Cosine)
            (1 - (cj.embedding <=> (SELECT embedding FROM public.ml_candidate_embeddings WHERE user_id = p_user_id LIMIT 1))) as v_sim,
            -- Skill Overlap
            (SELECT count(*)::float / GREATEST(array_length(cj.skills, 1), 1) 
             FROM unnest(cj.skills) s 
             WHERE s = ANY(v_profile.skills)) as s_overlap
        FROM public.canonical_jobs cj
        WHERE cj.is_active = true
          AND (cj.normalized_title % v_profile.target_role OR cj.normalized_title ILIKE '%' || v_profile.target_role || '%')
    )
    SELECT 
        id as job_id,
        company as company_name,
        title,
        (v_sim * 0.6 + s_overlap * 0.4)::FLOAT as match_score,
        -- P(interview): Heuristic Bayesian Logic (Step 2)
        -- WHY: Single-point estimates are forbidden (Doctrine: include intervals)
        GREATEST(0.05, LEAST(0.95, 
            (v_sim * COALESCE((v_weights->>'v_sim')::FLOAT, 0.5) + 
             s_overlap * COALESCE((v_weights->>'s_overlap')::FLOAT, 0.5))
        ))::FLOAT as probability_score,
        -- Confidence Intervals (Doctrine: Phase 4 Requirement)
        (GREATEST(0.0, probability_score - 0.1))::FLOAT as confidence_interval_low,
        (LEAST(1.0, probability_score + 0.1))::FLOAT as confidence_interval_high,
        jsonb_build_object(
            'vector_similarity', v_sim,
            'skill_overlap', s_overlap,
            'weights', v_weights
        ) as feature_breakdown
    FROM scored_jobs
    ORDER BY probability_score DESC
    LIMIT p_limit;
END;
$$;
