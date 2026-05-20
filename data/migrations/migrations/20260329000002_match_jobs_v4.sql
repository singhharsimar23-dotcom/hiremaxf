-- Phase 2: Advanced Math Ranking (match_jobs_v4)
-- Never hard filter matches. Final Score = Relevance Score * Causal Penalty Factor.
-- Expose Strategic Risk Indicator (HIGH PROB, REACH, EXTREME REACH).

CREATE OR REPLACE FUNCTION public.match_jobs_v4(
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
    company_name TEXT,
    title TEXT,
    normalized_role TEXT,
    work_mode TEXT,
    location_raw TEXT,
    source_url TEXT,
    skills JSONB,
    experience_min INT,
    experience_max INT,
    
    -- Telemetry
    vector_similarity FLOAT,
    skill_overlap_ratio FLOAT,
    causal_penalty_factor FLOAT,
    bayesian_prior_boost FLOAT,
    
    -- Output Core
    base_relevance_score FLOAT,
    final_rank_score FLOAT,
    strategic_risk_indicator TEXT -- 'HIGH_PROBABILITY', 'REACH', 'EXTREME_REACH'
)
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_structured_vector VECTOR(64);
    v_eng_score FLOAT := 0;
    v_ml_score FLOAT := 0;
BEGIN
    -- [1] User Forensic Context
    IF p_user_id IS NOT NULL THEN
        SELECT embedding_structured INTO v_structured_vector 
        FROM public.ml_candidate_embeddings WHERE user_id = p_user_id;

        IF v_structured_vector IS NOT NULL THEN
            v_eng_score := (SELECT MAX(val) FROM unnest(CAST(v_structured_vector AS FLOAT[])) WITH ORDINALITY AS t(val, idx) WHERE idx BETWEEN 1 AND 16);
            v_ml_score  := (SELECT MAX(val) FROM unnest(CAST(v_structured_vector AS FLOAT[])) WITH ORDINALITY AS t(val, idx) WHERE idx BETWEEN 29 AND 40);
        END IF;
    END IF;

    RETURN QUERY
    WITH candidate_skills AS (
        SELECT unnest(p_candidate_skills) AS skill
    ),
    filtered_jobs AS (
        -- No hard limits on experience, only pre-filter severely bad semantic mismatches if necessary
        SELECT 
            j.id, c.name as company_name, j.title, j.normalized_role, j.work_mode, j.location_raw, j.source_url, 
            j.skills, j.experience_min, j.experience_max, j.embedding,
            -- Add bayesian company score if existing (Fallback 0 for new companies)
            COALESCE(c.bayesian_callback_rate, 0.05) AS bayesian_boost
        FROM public.jobs j
        LEFT JOIN public.companies c ON c.id = j.company_id
        WHERE j.status = 'ACTIVE'
            AND (j.normalized_role = p_candidate_role OR to_tsvector('english', j.title) @@ plainto_tsquery('english', p_candidate_role))
    ),
    scored_jobs AS (
        SELECT 
            f.id, f.company_name, f.title, f.normalized_role, f.work_mode, f.location_raw, f.source_url, 
            f.skills, f.experience_min, f.experience_max, f.bayesian_boost,
            
            -- Vector Similarity [0, 1]
            GREATEST(0.0, 1.0 - (f.embedding <=> p_candidate_embedding))::FLOAT AS v_sim,
            
            -- Skill Density Ratio
            CASE 
                WHEN f.skills IS NULL OR jsonb_array_length(f.skills) = 0 THEN 0.0
                ELSE
                    COALESCE((SELECT count(*)::float / GREATEST(jsonb_array_length(f.skills), 1) FROM jsonb_array_elements_text(f.skills) AS job_skill WHERE job_skill IN (SELECT skill FROM candidate_skills)), 0.0)::FLOAT
            END AS s_overlap,
            
            -- Causal Penalty Calculation (Exponential drop if missing years, mild logic if overqualified)
            CASE
                WHEN f.experience_min IS NOT NULL AND p_candidate_experience_years < f.experience_min THEN
                    -- EXP penalty based on gap. E.g., req 7, have 3. Diff = 4. e^(-0.5 * 4) ~ 0.13 penalty multiplier.
                    EXP(-0.5 * (f.experience_min - p_candidate_experience_years))::FLOAT
                WHEN f.experience_max IS NOT NULL AND p_candidate_experience_years > f.experience_max THEN
                    -- Mild penalty for overqualified
                    EXP(-0.2 * (p_candidate_experience_years - f.experience_max))::FLOAT
                ELSE 1.0 -- Perfect fit
            END AS c_penalty
            
        FROM filtered_jobs f
    ),
    final_output AS (
        SELECT 
            id, company_name, title, normalized_role, work_mode, location_raw, source_url, skills, experience_min, experience_max,
            v_sim, s_overlap, c_penalty, bayesian_boost,
            
            -- Base Relevance Score: pure semantic + skill overlap
            (v_sim * 0.7 + s_overlap * 0.3)::FLOAT AS base_score
        FROM scored_jobs
    )
    SELECT 
        fo.id as job_id, fo.company_name, fo.title, fo.normalized_role, fo.work_mode, fo.location_raw, fo.source_url, 
        fo.skills, fo.experience_min, fo.experience_max,
        fo.v_sim AS vector_similarity, 
        fo.s_overlap AS skill_overlap_ratio,
        fo.c_penalty AS causal_penalty_factor,
        fo.bayesian_boost AS bayesian_prior_boost,
        
        fo.base_score AS base_relevance_score,
        
        -- Final math incorporating the causal penalizer and explicit bayesian lift
        (fo.base_score * fo.c_penalty + (fo.bayesian_boost * 0.1))::FLOAT AS final_rank_score,
        
        -- Strategic Risk Indicator (Expose, don't hide)
        CASE
            WHEN fo.base_score > 0.75 AND fo.c_penalty >= 0.8 THEN 'HIGH_PROBABILITY'
            WHEN fo.base_score > 0.60 AND fo.c_penalty >= 0.4 THEN 'REACH'
            ELSE 'EXTREME_REACH'
        END AS strategic_risk_indicator
    FROM final_output fo
    ORDER BY final_rank_score DESC
    LIMIT 200;
END;
$$;
