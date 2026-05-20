-- SWEEP 6: AUTONOMOUS ULTIMATE (RELIABILITY & STABILITY)
-- TARGET: Eliminate "Zombie Paralysis" and redundant cron jobs.

-- 1. [FIX] Standardize Column Names (updated_at vs last_updated_at)
-- Based on audit, we ensure both exist or align with the worker.
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'canonical_jobs' AND column_name = 'updated_at') THEN
        ALTER TABLE public.canonical_jobs ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- 2. [V4] Memory-Safe Embedding Checkout
-- JOINS raw_job_documents internally to returned the full_text, 
-- preventing the worker from doing a separate expensive SELECT.
CREATE OR REPLACE FUNCTION public.checkout_pending_embeddings_v4(
    p_limit INT DEFAULT 25,
    p_worker_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    full_text TEXT,
    retry_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH target_jobs AS (
        SELECT c.id, r.full_text, c.parse_attempts as retry_count
        FROM public.canonical_jobs c
        INNER JOIN public.raw_job_documents r ON c.raw_document_id = r.id
        WHERE c.needs_embedding = true
          AND c.embedding_status IN ('pending', 'retry')
          AND c.is_active = true
        ORDER BY c.created_at ASC
        LIMIT p_limit
        FOR UPDATE OF c SKIP LOCKED
    )
    UPDATE public.canonical_jobs c
    SET 
        embedding_status = 'processing',
        embedding_worker_id = p_worker_id,
        last_updated_at = NOW(),
        updated_at = NOW()
    FROM target_jobs tj
    WHERE c.id = tj.id
    RETURNING c.id, tj.full_text, tj.retry_count;
END;
$$;

-- 3. [UNIFIED] Pipeline Governance Janitor
-- One function to rule them all. Consolidates 6 fragmented jobs.
CREATE OR REPLACE FUNCTION public.unified_pipeline_janitor()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    parsing_stalls INT;
    embedding_stalls INT;
    dead_letters INT;
    snapshot_refreshed BOOLEAN := false;
BEGIN
    -- [A] Heal Parsing Stalls (Ghost Locks)
    WITH healed AS (
        UPDATE public.raw_job_documents
        SET 
            parse_status = 'retry',
            parse_attempts = parse_attempts + 1,
            last_parsed_at = NOW()
        WHERE parse_status = 'processing'
          AND last_parsed_at < (NOW() - INTERVAL '15 minutes')
        RETURNING id
    )
    SELECT COUNT(*) INTO parsing_stalls FROM healed;

    -- [B] Heal Embedding Stalls (Orphaned Locks)
    WITH healed AS (
        UPDATE public.canonical_jobs
        SET 
            embedding_status = 'pending',
            embedding_worker_id = NULL,
            last_updated_at = NOW()
        WHERE embedding_status = 'processing'
          AND last_updated_at < (NOW() - INTERVAL '15 minutes')
        RETURNING id
    )
    SELECT COUNT(*) INTO embedding_stalls FROM healed;

    -- [C] Quarantine Dead Letters
    WITH quarantined AS (
        UPDATE public.raw_job_documents
        SET parse_status = 'dead_letter'
        WHERE parse_attempts >= 5
          AND parse_status IN ('pending', 'retry')
        RETURNING id
    )
    SELECT COUNT(*) INTO dead_letters FROM quarantined;

    -- [D] Refresh Observability
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.system_health_snapshot;
    snapshot_refreshed := true;

    -- [E] Log Event (Combined)
    IF (parsing_stalls + embedding_stalls + dead_letters) > 0 THEN
        INSERT INTO public.pipeline_failures (source, error_message, severity)
        VALUES ('AUTONOMOUS_JANITOR', 
                'Healed ' || parsing_stalls || ' parsing and ' || embedding_stalls || ' embedding stalls. Quarantined ' || dead_letters || ' records.',
                'INFO');
    END IF;

    RETURN json_build_object(
        'parsing_healed', parsing_stalls,
        'embedding_healed', embedding_stalls,
        'dead_letters', dead_letters,
        'snapshot_refreshed', snapshot_refreshed,
        'timestamp', NOW()
    );
END;
$$;

-- 4. [CRON] Consolidate 10+ Jobs into Clean Autonomous Governance
SELECT cron.unschedule('watchdog');
SELECT cron.unschedule('invariants');
SELECT cron.unschedule('unstick_processing_jobs');
SELECT cron.unschedule('refresh-system-health-snapshot');
SELECT cron.unschedule('OBSERVABILITY_REFRESH_JANITOR');
SELECT cron.unschedule('PIPELINE_CONSISTENCY_CHECK');

-- New Unified Governance (Runs every 2m)
SELECT cron.schedule(
    'UNIFIED_AUTONOMOUS_GOVERNANCE',
    '*/2 * * * *',
    'SELECT public.unified_pipeline_janitor();'
);

-- Adjust Ingestion Pulse for Free Tier Balance (Every 10m)
-- This ensures a continuous drip rather than periodic spikes.
UPDATE cron.job 
SET schedule = '*/10 * * * *' 
WHERE jobname = 'ingestion_worker';

-- Ensure Worker Pulses are synchronized
UPDATE cron.job SET schedule = '* * * * *' WHERE jobname = 'parser-worker-pulse-a';
UPDATE cron.job SET schedule = '* * * * *' WHERE jobname = 'embedding-worker-pulse-a';

-- 5. [RGP] Access Control
GRANT EXECUTE ON FUNCTION public.checkout_pending_embeddings_v4(INT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.unified_pipeline_janitor() TO service_role;
