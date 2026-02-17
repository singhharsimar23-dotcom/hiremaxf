-- 20260214_enforce_state_machine.sql
-- OBJECTIVE: Enforce strict state machine models for Ingestion

BEGIN;

-- 1. Ingestion Commands Status
-- Cleanup: Map invalid statuses to 'failed'
UPDATE public.ingestion_commands
SET status = 'failed', error_reason = 'Legacy invalid status migration'
WHERE status NOT IN ('pending', 'processing', 'completed', 'failed');

-- Enforce: pending -> processing -> completed | failed
ALTER TABLE public.ingestion_commands
    DROP CONSTRAINT IF EXISTS check_ingestion_status;

ALTER TABLE public.ingestion_commands
    ADD CONSTRAINT check_ingestion_status
    CHECK (status IN ('pending', 'processing', 'completed', 'failed'));

-- 2. Ingestion Sessions State
-- Cleanup: Map invalid states to 'failed'
-- Note: Check if table exists first to be safe, but migration assumes existence.
UPDATE public.ingestion_sessions
SET state = 'failed'
WHERE state NOT IN ('open', 'converging', 'converged', 'closed', 'failed');

-- Enforce: open -> converging -> converged | closed | failed
ALTER TABLE public.ingestion_sessions
    DROP CONSTRAINT IF EXISTS check_session_state;

ALTER TABLE public.ingestion_sessions
    ADD CONSTRAINT check_session_state
    CHECK (state IN ('open', 'converging', 'converged', 'closed', 'failed'));

COMMIT;
