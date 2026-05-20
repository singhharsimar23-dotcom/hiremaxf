-- 🛡️ HIREMAX PIPELINE HARDENING: SQL LAYER v7.4
-- OBJECTIVE: PRIORITY SHUFFLE + ZOMBIE RESET + STABILITY TRACKING

-- 1. ADD retry_count column if missing (Stability tracking)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='raw_job_documents' AND column_name='retry_count') THEN
        ALTER TABLE public.raw_job_documents ADD COLUMN retry_count INT DEFAULT 0;
    END IF;
END $$;

-- 2. SURGICAL ZOMBIE RESET (Kill the current stall)
UPDATE public.raw_job_documents 
SET 
    parse_status = 'pending',
    worker_id = NULL,
    processing_started_at = NULL,
    retry_count = COALESCE(retry_count, 0) + 1
WHERE parse_status = 'processing' 
  AND worker_id IS NOT NULL 
  AND (processing_started_at < NOW() - INTERVAL '10 minutes' OR processing_started_at IS NULL);

-- 3. UPGRADED CHECKOUT RPC (v4: Surgical Priority)
CREATE OR REPLACE FUNCTION public.checkout_pending_raw_documents_v4(p_limit int, p_worker_id uuid)
 RETURNS SETOF raw_job_documents
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    WITH targets AS (
        SELECT id 
        FROM public.raw_job_documents
        WHERE is_parsed = false
        AND (
            parse_status IN ('pending', 'retry', 'low_quality')
            OR (
                parse_status = 'processing'
                AND processing_started_at < NOW() - INTERVAL '10 minutes'
            )
        )
        ORDER BY 
            CASE 
                WHEN parse_status = 'pending' THEN 1
                WHEN parse_status = 'retry' THEN 2
                ELSE 3
            END ASC,
            priority DESC,
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
$function$;

-- 4. TRIGGER Hub Refining (Embedder status check fix)
CREATE OR REPLACE FUNCTION public.safe_trigger_edge_function(p_function_name text, p_lock_name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_service_key TEXT;
    v_active_count INT;
    v_max_allowed  INT := 1;
BEGIN
    v_service_key := (SELECT value FROM public.system_settings WHERE key = 'SERVICE_ROLE_KEY' LIMIT 1);

    IF p_function_name = 'parser-worker' THEN
        SELECT count(*) INTO v_active_count 
        FROM public.raw_job_documents 
        WHERE parse_status = 'processing' 
          AND processing_started_at > now() - interval '10 minutes';
        v_max_allowed := 3;
    ELSIF p_function_name = 'job-embedding-worker' THEN
        SELECT count(*) INTO v_active_count 
        FROM public.canonical_jobs 
        WHERE embedding_status = 'processing' 
          AND updated_at > now() - interval '10 minutes';
        v_max_allowed := 2;
    ELSE
        INSERT INTO public.pipeline_locks (lock_name, owner_id, expires_at)
        VALUES (p_lock_name, '00000000-0000-0000-0000-000000000000'::uuid, now() + interval '4 minutes')
        ON CONFLICT (lock_name) DO UPDATE 
        SET expires_at = EXCLUDED.expires_at, created_at = now()
        WHERE public.pipeline_locks.expires_at < now();
        
        v_active_count := 0; v_max_allowed := 1;
    END IF;

    IF v_active_count >= v_max_allowed THEN RETURN; END IF;

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
