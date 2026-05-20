-- ─────────────────────────────────────────────────────────────
-- MIGRATION: 20260408_sweep_7_restoration.sql
-- Why: Consolidates the embedding backbone on V2 and hardens the 
--      internal handshake to bypass JWT auth for system pulses.
-- ─────────────────────────────────────────────────────────────

BEGIN;

-- 1. HARDEN: job_embeddings schema
-- Add metadata column to track worker versions and embedding dimensions.
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'job_embeddings' AND column_name = 'metadata'
    ) THEN
        ALTER TABLE public.job_embeddings ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 2. REANIMATE: trigger_embedding_worker_v2
-- Why: The legacy trigger pointed to V1 and lacked the X-Secret-Internal handshake.
CREATE OR REPLACE FUNCTION public.trigger_embedding_worker()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_service_key TEXT;
    v_internal_secret TEXT := 'GeminiBackbone2026';
BEGIN
    -- Retrieve Service Key for internal auth
    SELECT value INTO v_service_key FROM public.system_settings WHERE key = 'SERVICE_ROLE_KEY' LIMIT 1;
    
    -- FALLBACK: If settings missing, log then fail (safe-by-default)
    IF v_service_key IS NULL THEN
        INSERT INTO public.pipeline_failures (stage, worker_name, error_message, error_code, metadata)
        VALUES ('trigger', 'cron', 'SERVICE_ROLE_KEY missing from system_settings', 'AUTH_DRIFT', '{}'::jsonb);
        RETURN;
    END IF;

    -- Invoke V2 Worker with Handshake
    PERFORM net.http_post(
        url := 'https://ssuknybhzcuusjardsve.supabase.co/functions/v1/job-embedding-worker-v2',
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || v_service_key,
            'X-Secret-Internal', v_internal_secret,
            'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
    );
END;
$function$;

-- 3. SYNC: tech-board-scraper Handshake
-- Ensure any internal calls also use the handshake if needed.
-- (The scraper is usually triggered by pg_cron which handles its own auth)

-- 4. LOG: Restoration Success
INSERT INTO public.pipeline_failures (stage, severity, worker_name, error_code, metadata)
VALUES ('MAINTENANCE', 'INFO', 'sweep_7_restoration', 'BACKBONE_V2_LINKED', '{"target": "job-embedding-worker-v2", "version": "2.0-fang"}');

COMMIT;
