-- ═══════════════════════════════════════════════════════════════════════════════
-- SQL Migration: Lock Architecture Reinforcements
-- Fixes permanent deadlock, false parallelism, and broken ownership bugs.
-- ═══════════════════════════════════════════════════════════════════════════════

-- FIX 2: HARD TTL OVERRIDE (Anti-Deadlock + True Atomicity)
CREATE OR REPLACE FUNCTION public.acquire_lock(
    p_lock_name TEXT,
    p_owner_id UUID,
    p_ttl_seconds INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    v_locked BOOLEAN;
BEGIN
    INSERT INTO public.locks (lock_name, owner_id, expires_at)
    VALUES (p_lock_name, p_owner_id, NOW() + (p_ttl_seconds || ' seconds')::interval)
    ON CONFLICT (lock_name)
    DO UPDATE
    SET owner_id = EXCLUDED.owner_id,
        expires_at = EXCLUDED.expires_at
    -- The critical override: Only claim if expired (or released cleanly)
    WHERE public.locks.expires_at < NOW() OR public.locks.owner_id IS NULL
    RETURNING TRUE INTO v_locked;

    RETURN COALESCE(v_locked, FALSE);
END;
$$ LANGUAGE plpgsql;

-- FIX 1: LOCK OWNERSHIP ENFORCEMENT (Mandatory Authority)
CREATE OR REPLACE FUNCTION public.release_lock(
    p_lock_name TEXT,
    p_owner_id UUID
) RETURNS VOID AS $$
BEGIN
    -- Only the legitimate owner can release this lock
    UPDATE public.locks
    SET owner_id = NULL, expires_at = NULL
    WHERE lock_name = p_lock_name
    AND owner_id = p_owner_id;
END;
$$ LANGUAGE plpgsql;

-- FIX 3: EXECUTION HEARTBEAT (Active Keep-Alive)
CREATE OR REPLACE FUNCTION public.refresh_lock(
    p_lock_name TEXT,
    p_owner_id UUID,
    p_ttl_seconds INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    v_updated BOOLEAN;
BEGIN
    -- Only active holding workers can refresh their lock
    UPDATE public.locks
    SET expires_at = NOW() + (p_ttl_seconds || ' seconds')::interval
    WHERE lock_name = p_lock_name
    AND owner_id = p_owner_id
    RETURNING TRUE INTO v_updated;

    RETURN COALESCE(v_updated, FALSE);
END;
$$ LANGUAGE plpgsql;
