-- ══════════════════════════════════════════════════════════════
-- MIGRATION: 20260404_stability_hardening.sql
-- Phases 3-8: Source reliability, circuit breaker, soft dedup,
--             health snapshot, data decay cleanup, retry intelligence.
-- ══════════════════════════════════════════════════════════════

-- ── EXTENSIONS ────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- Phase 5: similarity matching

-- ── SCHEMA EXTENSIONS: ingestion_failures ────────────────────
-- Phase 4: Retry intelligence — backoff schedule + failure type
ALTER TABLE public.ingestion_failures
    ADD COLUMN IF NOT EXISTS failure_type  TEXT NOT NULL DEFAULT 'SYSTEM_ERROR'
        CHECK (failure_type IN ('DUPLICATE', 'VALIDATION', 'SYSTEM_ERROR')),
    ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ DEFAULT now();

-- Only SYSTEM_ERROR records are retryable. Set DUPLICATE/VALIDATION to exhausted.
UPDATE public.ingestion_failures
SET failure_type = 'SYSTEM_ERROR'
WHERE failure_type IS NULL;

-- ── SCHEMA EXTENSIONS: ingestion_metrics ─────────────────────
-- Phase 9: Full logging consistency
ALTER TABLE public.ingestion_metrics
    ADD COLUMN IF NOT EXISTS duration_ms INTEGER,
    ADD COLUMN IF NOT EXISTS skipped_low_quality INTEGER DEFAULT 0;

-- ── SCHEMA EXTENSIONS: source_reliability ────────────────────
-- Phase 3: Source scoring
ALTER TABLE public.source_reliability
    ADD COLUMN IF NOT EXISTS success_rate         FLOAT DEFAULT 1.0,
    ADD COLUMN IF NOT EXISTS avg_jobs_returned    FLOAT DEFAULT 0.0,
    ADD COLUMN IF NOT EXISTS avg_quality_score    FLOAT DEFAULT 1.0,
    ADD COLUMN IF NOT EXISTS failure_count        INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_quarantine_at   TIMESTAMPTZ;

-- ── NEW TABLE: circuit_breaker_state ─────────────────────────
-- Phase 8: Global kill switch — written by ATS engine, read by all scouts
CREATE TABLE IF NOT EXISTS public.circuit_breaker_state (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    triggered_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at          TIMESTAMPTZ NOT NULL,
    reason              TEXT,
    consecutive_failures INT,
    triggered_by        TEXT        -- which source triggered it
);
-- Only keep last 100 circuit breaker events
CREATE INDEX IF NOT EXISTS idx_circuit_breaker_expires_at
    ON public.circuit_breaker_state(expires_at DESC);

-- ── NEW TABLE: system_settings (safe if exists) ───────────────
-- Stores ramp level and other global settings
CREATE TABLE IF NOT EXISTS public.system_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO public.system_settings (key, value)
VALUES ('ingestion_ramp_level', '0')
ON CONFLICT (key) DO NOTHING;

-- ── INDEXES FOR SOFT DEDUP (Phase 5) ─────────────────────────
-- WHY: pg_trgm similarity queries over unindexed columns at >100k rows
--      cause full table scans. GIN indexing is mandatory for production use.
CREATE INDEX IF NOT EXISTS idx_job_pointers_title_trgm
    ON public.job_pointers USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_job_pointers_company_trgm
    ON public.job_pointers USING gin (company_name gin_trgm_ops);

-- ── FUNCTION: soft_dedup_check (Phase 5) ─────────────────────
-- WHY: Called from ingest_job_atomic_v2 BEFORE the pointer INSERT.
--      Returns existing pointer_id if a semantically identical job exists,
--      preventing cross-source duplicates from inflating canonical count.
CREATE OR REPLACE FUNCTION public.soft_dedup_check(
    p_company  TEXT,
    p_title    TEXT,
    p_location TEXT
) RETURNS UUID
LANGUAGE sql STABLE
AS $$
    SELECT id
    FROM public.job_pointers
    WHERE company_name ILIKE p_company
      AND similarity(title, p_title) > 0.8
      AND (location_name ILIKE p_location OR p_location IS NULL)
      AND last_checked_at > now() - interval '30 days'
    ORDER BY similarity(title, p_title) DESC
    LIMIT 1;
$$;

