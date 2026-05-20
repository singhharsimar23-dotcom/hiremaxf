-- DEEP AUDIT FIXES v1.0: ERADICATE RESOURCE POISONING & SPOFS
-- 1. Unschedule lethal pg_sleep pulse cron jobs
-- 2. Terminate safe_trigger_edge_function
-- 3. Install resilient component-specific triggers

-- Drop the dangerous pg_sleep jobs
SELECT cron.unschedule('parser-worker-pulse-b');
SELECT cron.unschedule('embedding-worker-pulse-b');

-- Now, replace the centralized SPOF safe_trigger_edge_function
-- with independent native HTTP triggers that read ONLY from system_settings.

CREATE OR REPLACE FUNCTION public.trigger_parser_worker()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_service_key TEXT;
    v_db_url TEXT;
BEGIN
    SELECT value INTO v_service_key FROM public.system_settings WHERE key = 'SERVICE_ROLE_KEY' LIMIT 1;
    -- Retrieve API base URL. If absent, fallback to known edge URL layout.
    SELECT value INTO v_db_url FROM public.system_settings WHERE key = 'SUPABASE_DB_URL' LIMIT 1;
    
    IF v_service_key IS NULL THEN
        -- FAANG-Level logging constraint: Do not fallback on hardcoded tokens. Log the failure natively.
        INSERT INTO public.pipeline_failures (stage, worker_name, error_message, error_code, metadata)
        VALUES ('trigger', 'cron', 'SERVICE_ROLE_KEY missing from system_settings', 'AUTH_DRIFT', '{}'::jsonb);
        RETURN;
    END IF;

    -- Avoid making net calls directly if URL is unknown, default to static project domain
    PERFORM net.http_post(
        url := 'https://ssuknybhzcuusjardsve.supabase.co/functions/v1/parser-worker',
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || v_service_key,
            'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_embedding_worker()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_service_key TEXT;
BEGIN
    SELECT value INTO v_service_key FROM public.system_settings WHERE key = 'SERVICE_ROLE_KEY' LIMIT 1;
    
    IF v_service_key IS NULL THEN
        INSERT INTO public.pipeline_failures (stage, worker_name, error_message, error_code, metadata)
        VALUES ('trigger', 'cron', 'SERVICE_ROLE_KEY missing from system_settings', 'AUTH_DRIFT', '{}'::jsonb);
        RETURN;
    END IF;

    PERFORM net.http_post(
        url := 'https://ssuknybhzcuusjardsve.supabase.co/functions/v1/job-embedding-worker',
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || v_service_key,
            'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
    );
END;
$function$;


-- Update Active Cron Jobs A to use native triggers instead of the SPOF.
SELECT cron.schedule('parser-worker-pulse-a', '* * * * *', 
    $$ SELECT public.trigger_parser_worker(); $$
);

SELECT cron.schedule('embedding-worker-pulse-a', '* * * * *', 
    $$ SELECT public.trigger_embedding_worker(); $$
);

-- Safely Drop the old SPOF function so it can never be invoked by accident again.
DROP FUNCTION IF EXISTS public.safe_trigger_edge_function(text, text);

