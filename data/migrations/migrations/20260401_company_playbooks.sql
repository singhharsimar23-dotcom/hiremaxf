-- 20260401_company_playbooks.sql
-- Goal: Step 3 — Strategy Selection (Company-Level Playbooks)

CREATE TABLE IF NOT EXISTS public.company_playbooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_key TEXT UNIQUE NOT NULL, -- e.g., 'META', 'GOOGLE', 'STRIPE'
    strategy_config JSONB NOT NULL, -- { tone, metric_target, verb_tier, keyword_intensity }
    winning_patterns TEXT[], -- List of successful bullet themes
    instructions TEXT, -- Specific LLM directives
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed with initial playbooks
INSERT INTO public.company_playbooks (company_key, strategy_config, winning_patterns, instructions)
VALUES 
('META', '{"tone": "Metric-Obsessed/Scale", "metric_target": 0.8, "verb_tier": 1, "keyword_intensity": 0.9}', ARRAY['Scale to 1B+ users', 'Latency reduction in ms', 'Cross-functional orchestration'], 'Emphasize ownership of zero-to-one products and mass-scale infrastructure optimizations.'),
('GOOGLE', '{"tone": "Academic/Principled", "metric_target": 0.7, "verb_tier": 1, "keyword_intensity": 0.8}', ARRAY['Algorithm optimization', 'Internal tool creation', 'Complexity reduction'], 'Focus on deep technical complexity, principled engineering tradeoffs, and impact on core systems.'),
('APPLE', '{"tone": "Design-First/Technical", "metric_target": 0.6, "verb_tier": 2, "keyword_intensity": 0.7}', ARRAY['User experience at scale', 'Hardware/Software integration', 'End-to-end craft'], 'Prioritize craftsmanship, user-centric outcomes, and horizontal integration.');

-- Update view_intelligence_efficiency to include playbooks
CREATE OR REPLACE VIEW public.view_company_intelligence AS
SELECT 
    cp.company_key,
    cp.strategy_config,
    ao.outcome,
    count(ao.id) as count
FROM public.company_playbooks cp
LEFT JOIN public.application_outcomes ao ON UPPER(ao.company) = cp.company_key
GROUP BY cp.company_key, cp.strategy_config, ao.outcome;
