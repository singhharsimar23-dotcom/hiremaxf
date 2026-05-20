-- 20260213_ml_core_architecture.sql
-- Production ML Architecture for HireMax
-- Implements: Vector Embeddings, Bandit Logging, Market Signals

-- 1. Enable pgvector for embedding operations
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. ML CONFIGURATION & GLOBAL PARAMETERS (Part 5 - Macro Variable)
CREATE TABLE IF NOT EXISTS public.ml_global_parameters (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initialize Market Temperature (Beta_t)
INSERT INTO public.ml_global_parameters (key, value)
VALUES ('market_temperature', '{"beta": 0.0, "rolling_avg_rate": 0.05, "gamma": 1.0}')
ON CONFLICT (key) DO NOTHING;

-- 3. CANDIDATE EMBEDDINGS (Part 1 - Latent Quality)
-- Dimensions: 5 (Technical, Seniority, Comm, Domain, Anomaly)
CREATE TABLE IF NOT EXISTS public.ml_candidate_embeddings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    embedding VECTOR(5), 
    confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1),
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    -- Metadata constraints for anchoring
    is_anchored BOOLEAN DEFAULT FALSE
);

-- 4. COMPANY EMBEDDINGS (Part 7 - Simplified Company Modeling)
-- Dimensions: 5 (Matches Candidate Embedding Space)
CREATE TABLE IF NOT EXISTS public.ml_company_embeddings (
    company_name TEXT PRIMARY KEY, -- Simple key for now, ideally UUID
    embedding VECTOR(5),
    industry_cluster TEXT,
    reliability_score FLOAT DEFAULT 0.5, -- For "Ghosting" weighting
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- 5. RESUME BANDIT EXPERIMENTS (Part 8 - Hardening)
CREATE TABLE IF NOT EXISTS public.ml_resume_experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id UUID REFERENCES public.job_pointers(id),
    variant_id TEXT NOT NULL, -- 'A', 'B', 'C'
    -- Bandit Logs
    propensity_score FLOAT NOT NULL, -- Probability of selection (for IPW)
    epsilon FLOAT NOT NULL, -- Exploration rate at time of choice
    selected_at TIMESTAMPTZ DEFAULT NOW(),
    -- Outcome (Reward)
    outcome_status TEXT DEFAULT 'PENDING', -- 'VIEWED', 'INTERVIEW', 'REJECTED'
    reward_value FLOAT DEFAULT 0.0
);

-- 6. INFERENCE LOGS (Part 10 - Risk Monitoring)
CREATE TABLE IF NOT EXISTS public.ml_inference_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID,
    job_id UUID,
    predicted_score FLOAT,
    actual_outcome TEXT,
    anomaly_flag BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. FUNCTION: RECORD BANDIT OUTCOME
CREATE OR REPLACE FUNCTION public.record_bandit_outcome(
    p_experiment_id UUID,
    p_outcome TEXT,
    p_reward FLOAT
) RETURNS VOID AS $$
BEGIN
    UPDATE public.ml_resume_experiments
    SET outcome_status = p_outcome,
        reward_value = p_reward
    WHERE id = p_experiment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. FUNCTION: COMPUTE RANKING SCORE (Vector Dot Product + Bias)
-- Uses: E(x) * E(c) + Gamma * Beta_t
CREATE OR REPLACE FUNCTION public.predict_match_score(
    p_user_id UUID,
    p_company_name TEXT
) RETURNS FLOAT AS $$
DECLARE
    cand_vec VECTOR(5);
    comp_vec VECTOR(5);
    market_params JSONB;
    market_beta FLOAT;
    market_gamma FLOAT;
    dot_product FLOAT;
    final_score FLOAT;
BEGIN
    -- Get Candidate Vector
    SELECT embedding INTO cand_vec FROM public.ml_candidate_embeddings WHERE user_id = p_user_id;
    IF cand_vec IS NULL THEN
        RETURN 0.0; -- Cold start fallback
    END IF;

    -- Get Company Vector (or default)
    SELECT embedding INTO comp_vec FROM public.ml_company_embeddings WHERE company_name = p_company_name;
    IF comp_vec IS NULL THEN
        -- Default neutral vector if company unknown
        comp_vec := '[0.5, 0.5, 0.5, 0.5, 0.5]'; 
    END IF;

    -- Get Market Params
    SELECT value INTO market_params FROM public.ml_global_parameters WHERE key = 'market_temperature';
    market_beta := (market_params->>'beta')::FLOAT;
    market_gamma := (market_params->>'gamma')::FLOAT;

    -- Compute Dot Product (Manual calculation or using <#>)
    -- pgvector uses <#> for negative inner product, so we allow negative for distance,
    -- but for similarity we want inner product. 
    -- Vector inner product: A <#> B returns -(A.B). So we negate it?
    -- Actually pgvector 0.4.0+ supports <=> for cosine distance, <#> for negative inner product.
    -- We want straight inner product. -1 * (A <#> B)
    dot_product := -1 * (cand_vec <#> comp_vec);
    
    -- Final Score = DotProduct + Gamma * Beta
    final_score := dot_product + (market_gamma * market_beta);
    
    -- Sigmoid-ish clamping (0 to 1)
    RETURN 1.0 / (1.0 + EXP(-final_score)); 
END;
$$ LANGUAGE plpgsql STABLE;

-- 9. RLS POLICIES
ALTER TABLE public.ml_candidate_embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own embeddings" ON public.ml_candidate_embeddings FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE public.ml_resume_experiments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own experiments" ON public.ml_resume_experiments FOR SELECT USING (auth.uid() = user_id);
