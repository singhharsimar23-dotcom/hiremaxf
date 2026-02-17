-- 20260214_convergence_logic.sql
-- OBJECTIVE: Restore broken ingestion convergence with safe, idempotent RPC.

BEGIN;

-- 1. Create the Missing RPC (Idempotent & Safe)
-- We drop first to avoid "cannot change return type" errors if a version already exists.
DROP FUNCTION IF EXISTS public.increment_session_completion(UUID);

CREATE OR REPLACE FUNCTION public.increment_session_completion(session_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Runs as Service Role (Bypasses RLS)
AS $$
DECLARE
    v_expected INT;
    v_completed INT;
BEGIN
    -- 1. Idempotent Increment
    -- We only increment if the session exists and is open/converging
    UPDATE public.ingestion_sessions
    SET completed_workers = completed_workers + 1
    WHERE id = session_id
    AND state IN ('open', 'converging') -- Don't touch closed sessions
    RETURNING expected_workers, completed_workers INTO v_expected, v_completed;

    -- 2. Check Convergence (Atomic Transition)
    IF found THEN
        -- If all workers done, mark as converged
        IF v_completed >= v_expected THEN
            UPDATE public.ingestion_sessions
            SET state = 'converged'
            WHERE id = session_id;
        END IF;
    END IF;

    -- 3. No Return Needed (Void)
    -- If session didn't match (e.g. invalid ID or already closed), we do nothing safely.
END;
$$;

-- 2. Grant Access to Service Role (Explicit)
GRANT EXECUTE ON FUNCTION public.increment_session_completion(UUID) TO service_role;
-- Revoke from Anon/Authenticated to ensure it's internal-only
REVOKE EXECUTE ON FUNCTION public.increment_session_completion(UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_session_completion(UUID) FROM anon;

COMMIT;
