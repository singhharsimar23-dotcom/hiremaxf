-- 20260213_behavioral_intelligence.sql
-- BEHAVIORAL INTELLIGENCE & FRICTION MODELING

-- 1. APPLICATION FRICTION MODEL
CREATE TABLE IF NOT EXISTS public.ml_application_friction (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain TEXT NOT NULL,
    field_count INT DEFAULT 0,
    custom_question_count INT DEFAULT 0,
    captcha_present BOOLEAN DEFAULT FALSE,
    login_required BOOLEAN DEFAULT FALSE,
    avg_time_to_fill FLOAT, -- seconds
    friction_index FLOAT CHECK (friction_index BETWEEN 0 AND 1),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_friction_domain ON public.ml_application_friction(domain);

-- 2. COMPANY ACTIVITY HOURS (Attention Model)
CREATE TABLE IF NOT EXISTS public.ml_company_activity_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.ml_company_embeddings(company_id) ON DELETE CASCADE,
    day_of_week INT CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun, 6=Sat
    hour INT CHECK (hour BETWEEN 0 AND 23),
    submission_count INT DEFAULT 0,
    interview_response_count INT DEFAULT 0,
    response_velocity FLOAT DEFAULT 0.0,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, day_of_week, hour)
);

-- 3. RECRUITER FATIGUE (Cognitive Model Update)
ALTER TABLE public.ml_recruiter_cognitive_model
ADD COLUMN IF NOT EXISTS screening_fatigue_index FLOAT DEFAULT 0.0 CHECK (screening_fatigue_index BETWEEN 0 AND 1),
ADD COLUMN IF NOT EXISTS rolling_application_volume INT DEFAULT 0;

-- 4. ROLE SATURATION INDEX (Leverage Layer)
CREATE TABLE IF NOT EXISTS public.ml_role_saturation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_hash TEXT NOT NULL, -- Simplified ID (e.g. hash of title + level)
    applications_last_24h INT DEFAULT 0,
    applications_last_72h INT DEFAULT 0,
    saturation_index FLOAT DEFAULT 0.0 CHECK (saturation_index BETWEEN 0 AND 1),
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- 5. FUNCTION: PREDICT AUTONOMOUS SCORE (Funnel-Based Update)
CREATE OR REPLACE FUNCTION public.predict_autonomous_score(
    p_user_id UUID,
    p_company_name TEXT
) RETURNS JSONB AS $$
DECLARE
    -- Core
    cand_vec VECTOR(5);
    comp_vec VECTOR(5);
    reliability FLOAT;
    base_logit FLOAT;
    base_score FLOAT;

    -- Funnel Components
    v_company_id UUID;
    v_fatigue_index FLOAT := 0.0;
    v_attention_likelihood FLOAT := 0.5;
    
    -- Probabilities
    p_seen FLOAT;
    p_read_given_seen FLOAT;
    p_interview_given_read FLOAT;
    p_funnel FLOAT;
    
    -- AI Delta
    ai_delta_raw FLOAT;
    ai_clamped_delta FLOAT;
    max_delta_ratio FLOAT := 0.3;
    
    final_logit FLOAT;
    final_prob FLOAT;
    
    -- Current Time for Attention
    v_dow INT;
    v_hour INT;
BEGIN
    -- [A] DETERMINISTIC CORE (Lizard Brain)
    SELECT embedding INTO cand_vec FROM public.ml_candidate_embeddings WHERE user_id = p_user_id;
    SELECT embedding, reliability_score, company_id INTO comp_vec, reliability, v_company_id 
    FROM public.ml_company_embeddings WHERE company_name = p_company_name;

    IF reliability IS NULL THEN reliability := 0.5; END IF;
    IF cand_vec IS NULL OR comp_vec IS NULL THEN 
        RETURN jsonb_build_object('score', 0.1, 'reason', 'missing_vec'); 
    END IF;

    base_score := -1 * (cand_vec <#> comp_vec);
    base_logit := base_score + (0.2 * reliability);
    
    -- [B] BEHAVIORAL INTELLIGENCE (Funnel Components)
    
    -- 1. Get Fatigue (Read Probability)
    SELECT screening_fatigue_index INTO v_fatigue_index 
    FROM public.ml_recruiter_cognitive_model 
    WHERE company_id = v_company_id;
    
    IF v_fatigue_index IS NULL THEN v_fatigue_index := 0.0; END IF;
    
    -- 2. Get Attention (Seen Probability)
    -- Check current active window
    v_dow := EXTRACT(DOW FROM NOW())::INT;
    v_hour := EXTRACT(HOUR FROM NOW())::INT;
    
    SELECT response_velocity INTO v_attention_likelihood
    FROM public.ml_company_activity_hours
    WHERE company_id = v_company_id AND day_of_week = v_dow AND hour = v_hour;
    
    -- Fallback / Normalization
    IF v_attention_likelihood IS NULL THEN v_attention_likelihood := 0.5; END IF;
    -- Maximize at reasonable velocity (e.g. >0.1 means specific active window)
    IF v_attention_likelihood > 0.05 THEN v_attention_likelihood := LEAST(0.5 + (v_attention_likelihood * 2.0), 0.9); 
    ELSE v_attention_likelihood := 0.4; -- Baseline
    END IF;

    -- [C] FUNNEL COMPUTATION
    p_seen := v_attention_likelihood;
    p_read_given_seen := (1.0 - v_fatigue_index);
    p_interview_given_read := 1.0 / (1.0 + EXP(-base_logit)); -- Sigmoid of base
    
    p_funnel := p_seen * p_read_given_seen * p_interview_given_read;
    
    -- Avoid log(0)
    IF p_funnel < 0.001 THEN p_funnel := 0.001; END IF;
    IF p_funnel > 0.999 THEN p_funnel := 0.999; END IF;
    
    -- [D] AI DELTA & CLAMP
    -- Calculate what the logit WOULD be for this funnel prob
    ai_delta_raw := LN(p_funnel / (1.0 - p_funnel)) - base_logit;
    
    -- Clamp relative to ABS(base_logit)
    IF ai_delta_raw > (max_delta_ratio * ABS(base_logit)) THEN
        ai_clamped_delta := (max_delta_ratio * ABS(base_logit));
    ELSIF ai_delta_raw < (-1 * max_delta_ratio * ABS(base_logit)) THEN
        ai_clamped_delta := (-1 * max_delta_ratio * ABS(base_logit));
    ELSE
        ai_clamped_delta := ai_delta_raw;
    END IF;
    
    -- [E] FINAL PROBABILITY
    final_logit := base_logit + ai_clamped_delta;
    final_prob := 1.0 / (1.0 + EXP(-final_logit));
    
     -- Safety Clamps
    IF final_prob > 0.99 THEN final_prob := 0.99; END IF;
    IF final_prob < 0.01 THEN final_prob := 0.01; END IF;

    RETURN jsonb_build_object(
        'score', final_prob,
        'base_logit', base_logit,
        'ai_delta_clamped', ai_clamped_delta,
        'funnel_metrics', jsonb_build_object(
            'p_seen', p_seen,
            'p_read', p_read_given_seen,
            'fatigue', v_fatigue_index
        )
    );
END;
$$ LANGUAGE plpgsql STABLE;
