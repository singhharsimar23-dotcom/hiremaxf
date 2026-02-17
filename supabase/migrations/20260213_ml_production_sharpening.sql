-- 20260213_ml_production_sharpening.sql

-- 1. HARD NEGATIVE MINING PIPELINE (Part 1)
-- Table to store mined hard negatives for contrastive retraining
CREATE TABLE IF NOT EXISTS public.ml_hard_negative_pairs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    positive_application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
    negative_job_id UUID REFERENCES public.job_pointers(id) ON DELETE CASCADE,
    similarity_score FLOAT, -- Vector similarity between pos/neg job
    mined_at TIMESTAMPTZ DEFAULT NOW(),
    used_in_training BOOLEAN DEFAULT FALSE
);

-- Index for fast retrieval during training loop
CREATE INDEX IF NOT EXISTS idx_hard_neg_used ON public.ml_hard_negative_pairs(used_in_training) WHERE used_in_training = FALSE;


-- 2. COMPANY-CONDITIONAL ATTENTION HEAD (Part 2)
-- Storage for lightweight attention MLP weights (separate from mismatch head)
INSERT INTO public.ml_model_weights (layer_name, weights)
VALUES 
('attention_head_layer1', '{"W": [[0.05]], "b": [0.0]}'), -- Placeholder initialization
('attention_head_output', '{"W": [[0.05]], "b": [0.0]}')
ON CONFLICT DO NOTHING;


-- 3. TEMPORAL CONSISTENCY METRICS (Part 3)
-- Upgrade Candidate Embeddings with Temporal Signals
ALTER TABLE public.ml_candidate_embeddings
ADD COLUMN IF NOT EXISTS timeline_coherence_score FLOAT DEFAULT 1.0, -- Overlap consistency
ADD COLUMN IF NOT EXISTS contribution_velocity_stability FLOAT DEFAULT 0.5, -- Consistency of output
ADD COLUMN IF NOT EXISTS velocity_spike_flag BOOLEAN DEFAULT FALSE; -- Sudden suspicious output spike

-- 4. COHORT-LEVEL CALIBRATION HISTORY (Part 4)
-- Track calibration drift over time
CREATE TABLE IF NOT EXISTS public.ml_calibration_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cohort_id TEXT, -- e.g. "Senior_Backend_SaaS"
    measured_ece FLOAT, -- Expected Calibration Error
    old_temperature FLOAT,
    new_temperature FLOAT,
    sample_size INT,
    audit_date TIMESTAMPTZ DEFAULT NOW()
);


-- 5. APPLICATION RELIABILITY MODEL (Part 5)
-- Extend applications table to store learned reliability weight R_i
ALTER TABLE public.applications
ADD COLUMN IF NOT EXISTS learned_reliability_weight FLOAT DEFAULT 1.0; 
-- This will be populated by a scheduled job based on Company Reply Rates + Sector Volatility


-- 6. CONFIDENCE INTERVAL OUTPUT (Part 6)
-- Function to compute Uncertainty: U = f(Density, CohortSize, Reliability)
-- Heuristic High-Speed Implementation
CREATE OR REPLACE FUNCTION public.compute_prediction_uncertainty(
    p_user_id UUID, 
    p_reliability FLOAT
) RETURNS FLOAT AS $$
DECLARE
    neighbor_dist FLOAT;
    cohort_density FLOAT; 
    uncertainty FLOAT;
BEGIN
    -- 1. Estimate Embedding Density (Distance to nearest neighbor in cohort)
    -- In real pgvector, we'd query KNN dist. Here we mock a lookup or use precomputed stats.
    -- Let's assume embeddings have a precomputed 'local_density_score' updated weekly.
    -- For now, we fallback to a heuristic based on profile completeness.
    
    -- Placeholder:
    cohort_density := 0.8; 

    -- 2. Compute Uncertainty
    -- U = (1 - Density) + (1 - Reliability) * 0.5
    uncertainty := (1.0 - cohort_density) + (1.0 - p_reliability) * 0.5;
    
    -- Clamp [0.05, 0.5]
    IF uncertainty < 0.05 THEN uncertainty := 0.05; END IF;
    IF uncertainty > 0.5 THEN uncertainty := 0.5; END IF;
    
    RETURN uncertainty;
END;
$$ LANGUAGE plpgsql STABLE;


-- 7. PLATFORM WEIGHT DRIFT MONITORING (Part 7)
-- History table for global parameter drifts
CREATE TABLE IF NOT EXISTS public.ml_parameter_drift_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    param_key TEXT, -- e.g. 'channel_weights'
    old_value JSONB,
    new_value JSONB,
    change_reason TEXT, -- 'Weekly Retrain', 'Emergency Reset'
    log_date TIMESTAMPTZ DEFAULT NOW()
);


-- 8. EMBEDDING GEOMETRY DIAGNOSTICS (Part 8)
CREATE TABLE IF NOT EXISTS public.ml_embedding_diagnostics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cohort_id TEXT,
    avg_intra_role_similarity FLOAT,
    avg_inter_role_separation FLOAT,
    norm_variance FLOAT,
    silhouette_score FLOAT,
    diagnostic_date TIMESTAMPTZ DEFAULT NOW()
);


-- 9. UPDATED INFERENCE FUNCTION WITH UNCERTAINTY (Part 6 + 10)
-- Wraps the Calibrated Prediction with Uncertainty Bounds
CREATE OR REPLACE FUNCTION public.predict_match_with_uncertainty(
    p_user_id UUID,
    p_company_name TEXT,
    p_cohort TEXT DEFAULT 'General'
) RETURNS JSONB AS $$
DECLARE
    match_prob FLOAT;
    reliability FLOAT;
    uncertainty FLOAT;
BEGIN
    -- 1. Get Calibrated Probability
    match_prob := public.predict_calibrated_score(p_user_id, p_company_name, p_cohort);
    
    -- 2. Get Reliability (for uncertainty calc)
    SELECT reliability_score INTO reliability 
    FROM public.ml_company_embeddings 
    WHERE company_name = p_company_name;
    
    IF reliability IS NULL THEN reliability := 0.5; END IF;

    -- 3. Compute Uncertainty
    uncertainty := public.compute_prediction_uncertainty(p_user_id, reliability);

    -- 4. Return Object
    RETURN jsonb_build_object(
        'match_probability', match_prob,
        'uncertainty', uncertainty,
        'lower_bound', GREATEST(match_prob - uncertainty, 0.0),
        'upper_bound', LEAST(match_prob + uncertainty, 1.0)
    );
END;
$$ LANGUAGE plpgsql STABLE;
