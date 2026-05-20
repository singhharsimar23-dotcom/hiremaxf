-- 20260213_multichannel_integration.sql
-- Multi-Channel Embedding Schema & Ingestion

-- 1. MULTI-CHANNEL CANDIDATE EMBEDDINGS (Structured)
-- Replaces simple 5-dim embedding with structured 64-dim composite vector
-- Dimensions: 
-- 0-15:   u_eng (Prod/GitHub/Docker/NPM/PyPI)
-- 16-27:  u_algo (LeetCode/Codefaces)
-- 28-39:  u_ml (Kaggle/HuggingFace)
-- 40-47:  u_research (Scholar/ORCID)
-- 48-55:  u_community (StackOverflow/Medium/Dev.to)
-- 56-63:  u_product (ProductHunt/Crunchbase/Portfolio)

ALTER TABLE public.ml_candidate_embeddings
ADD COLUMN IF NOT EXISTS embedding_structured VECTOR(64),
ADD COLUMN IF NOT EXISTS source_signals JSONB DEFAULT '{}', -- Stores raw normalized scores per channel
ADD COLUMN IF NOT EXISTS channel_coherence_score FLOAT DEFAULT 1.0; -- Cross-channel consistency

-- 2. CHANNEL RELIABILITY WEIGHTS (Learnable)
-- We store the global weights for combining sub-embeddings during inference/training
-- Init: Equal weights for all 6 channels
INSERT INTO public.ml_global_parameters (key, value)
VALUES ('channel_weights', '{
    "w_eng": 1.0, 
    "w_algo": 1.0, 
    "w_ml": 1.0, 
    "w_research": 1.0, 
    "w_community": 1.0, 
    "w_product": 1.0
}')
ON CONFLICT (key) DO NOTHING;

-- 3. INGESTION TABLES (Raw Data Staging)
-- Instead of modifying the main profile continuously, we stage ingestion data
CREATE TABLE IF NOT EXISTS public.raw_integrations_data (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL, -- 'github', 'kaggle', 'leetcode', etc.
    external_id TEXT,
    raw_data JSONB, -- The full JSON payload from the API
    normalized_score FLOAT, -- Pre-computed normalized strength (0-1)
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, platform)
);

-- 4. FUNCTION: CALCULATE COHERENCE (Anti-Gaming)
-- Computes similarity between related sub-embeddings
-- Since we don't have vector slicing in pgvector easily in SQL, 
-- we implement a simplified heuristic based on normalized input scores for now.
-- (Real vector coherence happens in the Python training loop).
-- Here we flag high variance between claimed expertise (e.g. valid Kaggle vs empty GitHub for ML role)

CREATE OR REPLACE FUNCTION public.check_signal_consistency(p_user_id UUID) 
RETURNS FLOAT AS $$
DECLARE
    data JSONB;
    score_eng FLOAT;
    score_ml FLOAT;
    coherence FLOAT := 1.0;
BEGIN
    SELECT jsonb_object_agg(platform, normalized_score) INTO data
    FROM public.raw_integrations_data
    WHERE user_id = p_user_id;
    
    score_eng := COALESCE((data->>'github')::FLOAT, 0.0);
    score_ml := COALESCE((data->>'kaggle')::FLOAT, 0.0);

    -- Example Heuristic: High ML but Zero Engineering is suspicious for a senior role
    IF score_ml > 0.8 AND score_eng < 0.1 THEN
        coherence := 0.5; -- Penalty
    END IF;

    RETURN coherence;
END;
$$ LANGUAGE plpgsql STABLE;
