-- 📈 HIREMAX WORKER OBSERVABILITY v7.4 FINAL
-- OBJECTIVE: HEARTBEATING + DRAIN MONITORING + EXIT REASONING

-- 1. Worker Heartbeat Table
CREATE TABLE IF NOT EXISTS public.worker_heartbeat (
    worker_id UUID PRIMARY KEY,
    service_name TEXT NOT NULL,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    jobs_processed INT DEFAULT 0,
    exit_reason TEXT, -- 'completed', 'hard_stop', 'error'
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 2. Heartbeat Upsert RPC
CREATE OR REPLACE FUNCTION public.upsert_worker_heartbeat(
    p_worker_id UUID,
    p_service_name TEXT,
    p_jobs_processed INT,
    p_exit_reason TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.worker_heartbeat (
        worker_id, 
        service_name, 
        last_seen, 
        jobs_processed, 
        exit_reason, 
        metadata
    )
    VALUES (
        p_worker_id, 
        p_service_name, 
        NOW(), 
        p_jobs_processed, 
        p_exit_reason, 
        p_metadata
    )
    ON CONFLICT (worker_id) DO UPDATE SET
        last_seen = EXCLUDED.last_seen,
        jobs_processed = EXCLUDED.jobs_processed,
        exit_reason = COALESCE(EXCLUDED.exit_reason, worker_heartbeat.exit_reason),
        metadata = worker_heartbeat.metadata || EXCLUDED.metadata;
END;
$$;

-- 3. Backlog Drain Monitor View (Snapshot of current stall)
CREATE OR REPLACE VIEW public.backlog_drain_monitor AS
SELECT 
    parse_status,
    count(*) as job_count,
    min(ingested_at) as oldest_job,
    max(last_parsed_at) as last_activity
FROM public.raw_job_documents
GROUP BY parse_status;

-- 4. Enable RLS
ALTER TABLE public.worker_heartbeat ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for service role" ON public.worker_heartbeat
    USING (true) WITH CHECK (true);
