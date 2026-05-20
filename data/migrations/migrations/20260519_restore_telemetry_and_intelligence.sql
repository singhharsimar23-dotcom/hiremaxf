-- HIREMAX RESTORE TELEMETRY AND INTELLIGENCE TABLES

-- 1. Create Telemetry & Application Tables
CREATE TABLE IF NOT EXISTS public.execution_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    resume_id TEXT, -- Nullable to allow generic runs from client without resume_id
    target_role TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'aborted')),
    error_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.execution_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES public.execution_runs(id) ON DELETE CASCADE NOT NULL,
    job_title TEXT NOT NULL,
    company TEXT NOT NULL,
    apply_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'submitted', 'failed')),
    logs TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES public.execution_runs(id) ON DELETE CASCADE NOT NULL,
    message TEXT NOT NULL,
    level TEXT NOT NULL CHECK (level IN ('info', 'success', 'error')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.job_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    company_name TEXT NOT NULL,
    role_title TEXT NOT NULL,
    job_url TEXT,
    status TEXT NOT NULL DEFAULT 'applied',
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    follow_up_due_at TIMESTAMP WITH TIME ZONE,
    resume_group_id TEXT,
    salary_range TEXT,
    location TEXT,
    company_stage TEXT,
    source TEXT,
    notes TEXT,
    contact_name TEXT,
    offer_amount TEXT,
    excitement_level INTEGER DEFAULT 0
);

-- 2. Create Market Intelligence Tables
CREATE TABLE IF NOT EXISTS public.market_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_category TEXT NOT NULL,
    geo_filter TEXT,
    job_count_30d INTEGER DEFAULT 0,
    job_count_prev_30d INTEGER DEFAULT 0,
    hiring_velocity NUMERIC DEFAULT 1.0,
    scarcity_index NUMERIC DEFAULT 0.5,
    demand_index NUMERIC DEFAULT 0.5,
    emerging_skills JSONB DEFAULT '[]'::jsonb,
    stable_skills JSONB DEFAULT '[]'::jsonb,
    declining_skills JSONB DEFAULT '[]'::jsonb,
    timing_signal NUMERIC DEFAULT 0.5,
    repost_factor NUMERIC DEFAULT 1.0,
    lifecycle_stage TEXT DEFAULT 'stable',
    macro_adjustment NUMERIC DEFAULT 0.0,
    causal_forecast NUMERIC DEFAULT 0.0,
    salary_p50 NUMERIC DEFAULT 0.0,
    bayesian_callback_rate NUMERIC DEFAULT 0.1,
    signal_type TEXT,
    company_key TEXT,
    description TEXT,
    confidence NUMERIC DEFAULT 1.0,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.hiring_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL,
    peak_months INTEGER[] DEFAULT '{}',
    trough_months INTEGER[] DEFAULT '{}',
    annual_pattern NUMERIC[] DEFAULT '{}',
    cycle_strength NUMERIC DEFAULT 0.0
);

CREATE TABLE IF NOT EXISTS public.funding_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL,
    amount_usd NUMERIC DEFAULT 0.0,
    round_type TEXT,
    date DATE DEFAULT CURRENT_DATE,
    sector TEXT,
    source_url TEXT
);

CREATE TABLE IF NOT EXISTS public.skill_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill TEXT NOT NULL,
    lifecycle_stage TEXT NOT NULL DEFAULT 'emerging',
    growth_rate_annual NUMERIC DEFAULT 0.0,
    peak_adoption_year INTEGER,
    confidence NUMERIC DEFAULT 1.0
);

CREATE TABLE IF NOT EXISTS public.macro_economic_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    indicator TEXT NOT NULL,
    value NUMERIC DEFAULT 0.0,
    date DATE DEFAULT CURRENT_DATE,
    unit TEXT
);

CREATE TABLE IF NOT EXISTS public.market_momentum_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company TEXT NOT NULL,
    hma_score NUMERIC DEFAULT 1.0,
    confidence_score NUMERIC DEFAULT 1.0,
    velocity_7d NUMERIC DEFAULT 0.0,
    lifecycle_state TEXT,
    role_category TEXT
);