-- ── HARDEN ingest_job_atomic_v2 WITH SOFT DEDUP (Phase 5) ────
CREATE OR REPLACE FUNCTION public.ingest_job_atomic_v2(p_jobs jsonb[])
RETURNS TABLE (
    o_job_pointer_id  UUID,
    o_raw_document_id UUID,
    o_fingerprint     TEXT,
    o_status          TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    j               jsonb;
    v_pointer_id    UUID;
    v_raw_id        UUID;
    v_norm_content  TEXT;
    v_checksum      TEXT;
    v_fingerprint   TEXT;
    v_exists_raw    BOOLEAN;
    v_soft_dup_id   UUID;
BEGIN
    FOR j IN SELECT * FROM unnest(p_jobs) LOOP
        BEGIN
            v_fingerprint := (j->>'fingerprint')::TEXT;
            PERFORM pg_advisory_xact_lock(hashtext(v_fingerprint));

            -- PHASE 5: Soft duplicate check BEFORE pointer insert
            -- WHY: If a semantically identical job already exists from another source,
            --      map to it instead of inserting a new pointer (cross-source dedup).
            v_soft_dup_id := public.soft_dedup_check(
                j->>'company_name',
                j->>'title',
                j->>'location_name'
            );

            IF v_soft_dup_id IS NOT NULL THEN
                -- Map to existing pointer, update last_checked_at to keep it fresh
                UPDATE public.job_pointers
                SET last_checked_at = now(),
                    signal_tier = GREATEST(
                        signal_tier,
                        (j->>'signal_tier')::public.signal_tier
                    )
                WHERE id = v_soft_dup_id;

                o_job_pointer_id  := v_soft_dup_id;
                o_raw_document_id := NULL;
                o_fingerprint     := v_fingerprint;
                o_status          := 'SOFT_DEDUP';
                RETURN NEXT;
                CONTINUE;
            END IF;

            -- Normal path: upsert pointer
            INSERT INTO public.job_pointers (
                fingerprint, company_name, title, location_name,
                source_url, source_type, discovery_method, confidence_tier,
                raw_payload, request_id, last_checked_at, signal_tier
            ) VALUES (
                v_fingerprint,
                (j->>'company_name')::TEXT,
                (j->>'title')::TEXT,
                (j->>'location_name')::TEXT,
                (j->>'source_url')::TEXT,
                (j->>'source_type')::TEXT,
                (j->>'discovery_method')::TEXT,
                (j->>'confidence_tier')::TEXT,
                (j->'raw_payload')::JSONB,
                (j->>'request_id')::UUID,
                now(),
                (j->>'signal_tier')::public.signal_tier
            )
            ON CONFLICT (fingerprint) DO UPDATE SET
                last_checked_at = EXCLUDED.last_checked_at,
                request_id      = EXCLUDED.request_id,
                signal_tier     = EXCLUDED.signal_tier,
                raw_payload     = COALESCE(EXCLUDED.raw_payload, job_pointers.raw_payload)
            RETURNING id INTO v_pointer_id;

            -- Hardened checksum (includes URL — fixes breakpoint 10)
            v_norm_content := public.normalize_job_content(
                COALESCE(j->>'title',              '') ||
                COALESCE(j->>'company_name',       '') ||
                COALESCE(j->>'source_url',         '') ||
                COALESCE(j->'raw_payload'->>'description', '') ||
                COALESCE(j->'raw_payload'->>'snippet',     '')
            );
            v_checksum := md5(v_norm_content);

            SELECT EXISTS (
                SELECT 1 FROM public.raw_job_documents
                WHERE job_pointer_id = v_pointer_id AND checksum = v_checksum
            ) INTO v_exists_raw;

            v_raw_id := NULL;
            IF NOT v_exists_raw THEN
                INSERT INTO public.raw_job_documents (
                    job_pointer_id, source, source_type, source_url,
                    raw_payload, checksum, signal_tier, parse_status,
                    is_parsed, low_confidence, orchestrator_run_id, ingested_at
                ) VALUES (
                    v_pointer_id,
                    (j->>'source_name')::TEXT,
                    (j->>'source_type')::TEXT,
                    (j->>'source_url')::TEXT,
                    (j->'raw_payload')::JSONB,
                    v_checksum,
                    (j->>'signal_tier')::public.signal_tier,
                    COALESCE(j->>'parse_status', 'pending'),
                    (COALESCE(j->>'is_parsed', 'false'))::BOOLEAN,
                    (COALESCE(j->>'low_confidence', 'false'))::BOOLEAN,
                    (j->>'request_id')::UUID,
                    now()
                )
                RETURNING id INTO v_raw_id;
            END IF;

            IF NOT v_exists_raw AND v_raw_id IS NULL THEN
                INSERT INTO public.ingestion_failures
                    (fingerprint, error_message, payload, created_at, failure_type)
                VALUES
                    (v_fingerprint, 'ZERO_ORPHAN_VIOLATION: raw insert NULL for new pointer', j, now(), 'SYSTEM_ERROR')
                ON CONFLICT DO NOTHING;
                RAISE EXCEPTION 'ZERO_ORPHAN_VIOLATION: pointer % created but raw insert failed', v_fingerprint;
            END IF;

            o_job_pointer_id  := v_pointer_id;
            o_raw_document_id := v_raw_id;
            o_fingerprint     := v_fingerprint;
            o_status          := CASE WHEN v_raw_id IS NOT NULL THEN 'INGESTED' ELSE 'SKIPPED_DUPE' END;
            RETURN NEXT;

        EXCEPTION WHEN OTHERS THEN
            -- Classify failure type for retry intelligence
            DECLARE
                v_err_lower TEXT := lower(SQLERRM);
                v_ftype TEXT := 'SYSTEM_ERROR';
            BEGIN
                IF v_err_lower LIKE '%duplicate%' OR v_err_lower LIKE '%unique%'
                   OR v_err_lower LIKE '%23505%' THEN
                    v_ftype := 'DUPLICATE';
                ELSIF v_err_lower LIKE '%null value%' OR v_err_lower LIKE '%invalid%'
                      OR v_err_lower LIKE '%23502%' OR v_err_lower LIKE '%validation%' THEN
                    v_ftype := 'VALIDATION';
                END IF;

                INSERT INTO public.ingestion_failures
                    (fingerprint, error_message, payload, created_at, failure_type, next_retry_at)
                VALUES (
                    COALESCE(v_fingerprint, 'UNKNOWN'),
                    SQLERRM,
                    j,
                    now(),
                    v_ftype,
                    -- Only SYSTEM_ERROR gets a retry window; others are set far future
                    CASE WHEN v_ftype = 'SYSTEM_ERROR' THEN now() + interval '5 minutes'
                         ELSE now() + interval '999 days' END
                )
                ON CONFLICT DO NOTHING;
            END;

            o_job_pointer_id  := NULL;
            o_raw_document_id := NULL;
            o_fingerprint     := COALESCE(v_fingerprint, 'UNKNOWN');
            o_status          := 'ERROR';
            RETURN NEXT;
        END;
    END LOOP;
END;
$$;

-- ── FUNCTION: update_source_reliability (Phase 3) ────────────
CREATE OR REPLACE FUNCTION public.update_source_reliability(
    p_source        TEXT,
    p_attempted     INT,
    p_ingested      INT,
    p_failed        INT,
    p_quality_score FLOAT DEFAULT 1.0
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_new_success_rate  FLOAT;
    v_consec_failures   INT;
BEGIN
    v_new_success_rate := CASE WHEN p_attempted > 0
        THEN (p_ingested::FLOAT / p_attempted)
        ELSE 1.0 END;

    INSERT INTO public.source_reliability (
        source_name,
        success_rate,
        avg_jobs_returned,
        avg_quality_score,
        failure_count,
        consecutive_failures,
        total_jobs_found,
        last_updated
    ) VALUES (
        p_source,
        v_new_success_rate,
        p_attempted::FLOAT,
        p_quality_score,
        CASE WHEN p_failed > 0 THEN 1 ELSE 0 END,
        CASE WHEN p_failed > 0 THEN 1 ELSE 0 END,
        p_ingested,
        now()
    )
    ON CONFLICT (source_name) DO UPDATE SET
        -- Exponential moving average (alpha = 0.3)
        success_rate         = 0.7 * source_reliability.success_rate + 0.3 * v_new_success_rate,
        avg_jobs_returned    = 0.7 * COALESCE(source_reliability.avg_jobs_returned, 0) + 0.3 * p_attempted,
        avg_quality_score    = 0.7 * COALESCE(source_reliability.avg_quality_score, 1.0) + 0.3 * p_quality_score,
        failure_count        = source_reliability.failure_count + CASE WHEN p_failed > 0 THEN 1 ELSE 0 END,
        consecutive_failures = CASE WHEN p_failed > 0
                                   THEN COALESCE(source_reliability.consecutive_failures, 0) + 1
                                   ELSE 0 END,
        total_jobs_found     = source_reliability.total_jobs_found + p_ingested,
        last_updated         = now();

    -- Auto-quarantine: if 5 consecutive failures, quarantine 1 hour
    SELECT consecutive_failures INTO v_consec_failures
    FROM public.source_reliability
    WHERE source_name = p_source;

    IF v_consec_failures >= 5 THEN
        UPDATE public.source_reliability
        SET status             = 'QUARANTINE',
            retry_after        = now() + interval '1 hour',
            last_quarantine_at = now(),
            consecutive_failures = 0
        WHERE source_name = p_source;

        INSERT INTO public.integrity_events (event_type, source, message, metadata)
        VALUES (
            'SOURCE_AUTO_QUARANTINED',
            p_source,
            format('Source %s auto-quarantined: 5 consecutive failures', p_source),
            jsonb_build_object('retry_after', now() + interval '1 hour')
        );
    END IF;
END;
$$;

-- ── MATERIALIZED VIEW: system_health_snapshot (Phase 7) ──────
-- WHY: Single-row truth dashboard. Queried by monitoring, not per-request.
--      CONCURRENTLY refresh requires a unique index.
CREATE MATERIALIZED VIEW IF NOT EXISTS public.system_health_snapshot AS
SELECT
    1                                                           AS snapshot_id,
    -- Jobs per minute ingested in last hour
    ROUND(
        COALESCE(SUM(ingested)::numeric /
            NULLIF(EXTRACT(EPOCH FROM (now() - (now() - interval '1 hour')))/60, 0),
        0), 2
    )                                                           AS ingestion_rate,
    -- Failure rate in last hour
    ROUND(CASE WHEN SUM(attempted) > 0
        THEN (SUM(failed)::numeric / SUM(attempted) * 100)
        ELSE 0 END, 2)                                         AS failure_rate,
    -- Retry queue: retryable failures
    (SELECT COUNT(*) FROM public.ingestion_failures
     WHERE retry_count < 5
       AND failure_type = 'SYSTEM_ERROR'
       AND next_retry_at <= now())                             AS retry_queue_size,
    -- Active sources in last hour
    COUNT(DISTINCT source)                                     AS active_sources,
    -- Total ingested in last hour
    COALESCE(SUM(ingested), 0)                                AS total_ingested_1h,
    -- Total attempted in last hour
    COALESCE(SUM(attempted), 0)                               AS total_attempted_1h,
    now()                                                      AS refreshed_at
FROM public.ingestion_metrics
WHERE ts > now() - interval '1 hour';

CREATE UNIQUE INDEX IF NOT EXISTS idx_system_health_snapshot_id
    ON public.system_health_snapshot(snapshot_id);

-- ── pg_cron: MATERIALIZED VIEW REFRESH (Phase 7) ─────────────
SELECT cron.schedule(
    'refresh-system-health-snapshot',
    '*/5 * * * *',
    $$ REFRESH MATERIALIZED VIEW CONCURRENTLY public.system_health_snapshot; $$
);

-- ── pg_cron: DATA DECAY CLEANUP (Phase 6) ─────────────────────
-- Delete stale job_pointers (not updated in 30 days)
SELECT cron.schedule(
    'cleanup-stale-job-pointers',
    '0 0 * * *',
    $$
    DELETE FROM public.job_pointers
    WHERE last_checked_at < now() - interval '30 days';
    $$
);

-- Delete parsed raw documents older than 14 days
SELECT cron.schedule(
    'cleanup-parsed-raw-documents',
    '0 1 * * *',
    $$
    DELETE FROM public.raw_job_documents
    WHERE ingested_at < now() - interval '14 days'
      AND is_parsed = true;
    $$
);

-- Archive (delete) exhausted failures older than 7 days
SELECT cron.schedule(
    'archive-exhausted-ingestion-failures',
    '0 2 * * *',
    $$
    DELETE FROM public.ingestion_failures
    WHERE created_at < now() - interval '7 days'
      AND (retry_count >= 5 OR failure_type IN ('DUPLICATE', 'VALIDATION'));
    $$
);

-- Prune old circuit breaker state (keep last 30 days)
SELECT cron.schedule(
    'cleanup-circuit-breaker-state',
    '0 3 * * *',
    $$
    DELETE FROM public.circuit_breaker_state
    WHERE triggered_at < now() - interval '30 days';
    $$
);
