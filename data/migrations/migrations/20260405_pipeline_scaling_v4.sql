-- 🚀 HIREMAX PIPELINE SCALING V4
-- PRODUCTION-GRADE CONCURRENCY & RECOVERY

-- 1. SCHEMA UPGRADES: Ownership and Priority
ALTER TABLE public.raw_job_documents 
ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS worker_id UUID,
ADD COLUMN IF NOT EXISTS base_priority INTEGER DEFAULT 1;

ALTER TABLE public.canonical_jobs 
ADD COLUMN IF NOT EXISTS embedding_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS embedding_worker_id UUID;

-- 2. ENHANCED METRICS
-- Redefining system_control_center instead of altering (it is a view)
DROP VIEW IF EXISTS public.system_control_center;

-- 3. CHECKOUT: PARSER WORKER (Ownership + Timeout + Dynamic Priority)
CREATE OR REPLACE FUNCTION public.checkout_pending_raw_documents_v3(p_limit INT, p_worker_id UUID)
RETURNS SETOF public.raw_job_documents AS $$
BEGIN
    RETURN QUERY
    WITH targets AS (
        SELECT id 
        FROM public.raw_job_documents
        WHERE is_parsed = false
        AND (
            parse_status IN ('pending', 'retry', 'failed') -- 🔥 Re-attempt failed as well in recovery cycles
            OR (
                parse_status = 'processing'
                AND (processing_started_at < NOW() - INTERVAL '10 minutes' OR processing_started_at IS NULL)
            )
        )
        -- 🔥 DYNAMIC PRIORITY: older jobs gain priority over time
        ORDER BY 
            (CASE WHEN char_length(full_text) < 200 THEN -1 ELSE base_priority END) 
            + (EXTRACT(EPOCH FROM (NOW() - ingested_at)) / 3600) DESC,
            ingested_at ASC
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.raw_job_documents r
    SET 
        parse_status = 'processing',
        processing_started_at = NOW(),
        worker_id = p_worker_id
    FROM targets
    WHERE r.id = targets.id
    RETURNING r.*;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. CHECKOUT: EMBEDDING WORKER (Decoupled State + Recovery)
CREATE OR REPLACE FUNCTION public.checkout_pending_embeddings_v3(p_limit INT, p_worker_id UUID)
RETURNS SETOF public.canonical_jobs AS $$
DECLARE
    v_count INT;
BEGIN
    -- 🔥 PHASE 6: SAFE RATE LIMITING
    SELECT COALESCE(SUM(count), 0) INTO v_count 
    FROM public.system_quotas 
    WHERE bucket_hour = date_trunc('hour', now());

    IF v_count >= 1000 THEN
        RETURN; -- Skip execution to preserve budget
    END IF;

    RETURN QUERY
    WITH targets AS (
        SELECT id 
        FROM public.canonical_jobs
        WHERE (
            embedding_status IN ('pending', 'retry', 'failed')
            OR (
                embedding_status = 'processing'
                AND (updated_at < NOW() - INTERVAL '10 minutes')
            )
        )
        AND is_active = true
        -- 🔥 DYNAMIC PRIORITY
        ORDER BY 
            base_priority + (EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600) DESC,
            created_at ASC
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.canonical_jobs c
    SET 
        embedding_status = 'processing',
        embedding_worker_id = p_worker_id,
        updated_at = NOW()
    FROM targets
    WHERE c.id = targets.id
    RETURNING c.*;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. REDEFINE CONTROL CENTER WITH FAILURE METRICS
CREATE OR REPLACE VIEW public.system_control_center AS 
WITH stats AS (
    SELECT 
        count(*) AS total_active,
        count(*) FILTER (WHERE is_suspected_spam) AS spam_count,
        count(*) FILTER (WHERE is_ready) AS intelligence_covered,
        count(*) FILTER (WHERE last_seen_at > (now() - '7 days'::interval)) AS fresh_count,
        count(*) FILTER (WHERE embedding_status = 'failed') AS emb_failed_count
    FROM public.canonical_jobs
    WHERE is_active = true
),
parse_stats AS (
    SELECT 
        count(*) FILTER (WHERE parse_status = 'parsed') AS parsed_count,
        count(*) FILTER (WHERE parse_status = 'failed') AS failed_count,
        count(*) FILTER (WHERE parse_status = 'retry') AS retry_count
    FROM public.raw_job_documents
)
SELECT 
    round(parse_stats.parsed_count::numeric / GREATEST(parse_stats.parsed_count + parse_stats.failed_count, 1)::numeric, 4) AS parsing_success_rate,
    round(stats.intelligence_covered::numeric / GREATEST(stats.total_active, 1)::numeric, 4) AS intelligence_coverage,
    round(stats.fresh_count::numeric / GREATEST(stats.total_active, 1)::numeric, 4) AS freshness_integrity,
    -- 🔥 FIX 6: FAILURE METRICS
    round(parse_stats.failed_count::numeric / GREATEST(parse_stats.parsed_count + parse_stats.failed_count, 1)::numeric, 4) AS parser_failure_rate,
    round(stats.emb_failed_count::numeric / GREATEST(stats.total_active, 1)::numeric, 4) AS embedding_failure_rate,
    round(parse_stats.retry_count::numeric / GREATEST(parse_stats.parsed_count + parse_stats.failed_count + parse_stats.retry_count, 1)::numeric, 4) AS retry_rate,
    round(stats.intelligence_covered::numeric / GREATEST(stats.total_active, 1)::numeric * 0.7 + (1.0 - stats.spam_count::numeric / GREATEST(stats.total_active, 1)::numeric) * 0.3, 4) AS signal_health_score
FROM stats, parse_stats;
