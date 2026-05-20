-- 20260213_autonomous_intelligence_upgrade.sql
-- 2040-Grade Autonomous Talent Intelligence Schema

-- 1. SKILL REGISTRY (The Ontology)
CREATE TABLE IF NOT EXISTS public.ml_skill_registry (
    skill_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_name TEXT NOT NULL UNIQUE,
    parent_skill_id UUID REFERENCES public.ml_skill_registry(skill_id),
    skill_category TEXT, -- 'Language', 'Framework', 'Soft Skill'
    ontology_version INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_name ON public.ml_skill_registry(canonical_name);

-- 2. SKILL GRAPH (The Candidate's Knowledge)
CREATE TABLE IF NOT EXISTS public.ml_skill_graph (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    skill_id UUID REFERENCES public.ml_skill_registry(skill_id) ON DELETE CASCADE,
    depth_score FLOAT CHECK (depth_score BETWEEN 0 AND 1),
    temporal_start DATE,
    temporal_end DATE,
    cross_platform_validation_score FLOAT DEFAULT 0.5,
    evidence_source TEXT, -- 'GitHub', 'LinkedIn', 'Resume'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(candidate_id, skill_id, evidence_source)
);

CREATE INDEX IF NOT EXISTS idx_skill_graph_user ON public.ml_skill_graph(candidate_id);

-- 3. CREDIBILITY VECTOR (Trustworthiness)
CREATE TABLE IF NOT EXISTS public.ml_credibility_vector (
    candidate_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    timeline_consistency FLOAT DEFAULT 1.0,
    velocity_stability FLOAT DEFAULT 0.5,
    authority_signal FLOAT DEFAULT 0.0,
    cross_platform_alignment FLOAT DEFAULT 0.5,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TALENT STATE (Holistic 2040 Metric)
CREATE TABLE IF NOT EXISTS public.ml_talent_state (
    candidate_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    capability_index FLOAT,
    market_position_index FLOAT,
    attention_momentum FLOAT,
    optionality_score FLOAT,
    forecast_alignment_score FLOAT,
    credibility_index FLOAT,
    state_version INT DEFAULT 1,
    state_timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 5. SKILL DEMAND FORECAST (Market Intelligence)
CREATE TABLE IF NOT EXISTS public.ml_skill_demand_forecast (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id UUID REFERENCES public.ml_skill_registry(skill_id) ON DELETE CASCADE,
    sector TEXT NOT NULL,
    seniority_level TEXT,
    trend_6m FLOAT, -- Slope of demand
    trend_12m FLOAT,
    volatility_score FLOAT,
    forecast_timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 6. FORECAST ACCURACY (The Audit Trail)
CREATE TABLE IF NOT EXISTS public.ml_forecast_accuracy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id UUID REFERENCES public.ml_skill_registry(skill_id),
    predicted_trend FLOAT,
    realized_trend FLOAT,
    error FLOAT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 7. RECRUITER COGNITIVE MODEL (Bias Modeling)
CREATE TABLE IF NOT EXISTS public.ml_recruiter_cognitive_model (
    company_id UUID REFERENCES public.ml_company_embeddings(company_id) ON DELETE CASCADE PRIMARY KEY,
    attention_threshold FLOAT DEFAULT 0.5,
    prestige_bias_factor FLOAT DEFAULT 0.0,
    cognitive_load_sensitivity FLOAT DEFAULT 0.5,
    bias_vector JSONB DEFAULT '{}'
);

-- 8. SIMULATION RESULTS (Trajectory Planning)
CREATE TABLE IF NOT EXISTS public.ml_simulation_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    strategy_vector JSONB, -- Steps: ['Learn Rust', 'Contribute to Tokio', 'Apply YC']
    projected_offer_probability FLOAT,
    projected_optionality_gain FLOAT,
    simulation_timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 9. DUAL-BRAIN INFERENCE UPGRADE
-- We DO NOT change the synchronous `predict_match_score_v2` significantly.
-- Instead, we add a LIGHTWEIGHT feature lookup from `ml_talent_state`
-- and `ml_credibility_vector` to the existing context.

-- Update V2 Function via wrapper or direct modification?
-- Wrapper is safer to preserve V2 deterministic core.

CREATE OR REPLACE FUNCTION public.predict_autonomous_score(
    p_user_id UUID,
    p_company_name TEXT
) RETURNS JSONB AS $$
DECLARE
    base_prob FLOAT;
    cred_score FLOAT;
    talent_state public.ml_talent_state%ROWTYPE;
    final_prob FLOAT;
    
    -- Governance
    ai_influence_cap FLOAT := 0.3; -- Max +/- 30% swing
    ai_modifier FLOAT := 0.0;
BEGIN
    -- 1. Get Deterministic Core Score
    base_prob := public.predict_match_score_v2(p_user_id, p_company_name);
    
    -- 2. Fetch AI Layer Data
    SELECT * INTO talent_state FROM public.ml_talent_state WHERE candidate_id = p_user_id;
    SELECT timeline_consistency INTO cred_score FROM public.ml_credibility_vector WHERE candidate_id = p_user_id;
    
    IF cred_score IS NULL THEN cred_score := 1.0; END IF;
    
    -- 3. Apply Credibility Penalty (VETO POWER)
    -- If credibility < 0.3, strictly cap probability
    IF cred_score < 0.3 THEN
        base_prob := LEAST(base_prob, 0.1);
        RETURN jsonb_build_object(
            'score', base_prob,
            'flag', 'low_credibility_veto'
        );
    END IF;
    
    -- 4. Apply Talent State Boost (CAPPED)
    -- E.g. High 'forecast_alignment' implies candidate is in a booming sector
    IF talent_state.forecast_alignment_score > 0.8 THEN
        ai_modifier := 0.15;
    ELSIF talent_state.forecast_alignment_score < 0.2 THEN
        ai_modifier := -0.15;
    END IF;
    
    -- Clamp Modifier
    IF ai_modifier > ai_influence_cap THEN ai_modifier := ai_influence_cap; END IF;
    IF ai_modifier < -ai_influence_cap THEN ai_modifier := -ai_influence_cap; END IF;
    
    final_prob := base_prob + ai_modifier;
    
    -- Clamp Final
    IF final_prob > 0.99 THEN final_prob := 0.99; END IF;
    IF final_prob < 0.01 THEN final_prob := 0.01; END IF;

    RETURN jsonb_build_object(
        'score', final_prob,
        'base_score', base_prob,
        'ai_modifier', ai_modifier,
        'capability_index', talent_state.capability_index
    );
END;
$$ LANGUAGE plpgsql STABLE;
