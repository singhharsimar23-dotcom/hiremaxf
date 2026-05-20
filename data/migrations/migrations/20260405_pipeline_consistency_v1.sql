-- SWEEP 4: DATA CONSISTENCY & QUARANTINE
-- TARGET: Ghost Locks, Orphan Pointers, Embedding Stalls

-- 1. Create a function to check pipeline consistency and automatically heal deadlocks

CREATE OR REPLACE FUNCTION public.check_pipeline_consistency()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    ghost_locks_count INT;
    orphan_pointers_count INT;
    embedding_stalls_count INT;
    dead_letter_count INT;
    total_healed INT := 0;
BEGIN
    -- [1] Detect & Heal Ghost Locks
    -- Documents stuck in 'processing' for more than 15 minutes (typically a worker crash)
    WITH healed AS (
        UPDATE public.raw_job_documents
        SET 
            parse_status = 'retry',
            parse_attempts = parse_attempts + 1,
            error_reason = 'Ghost lock healed by pipeline consistency check'
        WHERE parse_status = 'processing'
          AND last_parsed_at < (NOW() - INTERVAL '15 minutes')
        RETURNING id
    )
    SELECT COUNT(*) INTO ghost_locks_count FROM healed;
    
    total_healed := total_healed + ghost_locks_count;

    -- [2] Detect & Quarantine Dead Letters
    -- Jobs that have failed parsing too many times but slipped through worker checks
    WITH quarantined AS (
        UPDATE public.raw_job_documents
        SET 
            parse_status = 'dead_letter',
            error_reason = 'Quarantined by pipeline consistency check (Max retries exceeded)'
        WHERE parse_status = 'retry'
          AND parse_attempts >= 5
        RETURNING id
    )
    SELECT COUNT(*) INTO dead_letter_count FROM quarantined;
    
    total_healed := total_healed + dead_letter_count;

    -- [3] Detect Orphan Pointers
    -- Canonical jobs that lost their job_pointers but are still active
    SELECT COUNT(*) INTO orphan_pointers_count
    FROM public.canonical_jobs c
    LEFT JOIN public.job_pointers p ON c.job_pointer_id = p.id
    WHERE c.is_active = true
      AND p.id IS NULL;

    -- [4] Detect Embedding Stalls
    -- Jobs marked for embedding but untouched for > 10 minutes
    SELECT COUNT(*) INTO embedding_stalls_count
    FROM public.canonical_jobs
    WHERE needs_embedding = true
      AND created_at < (NOW() - INTERVAL '10 minutes')
      AND is_active = true;

    -- Return diagnostic summary
    RETURN json_build_object(
        'ghost_locks_healed', ghost_locks_count,
        'dead_letters_quarantined', dead_letter_count,
        'orphan_canonical_jobs_detected', orphan_pointers_count,
        'embedding_stalls_detected', embedding_stalls_count,
        'total_healed', total_healed,
        'timestamp', NOW()
    );
END;
$$;

-- 2. Schedule the consistency check to run hourly
SELECT cron.schedule(
    'PIPELINE_CONSISTENCY_CHECK',
    '0 * * * *',
    'SELECT public.check_pipeline_consistency();'
);
