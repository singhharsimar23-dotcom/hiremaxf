-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: 20260415_lock_service_infrastructure.sql
-- Goal: Provide distributed locking for parallel ingestion workers.
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Create Locks Table
CREATE TABLE IF NOT EXISTS public.locks (
    lock_name   TEXT PRIMARY KEY,
    owner_id    UUID NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL
);

-- Index for expiration cleanup
CREATE INDEX IF NOT EXISTS idx_locks_expires_at ON public.locks(expires_at);

-- Clean up existing functions if signature changed
DROP FUNCTION IF EXISTS public.acquire_lock(TEXT, UUID, INTEGER);
DROP FUNCTION IF EXISTS public.release_lock(TEXT, UUID);
DROP FUNCTION IF EXISTS public.refresh_lock(TEXT, UUID, INTEGER);

-- 2. acquire_lock RPC
-- Logic: 
-- - If lock doesn't exist, acquire.
-- - If lock exists but expired, take over.
-- - If lock exists and valid, fail.
CREATE OR REPLACE FUNCTION public.acquire_lock(
    p_lock_name   TEXT,
    p_owner_id    UUID,
    p_ttl_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Cleanup expired locks first (Lazy cleanup)
    DELETE FROM public.locks WHERE expires_at < NOW();

    INSERT INTO public.locks (lock_name, owner_id, expires_at)
    VALUES (p_lock_name, p_owner_id, NOW() + (p_ttl_seconds || ' seconds')::INTERVAL)
    ON CONFLICT (lock_name) DO UPDATE
    SET 
        owner_id = EXCLUDED.owner_id,
        expires_at = EXCLUDED.expires_at
    WHERE locks.expires_at < NOW(); -- Only update if expired

    RETURN FOUND;
END;
$$;

-- 3. release_lock RPC
CREATE OR REPLACE FUNCTION public.release_lock(
    p_lock_name TEXT,
    p_owner_id  UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.locks
    WHERE lock_name = p_lock_name AND owner_id = p_owner_id;
    RETURN FOUND;
END;
$$;

-- 4. refresh_lock RPC
CREATE OR REPLACE FUNCTION public.refresh_lock(
    p_lock_name   TEXT,
    p_owner_id    UUID,
    p_ttl_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.locks
    SET expires_at = NOW() + (p_ttl_seconds || ' seconds')::INTERVAL
    WHERE lock_name = p_lock_name AND owner_id = p_owner_id;
    
    RETURN FOUND;
END;
$$;

-- Security Hardening
REVOKE ALL ON TABLE public.locks FROM PUBLIC;
GRANT ALL ON TABLE public.locks TO service_role;

REVOKE ALL ON FUNCTION public.acquire_lock(TEXT, UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acquire_lock(TEXT, UUID, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.release_lock(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_lock(TEXT, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.refresh_lock(TEXT, UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_lock(TEXT, UUID, INTEGER) TO service_role;
