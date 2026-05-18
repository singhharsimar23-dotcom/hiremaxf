-- ═══════════════════════════════════════════════════════════════════════════════
-- supabase/migrations/20260421_cursor_cas_rpcs_v2.sql
-- Hardened Cursor CAS RPCs — Purges 'source_cursors' legacy references.
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Ensure cursors table matches V5.0 requirements
DO $$ 
BEGIN
    -- Upgrade cursor_offset to BIGINT to prevent overflows
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'cursors' 
        AND column_name = 'cursor_offset' 
        AND data_type = 'integer'
    ) THEN
        ALTER TABLE public.cursors ALTER COLUMN cursor_offset TYPE BIGINT;
        RAISE NOTICE 'Migrated public.cursors.cursor_offset to BIGINT';
    END IF;
END $$;

-- 2. read_cursor: Pure read of current BIGINT offset
CREATE OR REPLACE FUNCTION public.read_cursor(p_source TEXT)
RETURNS TABLE(current_offset BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY 
  SELECT c.cursor_offset::BIGINT
  FROM public.cursors c
  WHERE c.source = p_source;
END;
$$;

-- 3. atomic_reset_cursor_if_eq: Compare-And-Swap (CAS) Reset
-- Only resets to 0 if the DB value matches what the worker expected.
-- Prevents "Ghost Reset" where Worker A resets the work Worker B just did.
CREATE OR REPLACE FUNCTION public.atomic_reset_cursor_if_eq(
  p_source TEXT,
  p_expected_offset BIGINT
)
RETURNS TABLE(reset BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current BIGINT;
BEGIN
  -- Acquire row-level lock for the specific source
  SELECT c.cursor_offset INTO v_current 
  FROM public.cursors c
  WHERE c.source = p_source 
  FOR UPDATE;

  -- Atomic CAS check
  IF v_current IS NOT NULL AND v_current = p_expected_offset THEN
    UPDATE public.cursors 
    SET cursor_offset = 0, 
        updated_at = now() 
    WHERE source = p_source;
    RETURN QUERY SELECT true;
  ELSE
    -- Missed. Either cursor moved or it didn't exist.
    RETURN QUERY SELECT false;
  END IF;
END;
$$;

-- 4. atomic_advance_cursor: Incremental Atomic Update
-- Upgraded to BIGINT to match the table.
CREATE OR REPLACE FUNCTION public.atomic_advance_cursor(
  p_source TEXT,
  p_increment BIGINT
)
RETURNS TABLE(old_offset BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_offset BIGINT := 0;
BEGIN
  -- Row-level lock for the source
  PERFORM pg_advisory_xact_lock(hashtext(p_source));

  SELECT c.cursor_offset INTO v_old_offset
  FROM public.cursors c
  WHERE c.source = p_source
  FOR UPDATE;

  INSERT INTO public.cursors (source, cursor_offset, updated_at)
  VALUES (p_source, p_increment, now())
  ON CONFLICT (source)
  DO UPDATE SET
    cursor_offset = public.cursors.cursor_offset + p_increment,
    updated_at    = now();

  RETURN QUERY SELECT COALESCE(v_old_offset, 0);
END;
$$;

-- 5. Revoke/Grant Permissions
REVOKE ALL ON FUNCTION public.read_cursor(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_cursor(TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.atomic_reset_cursor_if_eq(TEXT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atomic_reset_cursor_if_eq(TEXT, BIGINT) TO service_role;

REVOKE ALL ON FUNCTION public.atomic_advance_cursor(TEXT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atomic_advance_cursor(TEXT, BIGINT) TO service_role;
