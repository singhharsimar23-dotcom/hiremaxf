-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: 20260415_fix_cursor_table_mapping.sql
-- Goal: Unify cursor management by renaming cursor_offset to cursors.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
    -- 1. Rename table if old name exists and new name doesn't
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cursor_offset' AND table_schema = 'public') 
       AND NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cursors' AND table_schema = 'public') THEN
        ALTER TABLE public.cursor_offset RENAME TO cursors;
    END IF;

    -- 2. Create cursors table if it still doesn't exist (e.g. fresh environment)
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cursors' AND table_schema = 'public') THEN
        CREATE TABLE public.cursors (
            source        TEXT PRIMARY KEY,
            cursor_offset INTEGER NOT NULL DEFAULT 0,
            updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    END IF;
END $$;

-- 3. Ensure columns match the expected schema
-- (In case cursor_offset had different column names, though we checked and it was correct)
-- ALTER TABLE public.cursors RENAME COLUMN old_name TO cursor_offset; -- Not needed based on our check

-- 4. Enable RLS and set policies
ALTER TABLE public.cursors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role has full access to cursors" ON public.cursors;
CREATE POLICY "Service role has full access to cursors"
  ON public.cursors
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 5. Re-apply the HARDENED atomic_advance_cursor with the correct increment logic
-- This ensures the function uses the table named 'cursors'.
CREATE OR REPLACE FUNCTION public.atomic_advance_cursor(
  p_source     TEXT,
  p_increment  INTEGER
)
RETURNS TABLE(old_offset INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_offset INTEGER := 0;
BEGIN
  -- Advisory lock prevents concurrent calls for the SAME source
  PERFORM pg_advisory_xact_lock(hashtext(p_source));

  -- Get current cursor_offset before update
  SELECT c.cursor_offset INTO v_old_offset
  FROM public.cursors c
  WHERE c.source = p_source;

  -- Upsert: Insert new row or update existing (adding increment)
  INSERT INTO public.cursors (source, cursor_offset, updated_at)
  VALUES (p_source, p_increment, NOW())
  ON CONFLICT (source)
  DO UPDATE SET
    cursor_offset = cursors.cursor_offset + p_increment,
    updated_at    = NOW();

  -- Return the old offset (the start point for the current batch)
  RETURN QUERY SELECT COALESCE(v_old_offset, 0);
END;
$$;

-- Security hardening
REVOKE ALL ON FUNCTION public.atomic_advance_cursor(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atomic_advance_cursor(TEXT, INTEGER) TO service_role;
