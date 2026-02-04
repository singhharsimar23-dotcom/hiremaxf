
-- HireMax Execution Schema

-- 1. Execution Runs (Parent Record)
CREATE TABLE public.execution_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    resume_id TEXT NOT NULL,
    target_role TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'aborted')),
    error_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 2. Execution Targets (Job Postings)
CREATE TABLE public.execution_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES public.execution_runs(id) ON DELETE CASCADE,
    job_title TEXT NOT NULL,
    company TEXT NOT NULL,
    apply_url TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('queued', 'submitted', 'failed')),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 3. Execution Logs (Audit Trail)
CREATE TABLE public.execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES public.execution_runs(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    level TEXT NOT NULL CHECK (level IN ('info', 'success', 'error')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.execution_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_logs ENABLE ROW LEVEL SECURITY;

-- Simple Ownership Policies
CREATE POLICY "Users can manage their own runs" ON public.execution_runs 
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their run targets" ON public.execution_targets 
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.execution_runs WHERE id = run_id AND user_id = auth.uid()));

CREATE POLICY "Users can view their run logs" ON public.execution_logs 
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.execution_runs WHERE id = run_id AND user_id = auth.uid()));
