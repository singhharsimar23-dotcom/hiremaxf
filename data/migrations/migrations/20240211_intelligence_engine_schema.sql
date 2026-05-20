-- HireMax Intelligence Engine Schema
-- Implements the foundation for self-learning profile scoring.

-- 1. CONFIGURATION LAYER: DEFINING THE "KNOBS"
CREATE TABLE IF NOT EXISTS public.scoring_weights_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL, -- e.g. 'work_experience_weight'
    description TEXT,
    default_value FLOAT NOT NULL,
    min_bound FLOAT NOT NULL,
    max_bound FLOAT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. VERSIONING LAYER: SNAPSHOTS OF CONFIGURATION
CREATE TABLE IF NOT EXISTS public.scoring_weight_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version INTEGER NOT NULL,
    segment_criteria JSONB DEFAULT '{}', -- e.g. {"role": "software_engineer"}
    weights JSONB NOT NULL, -- Key-value map: definition_name -> value
    status TEXT DEFAULT 'CANDIDATE', -- 'ACTIVE', 'CANDIDATE', 'ARCHIVED'
    parent_weight_set_id UUID REFERENCES public.scoring_weight_sets(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    deployed_at TIMESTAMPTZ
);

-- 3. LEARNING LAYER: LINKING PREDICTIONS TO OUTCOMES
CREATE TABLE IF NOT EXISTS public.prediction_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    snapshot_id UUID REFERENCES public.profile_snapshots(id),
    weight_set_id UUID REFERENCES public.scoring_weight_sets(id), -- The logic used
    predicted_score FLOAT NOT NULL,
    outcome_id UUID REFERENCES public.profile_outcomes(id), -- Linked when outcome occurs
    error_magnitude FLOAT, -- Computed by optimizer later
    created_at TIMESTAMPTZ DEFAULT now()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_weight_sets_status ON public.scoring_weight_sets(status);
CREATE INDEX IF NOT EXISTS idx_predictions_user ON public.prediction_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_outcome ON public.prediction_logs(outcome_id);

-- SEED DATA: INITIAL WEIGHT DEFINITIONS
INSERT INTO public.scoring_weights_definitions (name, description, default_value, min_bound, max_bound)
VALUES 
    ('work_experience_weight', 'Global multiplier for work experience signals', 10.0, 1.0, 50.0),
    ('skills_weight', 'Global multiplier for skill signals', 10.0, 1.0, 50.0),
    ('education_weight', 'Global multiplier for education signals', 5.0, 0.0, 30.0),
    ('projects_weight', 'Global multiplier for project signals', 5.0, 0.0, 30.0),
    ('verified_multiplier', 'Bonus multiplier for verified signals', 1.25, 1.0, 3.0),
    ('recency_decay_factor', 'Exponential decay factor for old signals', 0.9, 0.5, 1.0)
ON CONFLICT (name) DO NOTHING;

-- SEED DATA: INITIAL WEIGHT SET (VERSION 1)
INSERT INTO public.scoring_weight_sets (version, weights, status, deployed_at)
VALUES (
    1,
    '{
        "work_experience_weight": 10.0,
        "skills_weight": 10.0,
        "education_weight": 5.0,
        "projects_weight": 5.0,
        "verified_multiplier": 1.25,
        "recency_decay_factor": 0.9
    }'::jsonb,
    'ACTIVE',
    now()
);
