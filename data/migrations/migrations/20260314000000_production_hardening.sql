-- Production Hardening & Signal Integrity Migration
-- Date: 2026-03-14

-- 1. EVENT IDEMPOTENCY
ALTER TABLE public.ingestion_events
ADD COLUMN IF NOT EXISTS event_hash TEXT;

-- Create unique index on event_hash to enforce idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_hash ON public.ingestion_events (event_hash);

-- 2. SIGNAL INTEGRITY STORAGE (MARKET SIGNALS)
-- Standardizing and extending market_signals to meet strict integrity requirements
ALTER TABLE public.market_signals
ADD COLUMN IF NOT EXISTS entity TEXT, -- Mapping for company_key
ADD COLUMN IF NOT EXISTS confidence_score NUMERIC DEFAULT 0, -- RENAMED from 'confidence' in older migrations if it exists
ADD COLUMN IF NOT EXISTS evidence_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS distinct_sources INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS duplicate_ratio NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS normalized_velocity NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb; -- For Rules 12: evidence_roles, evidence_event_ids, evidence_sources

-- 3. DEAD LETTER ARCHIVE
CREATE TABLE IF NOT EXISTS public.dead_letter_archive (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID,
    topic TEXT,
    payload JSONB,
    worker_name TEXT,
    error_message TEXT,
    failed_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PIPELINE HEALTH RPC
CREATE OR REPLACE FUNCTION public.get_pipeline_health()
RETURNS TABLE (
    worker_name TEXT,
    lag_count BIGINT,
    failure_rate NUMERIC,
    last_active TIMESTAMPTZ,
    dlq_count BIGINT
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    WITH worker_lags AS (
        SELECT 
            co.consumer_name as w_name,
            COUNT(ie.id) as lag
        FROM public.consumer_offsets co
        LEFT JOIN public.ingestion_events ie ON ie.created_at > co.updated_at -- Simple lag proxy based on time, or id > last_processed_id if sequential
        GROUP BY co.consumer_name
    ),
    dlq_stats AS (
        SELECT worker_name as w_name, COUNT(*) as count
        FROM public.dead_letter_events
        GROUP BY worker_name
    )
    SELECT 
        m.stage,
        COALESCE(l.lag, 0),
        m.parser_failure_rate,
        COALESCE(co.updated_at, NOW()),
        COALESCE(d.count, 0)
    FROM (SELECT DISTINCT stage, parser_failure_rate FROM public.ingestion_metrics) m
    LEFT JOIN worker_lags l ON l.w_name = m.stage || '-worker'
    LEFT JOIN dlq_stats d ON d.w_name = m.stage || '-worker'
    LEFT JOIN public.consumer_offsets co ON co.consumer_name = m.stage || '-worker';
END;
$$;

-- 5. CLEANUP JOBS (STUBS FOR CRON)
CREATE OR REPLACE FUNCTION public.clean_dead_letter_events(retention_days INT DEFAULT 30)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
    moved_count INT;
BEGIN
    WITH deleted AS (
        DELETE FROM public.dead_letter_events
        WHERE failed_at < NOW() - (retention_days || ' days')::INTERVAL
        RETURNING *
    )
    INSERT INTO public.dead_letter_archive (event_id, topic, payload, worker_name, error_message, failed_at)
    SELECT event_id, topic, payload, worker_name, error_message, failed_at FROM deleted;
    
    GET DIAGNOSTICS moved_count = ROW_COUNT;
    RETURN moved_count;
END;
$$;
