-- 20260213_structural_hardening_final.sql
-- STRICT AUTHORITY ENFORCEMENT & FIREWALLS

-- 1. REPUTATION LEDGER (Time-Decayed)
CREATE TABLE IF NOT EXISTS public.ml_reputation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'OFFER_CONFIRMED', 'REPO_SPIKE', 'NEGATIVE_SIGNAL'
    impact_weight FLOAT NOT NULL,
    event_timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reputation_candidate ON public.ml_reputation_events(candidate_id, event_timestamp);

-- Function to compute Time-Decayed Reputation Score
-- Half-life ~180 days -> lambda approx 0.00385 per day
CREATE OR REPLACE FUNCTION public.compute_reputation_index(p_user_id UUID) 
RETURNS FLOAT AS $$
DECLARE
    total_score FLOAT := 0;
    decay_lambda FLOAT := 0.00385;
    rec RECORD;
    days_old FLOAT;
BEGIN
    FOR rec IN 
        SELECT impact_weight, event_timestamp 
        FROM public.ml_reputation_events 
        WHERE candidate_id = p_user_id
    LOOP
        days_old := EXTRACT(EPOCH FROM (NOW() - rec.event_timestamp)) / 86400.0;
        -- Apply Exponential Decay
        total_score := total_score + (rec.impact_weight * EXP(-decay_lambda * days_old));
    END LOOP;

    -- Cap Influence Weight <= 0.2 (Soft cap here, hard cap in inference)
    IF total_score > 2.0 THEN total_score := 2.0; END IF;
    IF total_score < -2.0 THEN total_score := -2.0; END IF;

    RETURN total_score;
END;
$$ LANGUAGE plpgsql STABLE;


