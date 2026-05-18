-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: 20260415_ingestion_system_final_hardening.sql
-- Goal: Synchronize DB schema with PersistenceEngine V4.2 implementation.
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Create Ingestion DLQ (Dead Letter Queue)
-- Stores failed payloads for manual inspection without PII leakage in logs.
CREATE TABLE IF NOT EXISTS public.ingestion_dlq (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name   TEXT NOT NULL,
  raw_payload   JSONB NOT NULL,
  error_message TEXT NOT NULL,
  trace_id      TEXT,
  failed_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Index for traceability analysis
CREATE INDEX IF NOT EXISTS idx_ingestion_dlq_trace_id ON public.ingestion_dlq(trace_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_dlq_source_name ON public.ingestion_dlq(source_name);

-- 2. Extend Source Reliability
-- Add columns used by PersistenceEngine for historical duplicate tracking.
ALTER TABLE public.source_reliability
  ADD COLUMN IF NOT EXISTS duplicate_rate_last_run FLOAT DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS avg_duplicate_rate       FLOAT DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS last_insert_count        INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_run_at              TIMESTAMPTZ;

-- 3. Fix atomic_advance_cursor
-- Changes: 
--   - Parameter name: p_new_offset -> p_increment (Matches TS implementation)
--   - Logic: Sets to increment (Actually advances the cursor instead of resetting it)
--   - Security: SECURITY DEFINER + Revoke Public execution.
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

-- 4. Extend job_pointers with trace_id
-- Ensures every job row can be traced back to the specific Cloudflare Worker run.
ALTER TABLE public.job_pointers
  ADD COLUMN IF NOT EXISTS trace_id TEXT;

-- Index for trace analysis
CREATE INDEX IF NOT EXISTS idx_job_pointers_trace_id ON public.job_pointers(trace_id);

-- 5. Audit Log Hook (Optional but recommended for FAANG-level visibility)
COMMENT ON TABLE public.ingestion_dlq IS 'Dead letter queue for failed job ingestion payloads.';
COMMENT ON COLUMN public.source_reliability.avg_duplicate_rate IS 'Exponential moving average of duplicate signals from this source.';
