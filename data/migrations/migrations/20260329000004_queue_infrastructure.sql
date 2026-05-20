-- Migration: 20260329000004_queue_infrastructure.sql
-- Description: Add job queue and caching for Resume Singularity Engine.

-- 0. Ensure async_status type exists
DO $$ BEGIN
    CREATE TYPE public.async_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'RETRYING', 'DEAD_LETTER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. Job Queue Table
CREATE TABLE IF NOT EXISTS public.pipeline_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    job_id UUID REFERENCES public.jobs(id),
    type TEXT NOT NULL DEFAULT 'RESUME_GEN',
    status public.async_status NOT NULL DEFAULT 'PENDING',
    idempotency_key TEXT UNIQUE NOT NULL, -- WHY: Required for BREAK-003 enforcement
    payload JSONB NOT NULL DEFAULT '{}',
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3, -- WHY: Stability control
    last_error TEXT,
    locked_at TIMESTAMPTZ, -- WHY: Heartbeat logic for worker crash recovery
    worker_id UUID,        -- WHY: Binding job to a specific worker instance
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pipeline_jobs ENABLE ROW LEVEL SECURITY;

-- Policies for pipeline_jobs
CREATE POLICY "Users can view their own jobs" ON public.pipeline_jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage all jobs" ON public.pipeline_jobs FOR ALL USING (true);

-- 2. Pipeline Cache Table
CREATE TABLE IF NOT EXISTS public.pipeline_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key TEXT UNIQUE NOT NULL, -- SHA-256 of (user_id + profile_snapshot_id + job_id)
    data JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pipeline_cache ENABLE ROW LEVEL SECURITY;

-- 3. Telemetry Enhancements
ALTER TABLE public.pipeline_runs 
ADD COLUMN IF NOT EXISTS violation_summary JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS error_details TEXT;

-- 4. RPC for Atomic Claiming
CREATE OR REPLACE FUNCTION public.claim_pipeline_job(worker_id_val UUID)
RETURNS SETOF public.pipeline_jobs AS $$
BEGIN
  RETURN QUERY
  UPDATE public.pipeline_jobs
  SET 
    status = 'PROCESSING',
    worker_id = worker_id_val,
    locked_at = now(),
    attempts = attempts + 1,
    updated_at = now()
  WHERE id = (
    SELECT id 
    FROM public.pipeline_jobs 
    WHERE (status = 'PENDING' OR status = 'RETRYING')
    OR (status = 'PROCESSING' AND locked_at < now() - interval '5 minutes') -- WHY: Automatic reclaim on worker death
    ORDER BY 
      (status = 'PROCESSING') ASC, -- WHY: Prioritize fresh PENDING/RETRYING jobs over reclaimed ones
      created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Observability View
CREATE OR REPLACE VIEW public.view_pipeline_observability AS
SELECT 
    status,
    count(*) as job_count,
    round(avg(attempts), 2) as avg_attempts,
    max(updated_at) as last_activity
FROM public.pipeline_jobs
GROUP BY status;

-- 6. Trigger for updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_pipeline_jobs_updated_at ON public.pipeline_jobs;
CREATE TRIGGER update_pipeline_jobs_updated_at
BEFORE UPDATE ON public.pipeline_jobs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_status ON public.pipeline_jobs(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_user_status ON public.pipeline_jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_pipeline_cache_key ON public.pipeline_cache(cache_key);
