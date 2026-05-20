
-- HIREMAX PRODUCTION DATABASE SCHEMA (v2.0)
-- Optimized for Supabase/PostgreSQL

-- 1. Profiles & Plan Management
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    plan TEXT NOT NULL DEFAULT 'Starter' CHECK (plan IN ('Starter', 'Market Verdict', 'Career Pro', 'Career Elite', 'Automation')),
    credits INTEGER NOT NULL DEFAULT 0,
    domain TEXT NOT NULL DEFAULT 'UNSELECTED',
    connected_providers TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{
        "identities": {},
        "daily_application_limit": 50,
        "applications_sent_today": 0
    }'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Resume Management (Groups & Versions)
CREATE TABLE IF NOT EXISTS public.resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.resume_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id UUID REFERENCES public.resumes(id) ON DELETE CASCADE NOT NULL,
    version_type TEXT NOT NULL CHECK (version_type IN ('original', 'optimized')),
    template_id TEXT,
    data JSONB NOT NULL,
    analysis_id UUID, -- Link to the analysis that generated this version if applicable
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. AI Diagnostics (The AI Review)
CREATE TABLE IF NOT EXISTS public.analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    resume_id UUID REFERENCES public.resumes(id) ON DELETE SET NULL,
    target_role TEXT NOT NULL,
    role_track TEXT NOT NULL,
    resume_text TEXT NOT NULL,
    results_json JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Career Intelligence (Elite Snapshots)
CREATE TABLE IF NOT EXISTS public.market_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    context_json JSONB NOT NULL,
    results_json JSONB NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Execution Pipeline (Applications)
CREATE TABLE IF NOT EXISTS public.execution_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    resume_id TEXT NOT NULL, -- UUID string or reference
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

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_logs ENABLE ROW LEVEL SECURITY;

-- POLICIES (Simple Identity-Based)
CREATE POLICY "Users can only access their own profile" ON public.profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users can manage their own resumes" ON public.resumes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own versions" ON public.resume_versions FOR ALL USING (EXISTS (SELECT 1 FROM public.resumes r WHERE r.id = resume_id AND r.user_id = auth.uid()));
CREATE POLICY "Users can manage their own analyses" ON public.analyses FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own snapshots" ON public.market_snapshots FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own execution runs" ON public.execution_runs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view targets for their runs" ON public.execution_targets FOR SELECT USING (EXISTS (SELECT 1 FROM public.execution_runs r WHERE r.id = run_id AND r.user_id = auth.uid()));
CREATE POLICY "Users can view logs for their runs" ON public.execution_logs FOR SELECT USING (EXISTS (SELECT 1 FROM public.execution_runs r WHERE r.id = run_id AND r.user_id = auth.uid()));