CREATE TABLE IF NOT EXISTS public.causal_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cause_variable TEXT NOT NULL,
    effect_variable TEXT NOT NULL,
    lag_months INTEGER DEFAULT 1,
    causal_strength NUMERIC DEFAULT 0.0,
    p_value NUMERIC DEFAULT 1.0
);

CREATE TABLE IF NOT EXISTS public.skill_evolution_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_name TEXT NOT NULL,
    role_key TEXT,
    skill_growth_rate NUMERIC DEFAULT 0.0,
    skill_momentum NUMERIC DEFAULT 0.0,
    skill_lifecycle_stage TEXT DEFAULT 'stable',
    skill_substitution_probability NUMERIC DEFAULT 0.0,
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.execution_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.market_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hiring_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funding_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.macro_economic_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_momentum_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.causal_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_evolution_signals ENABLE ROW LEVEL SECURITY;

-- 4. Establish Policies
-- Dropping existing policies if they happen to exist (to avoid clashes)
DROP POLICY IF EXISTS "Users can manage their own execution runs" ON public.execution_runs;
DROP POLICY IF EXISTS "Users can manage targets for their runs" ON public.execution_targets;
DROP POLICY IF EXISTS "Users can manage logs for their runs" ON public.execution_logs;
DROP POLICY IF EXISTS "Users can manage their own job applications" ON public.job_applications;

DROP POLICY IF EXISTS "Allow public read access to market_signals" ON public.market_signals;
DROP POLICY IF EXISTS "Allow public read access to hiring_cycles" ON public.hiring_cycles;
DROP POLICY IF EXISTS "Allow public read access to funding_events" ON public.funding_events;
DROP POLICY IF EXISTS "Allow public read access to skill_predictions" ON public.skill_predictions;
DROP POLICY IF EXISTS "Allow public read access to macro_economic_signals" ON public.macro_economic_signals;
DROP POLICY IF EXISTS "Allow public read access to market_momentum_signals" ON public.market_momentum_signals;
DROP POLICY IF EXISTS "Allow public read access to causal_relationships" ON public.causal_relationships;
DROP POLICY IF EXISTS "Allow public read access to skill_evolution_signals" ON public.skill_evolution_signals;

-- Recreating clean security policies
CREATE POLICY "Users can manage their own execution runs" ON public.execution_runs 
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage targets for their runs" ON public.execution_targets 
    FOR ALL USING (EXISTS (SELECT 1 FROM public.execution_runs r WHERE r.id = run_id AND r.user_id = auth.uid()));

CREATE POLICY "Users can manage logs for their runs" ON public.execution_logs 
    FOR ALL USING (EXISTS (SELECT 1 FROM public.execution_runs r WHERE r.id = run_id AND r.user_id = auth.uid()));

CREATE POLICY "Users can manage their own job applications" ON public.job_applications 
    FOR ALL USING (auth.uid() = user_id);

-- Global Public-Read access to metrics (any authenticated user can read)
CREATE POLICY "Allow public read access to market_signals" ON public.market_signals 
    FOR SELECT USING (true);

CREATE POLICY "Allow public read access to hiring_cycles" ON public.hiring_cycles 
    FOR SELECT USING (true);

CREATE POLICY "Allow public read access to funding_events" ON public.funding_events 
    FOR SELECT USING (true);

CREATE POLICY "Allow public read access to skill_predictions" ON public.skill_predictions 
    FOR SELECT USING (true);

CREATE POLICY "Allow public read access to macro_economic_signals" ON public.macro_economic_signals 
    FOR SELECT USING (true);

CREATE POLICY "Allow public read access to market_momentum_signals" ON public.market_momentum_signals 
    FOR SELECT USING (true);

CREATE POLICY "Allow public read access to causal_relationships" ON public.causal_relationships 
    FOR SELECT USING (true);

CREATE POLICY "Allow public read access to skill_evolution_signals" ON public.skill_evolution_signals 
    FOR SELECT USING (true);
