-- 1. Create Ingestion Runs table (Missing in production)
CREATE TABLE IF NOT EXISTS public.ingestion_runs (
    run_id UUID PRIMARY KEY,
    trace_id TEXT NOT NULL,
    source TEXT NOT NULL,
    tier TEXT,
    status TEXT NOT NULL DEFAULT 'running',
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    jobs_fetched INTEGER DEFAULT 0,
    jobs_inserted INTEGER DEFAULT 0,
    jobs_skipped INTEGER DEFAULT 0,
    summary JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    duration_ms INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for ingestion_runs
ALTER TABLE public.ingestion_runs ENABLE ROW LEVEL SECURITY;
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ingestion_runs' AND policyname = 'Enable all for service role') THEN
        CREATE POLICY "Enable all for service role" ON public.ingestion_runs TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 2. Harden Ingestion Metrics for Atomic Accumulation
-- Ensure we have a unique constraint to allow ON CONFLICT updates
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ingestion_metrics_ts_source_key') THEN
        ALTER TABLE public.ingestion_metrics ADD CONSTRAINT ingestion_metrics_ts_source_key UNIQUE (ts, source);
    END IF;
END $$;

-- 3. Create Atomic Increment RPC for Metrics
CREATE OR REPLACE FUNCTION public.increment_pipeline_metrics(
    p_ts TIMESTAMPTZ,
    p_source TEXT,
    p_attempted INTEGER,
    p_ingested INTEGER,
    p_failed INTEGER,
    p_skipped_dupe INTEGER,
    p_skipped_low_quality INTEGER,
    p_duration_ms INTEGER
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.ingestion_metrics (
        ts, source, attempted, ingested, failed, skipped_dupe, skipped_low_quality, duration_ms
    )
    VALUES (
        p_ts, p_source, p_attempted, p_ingested, p_failed, p_skipped_dupe, p_skipped_low_quality, p_duration_ms
    )
    ON CONFLICT (ts, source) DO UPDATE SET
        attempted = ingestion_metrics.attempted + EXCLUDED.attempted,
        ingested = ingestion_metrics.ingested + EXCLUDED.ingested,
        failed = ingestion_metrics.failed + EXCLUDED.failed,
        skipped_dupe = ingestion_metrics.skipped_dupe + EXCLUDED.skipped_dupe,
        skipped_low_quality = ingestion_metrics.skipped_low_quality + EXCLUDED.skipped_low_quality,
        duration_ms = ingestion_metrics.duration_ms + EXCLUDED.duration_ms;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
