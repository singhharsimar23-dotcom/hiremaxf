-- ═══════════════════════════════════════════════════════════════════════════════
-- supabase/migrations/20260421_telemetry_bigint_migration.sql
-- Hardens telemetry tables against integer overflow and precision loss.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ 
BEGIN
    -- 1. Hardening public.source_reliability
    ALTER TABLE public.source_reliability 
        ALTER COLUMN total_jobs_found TYPE BIGINT,
        ALTER COLUMN failure_count TYPE BIGINT,
        ALTER COLUMN consecutive_failures TYPE BIGINT,
        ALTER COLUMN jobs_found_7d TYPE BIGINT,
        ALTER COLUMN jobs_new_7d TYPE BIGINT,
        ALTER COLUMN last_insert_count TYPE BIGINT;
    
    RAISE NOTICE 'Hardened public.source_reliability telemetry columns to BIGINT';

    -- 2. Hardening public.source_health
    ALTER TABLE public.source_health 
        ALTER COLUMN raw_fetched TYPE BIGINT,
        ALTER COLUMN parse_success TYPE BIGINT,
        ALTER COLUMN dedup_rejected TYPE BIGINT,
        ALTER COLUMN tech_rejected TYPE BIGINT,
        ALTER COLUMN quality_rejected TYPE BIGINT,
        ALTER COLUMN usable_stored TYPE BIGINT,
        ALTER COLUMN run_duration_ms TYPE BIGINT;

    RAISE NOTICE 'Hardened public.source_health telemetry columns to BIGINT';

    -- 3. Hardening public.worker_heartbeat
    ALTER TABLE public.worker_heartbeat 
        ALTER COLUMN jobs_processed TYPE BIGINT;

    RAISE NOTICE 'Hardened public.worker_heartbeat telemetry columns to BIGINT';
END $$;
