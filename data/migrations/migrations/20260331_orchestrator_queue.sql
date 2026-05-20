-- Migration: 20260331_orchestrator_queue
-- Description: Create persistent task queue for zero-loss ingestion.

CREATE TABLE IF NOT EXISTS public.orchestrator_task_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    retry_count INT DEFAULT 0,
    next_attempt_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    run_id UUID -- Track which run created/processed this task
);

-- Index for efficient queue fetching
CREATE INDEX IF NOT EXISTS idx_task_queue_fetch 
ON public.orchestrator_task_queue (status, next_attempt_at) 
WHERE status = 'pending';

-- Index for cleanup/monitoring
CREATE INDEX IF NOT EXISTS idx_task_queue_created_at 
ON public.orchestrator_task_queue (created_at);

-- Dead-man switch function (if needed for RPC)
-- This logic is handled in-code as well, but a DB trigger can flag critical stalls.
CREATE OR REPLACE FUNCTION public.check_orchestrator_health()
RETURNS VOID AS $$
DECLARE
    last_run TIMESTAMPTZ;
BEGIN
    SELECT MAX(started_at) INTO last_run FROM public.discovery_runs;
    IF last_run < NOW() - INTERVAL '10 minutes' THEN
        INSERT INTO public.integrity_events (event_type, source, message, metadata)
        VALUES ('CRITICAL_STALL', 'DATABASE_MONITOR', 'Orchestrator has not started in 10 minutes', jsonb_build_object('last_run', last_run));
    END IF;
END;
$$ LANGUAGE plpgsql;
