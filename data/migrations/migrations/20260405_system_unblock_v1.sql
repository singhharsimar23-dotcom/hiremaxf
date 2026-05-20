-- 🚀 HIREMAX SYSTEM UNBLOCK: SURGICAL CONCURRENCY v7.2
-- OBJECTIVE: UNBLOCK 10k BACKLOG VIA SOFT CONCURRENCY GATING

-- 1. REFACTOR TRIGGER Hub (Soft Concurrency Logic)
CREATE OR REPLACE FUNCTION public.safe_trigger_edge_function(p_function_name text, p_lock_name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_service_key TEXT;
    v_active_count INT;
    v_max_allowed  INT := 1; -- Default to safe serial for legacy tasks
BEGIN
    -- CONFIG: Load service key
    v_service_key := (SELECT value FROM public.system_settings WHERE key = 'SERVICE_ROLE_KEY' LIMIT 1);
    IF v_service_key IS NULL THEN
        v_service_key := ''; -- Load from system_settings.SERVICE_ROLE_KEY; no hardcoded fallback
    END IF;

    -- SCALING LOGIC: Worker-Specific Soft Concurrency Gating
    IF p_function_name = 'parser-worker' THEN
        SELECT count(*) INTO v_active_count 
        FROM public.raw_job_documents 
        WHERE parse_status = 'processing' 
          AND processing_started_at > now() - interval '10 minutes';
        v_max_allowed := 3; -- FIX 2 threshold
    ELSIF p_function_name = 'job-embedding-worker' THEN
        SELECT count(*) INTO v_active_count 
        FROM public.canonical_jobs 
        WHERE embedding_status = 'processing' 
          AND last_updated_at > now() - interval '10 minutes';
        v_max_allowed := 2; -- FIX 2 threshold
    ELSE
        -- LEGACY FALLBACK: HARD LOCK for non-scaling workers
        INSERT INTO public.pipeline_locks (lock_name, owner_id, expires_at)
        VALUES (p_lock_name, '00000000-0000-0000-0000-000000000000'::uuid, now() + interval '4 minutes')
        ON CONFLICT (lock_name) DO UPDATE 
        SET 
            expires_at = EXCLUDED.expires_at,
            created_at = now()
        WHERE public.pipeline_locks.expires_at < now();
        
        GET DIAGNOSTICS v_active_count = ROW_COUNT;
        IF v_active_count = 0 THEN RETURN; END IF;
        v_active_count := 0; v_max_allowed := 1; -- Force execution for legacy branch
    END IF;

    -- GATE: Exit if concurrency limit reached
    IF v_active_count >= v_max_allowed THEN
        RETURN;
    END IF;

    -- TRIGGER: Fire & Forget Edge Function
    PERFORM net.http_post(
        url := 'https://ssuknybhzcuusjardsve.supabase.co/functions/v1/' || p_function_name,
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || v_service_key,
            'Content-Type', 'application/json',
            'apikey', v_service_key
        ),
        body := '{}'::jsonb
    );
END;
$function$;

-- 2. ACCELERATE CRON PULSES (30s / 45s intervals)
-- NOTE: pg_cron only supports 1m granularity, so we use multiple offset jobs

-- PARSER PULSE A (Top of minute)
SELECT cron.unschedule('parser-worker-pulse');
SELECT cron.schedule('parser-worker-pulse-a', '* * * * *', 
    $$ SELECT public.safe_trigger_edge_function('parser-worker', 'LOCK_PARSER_WORKER') $$
);

-- PARSER PULSE B (30s offset)
SELECT cron.schedule('parser-worker-pulse-b', '* * * * *', 
    $$ SELECT pg_sleep(30); SELECT public.safe_trigger_edge_function('parser-worker', 'LOCK_PARSER_WORKER') $$
);

-- EMBEDDING PULSE A (Top of minute)
SELECT cron.unschedule('embedding-worker-pulse'); -- Cleanup if exists
SELECT cron.schedule('embedding-worker-pulse-a', '* * * * *', 
    $$ SELECT public.safe_trigger_edge_function('job-embedding-worker', 'LOCK_EMBEDDING_WORKER') $$
);

-- EMBEDDING PULSE B (45s offset - estimated as once per minute is close enough or use 3 per 2 min)
-- For surgical 45s, we trigger every minute but the soft concurrency prevents over-firing.
-- Given the rule FIX 3, we'll implement a second pulse with offset.
SELECT cron.schedule('embedding-worker-pulse-b', '* * * * *', 
    $$ SELECT pg_sleep(45); SELECT public.safe_trigger_edge_function('job-embedding-worker', 'LOCK_EMBEDDING_WORKER') $$
);

-- 3. VALIDATION QUERIES (Save for reference)
-- SELECT count(DISTINCT worker_id) FROM raw_job_documents WHERE parse_status = 'processing';
-- SELECT count(*) FROM canonical_jobs WHERE embedding_status = 'processing';
