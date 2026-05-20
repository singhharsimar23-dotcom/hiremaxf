-- Migration: 20260329000005_intelligence_loop.sql
-- Description: Outcome logging and company playbooks for Intelligence Phase.

-- 1. Outcome Status Enum
DO $$ BEGIN
    CREATE TYPE public.outcome_type AS ENUM ('INTERVIEW', 'REJECT', 'GHOST', 'OFFER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Application Outcomes (Ground Truth)
CREATE TABLE IF NOT EXISTS public.application_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    application_id UUID REFERENCES public.applications(id),
    pipeline_run_id UUID REFERENCES public.pipeline_runs(id),
    company TEXT NOT NULL,
    role TEXT NOT NULL,
    outcome public.outcome_type NOT NULL,
    response_time_days INTEGER, -- Days from application to outcome
    feature_snapshot JSONB NOT NULL, -- WHY: Capture the exact state of the resume for this outcome
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.application_outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see their own outcomes" ON public.application_outcomes FOR SELECT USING (auth.uid() = user_id);

-- 3. Company-Level Playbooks (Intelligence Repository)
CREATE TABLE IF NOT EXISTS public.company_playbooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_key TEXT UNIQUE NOT NULL, -- e.g., 'GOOGLE', 'META', 'AMAZON', 'NETFLIX'
    strategy_config JSONB NOT NULL DEFAULT '{
        "metric_weight": 0.6,
        "verb_tier": 1,
        "keyword_intensity": 0.8,
        "tone": "Leadership"
    }',
    winning_patterns TEXT[] DEFAULT'{}', -- Specific bullet phrases that worked here
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed FAANG Playbooks
INSERT INTO public.company_playbooks (company_key, strategy_config, winning_patterns)
VALUES 
('GOOGLE', 
 '{ "metric_weight": 0.8, "verb_tier": 1, "keyword_intensity": 0.9, "tone": "Engineering Excellence" }', 
 ARRAY['Architected globally distributed', 'Optimized p99 latency by', 'Scalability of scale']),
('META', 
 '{ "metric_weight": 0.7, "verb_tier": 1, "keyword_intensity": 0.8, "tone": "Product Velocity" }', 
 ARRAY['Spearheaded end-to-end', 'Increased user engagement by', 'Shipped V1 of']),
('AMAZON', 
 '{ "metric_weight": 0.9, "verb_tier": 1, "keyword_intensity": 0.7, "tone": "Leadership & Ownership" }', 
 ARRAY['Obsessed over customer experience', 'Delivered under tight constraints', 'Ownership of mission-critical'])
ON CONFLICT (company_key) DO UPDATE 
SET strategy_config = EXCLUDED.strategy_config,
    winning_patterns = EXCLUDED.winning_patterns;

-- 4. P(Interview) Column in pipeline_runs
ALTER TABLE public.pipeline_runs 
ADD COLUMN IF NOT EXISTS p_interview FLOAT DEFAULT 0.0;

-- 5. Indexing for Intelligence Lookups
CREATE INDEX IF NOT EXISTS idx_outcomes_company ON public.application_outcomes(company);
CREATE INDEX IF NOT EXISTS idx_outcomes_outcome ON public.application_outcomes(outcome);
