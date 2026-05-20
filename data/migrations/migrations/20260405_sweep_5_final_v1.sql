-- SWEEP 5: HYPER-OBSERVABILITY & BATCHED HYGIENE
-- TARGET: Materialized View Stalls, Embedding Stalls, Lock Contention

-- 1. Accelerate Observability (1-minute Fidelity)
-- We target existing cron jobs by name to avoid duplicates.

-- Update system_health_snapshot refresh
UPDATE cron.job 
SET schedule = '* * * * *'
WHERE jobname = 'refresh-system-health-snapshot';

-- Update discovery stats refresh (Reanimation janitor)
UPDATE cron.job
SET schedule = '* * * * *'
WHERE jobname = 'OBSERVABILITY_REFRESH_JANITOR';

-- 2. Enhanced Automated Healing (Embedding Stalls)
-- We upgrade the function to actively "kick" stalled embedding jobs.

CREATE OR REPLACE FUNCTION public.check_pipeline_consistency()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    ghost_locks_count INT;
    orphan_pointers_count INT;
    embedding_stalls_healed INT;
    dead_letter_count INT;
    total_healed INT := 0;
BEGIN
    -- [1] Ghost Locks (Parsing)
    WITH healed_parsing AS (
        UPDATE public.raw_job_documents
        SET 
            parse_status = 'retry',
            parse_attempts = parse_attempts + 1,
            error_reason = 'Ghost lock healed by consistency check (' || NOW() || ')'
        WHERE parse_status = 'processing'
          AND last_parsed_at < (NOW() - INTERVAL '15 minutes')
        RETURNING id
    )
    SELECT COUNT(*) INTO ghost_locks_count FROM healed_parsing;

    -- [2] Dead Letters
    WITH quarantined AS (
        UPDATE public.raw_job_documents
        SET 
            parse_status = 'dead_letter',
            error_reason = 'Quarantined (Max retries exceeded)'
        WHERE parse_status = 'retry'
          AND parse_attempts >= 5
        RETURNING id
    )
    SELECT COUNT(*) INTO dead_letter_count FROM quarantined;

    -- [3] Embedding Stalls (THE FIX)
    -- If a job is marked 'needs_embedding' but created > 30 mins ago and not updated, 
    -- we reset the created_at to 'now' to move it to the front/back of the worker query, 
    -- and log the event.
    WITH healed_embedding AS (
        UPDATE public.canonical_jobs
        SET 
            created_at = NOW(), -- Force re-queue for workers filtering by recency
            needs_embedding = true
        WHERE needs_embedding = true
          AND created_at < (NOW() - INTERVAL '30 minutes')
          AND is_active = true
        RETURNING id
    )
    SELECT COUNT(*) INTO embedding_stalls_healed FROM healed_embedding;

    -- [4] Orphan Pointers (Logging only)
    SELECT COUNT(*) INTO orphan_pointers_count
    FROM public.canonical_jobs c
    LEFT JOIN public.job_pointers p ON c.job_pointer_id = p.id
    WHERE c.is_active = true
      AND p.id IS NULL;

    -- Log healing event if anything happened
    IF (ghost_locks_count + embedding_stalls_healed) > 0 THEN
        INSERT INTO public.pipeline_failures (source, error_message, severity)
        VALUES ('CONSISTENCY_CHECK', 
                'Healed ' || ghost_locks_count || ' ghost locks and ' || embedding_stalls_healed || ' embedding stalls.', 
                'INFO');
    END IF;

    RETURN json_build_object(
        'ghost_locks_healed', ghost_locks_count,
        'dead_letters_quarantined', dead_letter_count,
        'embedding_stalls_healed', embedding_stalls_healed,
        'orphan_canonical_jobs_detected', orphan_pointers_count,
        'timestamp', NOW()
    );
END;
$$;

-- 3. Batched Janitor (Prevent Lock Contention)
-- Replaces previous un-batched purges.

CREATE OR REPLACE FUNCTION public.purge_stale_data_v3(p_limit INT DEFAULT 5000)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_docs INT := 0;
    deleted_pointers INT := 0;
BEGIN
    -- Delete from raw_job_documents in batches of p_limit
    WITH target_docs AS (
        SELECT id FROM public.raw_job_documents
        WHERE ingested_at < (NOW() - INTERVAL '14 days')
          AND is_parsed = true
        LIMIT p_limit
    ), deleted AS (
        DELETE FROM public.raw_job_documents
        WHERE id IN (SELECT id FROM target_docs)
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_docs FROM deleted;

    -- Delete from job_pointers (The Heavy Table)
    -- Only delete if NOT bookmarked, NOT applied, and NOT canonicalized.
    WITH target_pointers AS (
        SELECT id FROM public.job_pointers
        WHERE last_checked_at < (NOW() - INTERVAL '7 days')
          AND id NOT IN (SELECT job_id FROM public.user_bookmarks)
          AND id NOT IN (SELECT job_id FROM public.applications)
          AND id NOT IN (SELECT job_pointer_id FROM public.canonical_jobs)
        LIMIT p_limit
    ), deleted AS (
        DELETE FROM public.job_pointers
        WHERE id IN (SELECT id FROM target_pointers)
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_pointers FROM deleted;

    RETURN json_build_object(
        'deleted_raw_docs', deleted_docs,
        'deleted_job_pointers', deleted_pointers,
        'batch_limit', p_limit,
        'timestamp', NOW()
    );
END;
$$;

-- Update Cron for Janitor to use V3 and run every 6 hours
SELECT cron.unschedule('cleanup-stale-job-pointers');
SELECT cron.unschedule('cleanup-parsed-raw-documents');

SELECT cron.schedule(
    'BATCHED_JANITOR_V3',
    '0 */6 * * *',
    'SELECT public.purge_stale_data_v3(10000);'
);
