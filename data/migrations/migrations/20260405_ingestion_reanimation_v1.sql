-- REANIMATION PROTOCOL v1.0
-- TARGET: Ingestion Pipeline Trigger & Observability

-- 1. REPAIR CRON TRIGGER HEADERS
-- WHY: Hardcoded Bearer tokens in pg_cron schedules are brittle and break upon rotation.
-- This script updates common ingestion jobs to use a dynamic header construction if possible,
-- or at least synchronizes them with the current valid SERVICE_ROLE_KEY from system_settings.

DO $$
DECLARE
    curr_key TEXT;
BEGIN
    SELECT value INTO curr_key FROM public.system_settings WHERE key = 'SERVICE_ROLE_KEY';
    
    IF curr_key IS NOT NULL THEN
        -- Update TECH_SCRAPER (if it exists under a different name, we target by command pattern)
        UPDATE cron.job 
        SET command = regexp_replace(
            command, 
            'Authorization'', ''Bearer [^'']+', 
            'Authorization'', ''Bearer ' || curr_key
        )
        WHERE command LIKE '%tech-board-scraper%';

        -- Update ATS_ENGINE
        UPDATE cron.job 
        SET command = regexp_replace(
            command, 
            'Authorization'', ''Bearer [^'']+', 
            'Authorization'', ''Bearer ' || curr_key
        )
        WHERE command LIKE '%ats-engine-ultimate%';
        
        RAISE NOTICE 'Cron headers synchronized with SERVICE_ROLE_KEY';
    ELSE
        RAISE WARNING 'SERVICE_ROLE_KEY not found in system_settings. Cron reanimation skipped.';
    END IF;
END $$;

-- 2. AUTOMATE OBSERVABILITY REFRESH
-- WHY: Materialized views are stale, blinding the user to ingestion progress.

CREATE OR REPLACE FUNCTION public.refresh_ingestion_observability()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Refresh the primary discovery stats view
    IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_discovery_stats') THEN
        REFRESH MATERIALIZED VIEW public.mv_discovery_stats;
    END IF;
    
    -- Also refresh backlog monitor if it's materialized (check schema)
    IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_backlog_stats') THEN
        REFRESH MATERIALIZED VIEW public.mv_backlog_stats;
    END IF;

    RAISE NOTICE 'Ingestion observability refreshed at %', now();
END;
$$;

-- 3. SCHEDULE REFRESH
-- Every 30 minutes
SELECT cron.schedule(
    'OBSERVABILITY_REFRESH_JANITOR',
    '*/30 * * * *',
    'SELECT public.refresh_ingestion_observability();'
);

-- 4. INITIAL TRIGGER (FORCE REANIMATION)
SELECT public.refresh_ingestion_observability();
