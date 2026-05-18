-- ═══════════════════════════════════════════════════════════════════════════════
-- supabase/migrations/20260412_atomic_advance_cursor.sql
-- REQUIRED: Used by PersistenceEngine.advanceCursor() in persistence.ts
-- System will throw hard if this function does not exist.
--
-- FIX: `offset` is a reserved keyword in PostgreSQL.
--      Column renamed to `cursor_offset` to avoid syntax error.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Ensure the cursors table exists (idempotent)
CREATE TABLE IF NOT EXISTS public.cursors (
  source        TEXT PRIMARY KEY,
  cursor_offset INTEGER NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- atomic_advance_cursor: Upserts the cursor and returns the OLD cursor_offset.
-- This is an atomic single-statement operation — no race condition possible.
-- Called by: persistence.ts → PersistenceEngine.advanceCursor()
CREATE OR REPLACE FUNCTION public.atomic_advance_cursor(
  p_source       TEXT,
  p_new_offset   INTEGER
)
RETURNS TABLE(old_offset INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_offset INTEGER := 0;
BEGIN
  -- Advisory lock prevents concurrent calls for the same source
  PERFORM pg_advisory_xact_lock(hashtext(p_source));

  -- Get current cursor_offset before update
  SELECT c.cursor_offset INTO v_old_offset
  FROM public.cursors c
  WHERE c.source = p_source;

  -- Upsert: Insert new row or update existing
  INSERT INTO public.cursors (source, cursor_offset, updated_at)
  VALUES (p_source, p_new_offset, NOW())
  ON CONFLICT (source)
  DO UPDATE SET
    cursor_offset = p_new_offset,
    updated_at    = NOW();

  -- Return the old offset (what caller should process from)
  RETURN QUERY SELECT COALESCE(v_old_offset, 0);
END;
$$;

-- Grant execute to service_role only (not anon)
REVOKE ALL ON FUNCTION public.atomic_advance_cursor(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atomic_advance_cursor(TEXT, INTEGER) TO service_role;
