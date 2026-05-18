-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: 20260419_preflight_schema_fix.sql
-- Goal: Fix schema drift. Add missing preflight tracking columns to cursors and
--       create the missing source_health table for validation metrics.
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Add missing columns used by auto-disable preflight logic
ALTER TABLE public.cursors 
  ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS consecutive_errors INTEGER DEFAULT 0;

-- 2. Create the missing source_health table requested by validateSources.ts
CREATE TABLE IF NOT EXISTS public.source_health (
    id SERIAL PRIMARY KEY,
    source TEXT NOT NULL,
    run_date DATE NOT NULL,
    error_message TEXT,
    raw_fetched INTEGER DEFAULT 0,
    usable_stored INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source, run_date)
);

-- Enable RLS for source_health
ALTER TABLE public.source_health ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role has full access to source_health" ON public.source_health;
CREATE POLICY "Service role has full access to source_health"
  ON public.source_health
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