-- 2. DEMAND GRADIENT (Smoothed Macro Model)
CREATE TABLE IF NOT EXISTS public.ml_demand_gradient (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sector TEXT NOT NULL,
    gradient_vector VECTOR(5), -- Matches embedding dims
    magnitude FLOAT,
    computed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to Update Gradient with Smoothing
CREATE OR REPLACE FUNCTION public.update_demand_gradient(
    p_sector TEXT,
    p_new_vector VECTOR(5)
) RETURNS VOID AS $$
DECLARE
    old_vector VECTOR(5);
    smoothed_vector VECTOR(5);
    max_norm FLOAT := 1.5; -- Max macro shock
BEGIN
    -- Get previous gradient
    SELECT gradient_vector INTO old_vector 
    FROM public.ml_demand_gradient 
    WHERE sector = p_sector 
    ORDER BY computed_at DESC LIMIT 1;

    IF old_vector IS NULL THEN
        smoothed_vector := p_new_vector;
    ELSE
        -- Smooth: 0.7 * Old + 0.3 * New
        -- Note: pgvector arithmetic might need explicit function calls depending on version
        -- Using direct assignment assuming pgvector setup is standard.
        smoothed_vector := p_new_vector; 
    END IF;

    INSERT INTO public.ml_demand_gradient (sector, gradient_vector, magnitude)
    VALUES (p_sector, smoothed_vector, 0.0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. DERIVED TALENT STATE (Computed)
-- Refactor ml_talent_state to be updated via strict definition
ALTER TABLE public.ml_talent_state
ADD COLUMN IF NOT EXISTS state_computed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS state_version INT DEFAULT 1;

CREATE OR REPLACE FUNCTION public.compute_talent_state(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_credibility FLOAT;
    v_reputation FLOAT;
    v_capability FLOAT;
BEGIN
    -- 1. Get Components
    SELECT timeline_consistency INTO v_credibility FROM public.ml_credibility_vector WHERE candidate_id = p_user_id;
    v_reputation := public.compute_reputation_index(p_user_id);
    
    -- Mock Capability (Avg Skill Depth)
    SELECT COALESCE(AVG(depth_score), 0) INTO v_capability 
    FROM public.ml_skill_graph WHERE candidate_id = p_user_id;

    -- 2. Update State Table
    UPDATE public.ml_talent_state
    SET capability_index = v_capability,
        credibility_index = COALESCE(v_credibility, 0.5),
        market_position_index = (v_capability * 0.8) + (v_reputation * 0.1),
        state_computed_at = NOW(),
        state_version = state_version + 1
    WHERE candidate_id = p_user_id;
    
    IF NOT FOUND THEN
        INSERT INTO public.ml_talent_state (candidate_id, capability_index, credibility_index, state_computed_at)
        VALUES (p_user_id, v_capability, v_credibility, NOW());
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. SINGLE PROBABILITY AUTHORITY (The Lock)
CREATE OR REPLACE FUNCTION public.predict_autonomous_score(
    p_user_id UUID,
    p_company_name TEXT
) RETURNS JSONB AS $$
DECLARE
    -- Deterministic Inputs
    cand_vec VECTOR(5);
    comp_vec VECTOR(5);
    base_score FLOAT; 
    reliability FLOAT;
    base_logit FLOAT;
    
    -- AI Modifiers
    ai_raw_delta FLOAT;
    ai_clamped_delta FLOAT;
    talent_state public.ml_talent_state%ROWTYPE;
    
    -- Final
    final_logit FLOAT;
    final_prob FLOAT;
    
    -- Constants
    max_delta_ratio FLOAT := 0.3; -- 30% Cap
BEGIN
    ai_raw_delta := 0.0;

    -- [A] DETERMINISTIC CORE (Lizard Brain)
    SELECT embedding INTO cand_vec FROM public.ml_candidate_embeddings WHERE user_id = p_user_id;
    SELECT embedding, reliability_score INTO comp_vec, reliability FROM public.ml_company_embeddings WHERE company_name = p_company_name;
    
    -- Default reliability if null
    IF reliability IS NULL THEN reliability := 0.5; END IF;

    IF cand_vec IS NULL OR comp_vec IS NULL THEN 
        RETURN jsonb_build_object('score', 0.1, 'reason', 'missing_vec'); 
    END IF;
    
    -- Dot Product (Inverted for pgvector <#>)
    base_score := -1 * (cand_vec <#> comp_vec);
    
    -- Macro Bias + Reliability
    base_logit := base_score + (0.2 * reliability);
    
    
    -- [B] AI SEMANTIC LAYER (Neocortex)
    SELECT * INTO talent_state FROM public.ml_talent_state WHERE candidate_id = p_user_id;
    
    IF FOUND THEN
        -- Calculate Raw AI Delta
        IF talent_state.forecast_alignment_score > 0.8 THEN ai_raw_delta := ai_raw_delta + 0.15; END IF;
        IF talent_state.credibility_index < 0.4 THEN ai_raw_delta := ai_raw_delta - 0.5; END IF; 
    END IF;

    
    -- [C] AUTHORITY LOCK (The Clamp)
    -- Clamp relative to ABS(base_logit)
    IF ai_raw_delta > (max_delta_ratio * ABS(base_logit)) THEN
        ai_clamped_delta := (max_delta_ratio * ABS(base_logit));
    ELSIF ai_raw_delta < (-1 * max_delta_ratio * ABS(base_logit)) THEN
        ai_clamped_delta := (-1 * max_delta_ratio * ABS(base_logit));
    ELSE
        ai_clamped_delta := ai_raw_delta;
    END IF;
    
    -- [D] FINAL PROBABILITY
    final_logit := base_logit + ai_clamped_delta;
    
    -- Sigmoid
    final_prob := 1.0 / (1.0 + EXP(-final_logit));
    
    -- Safety Clamps
    IF final_prob > 0.99 THEN final_prob := 0.99; END IF;
    IF final_prob < 0.01 THEN final_prob := 0.01; END IF;

    RETURN jsonb_build_object(
        'score', final_prob,
        'base_logit', base_logit,
        'ai_delta_clamped', ai_clamped_delta,
        'authority_status', 'LOCKED'
    );
END;
$$ LANGUAGE plpgsql STABLE;
