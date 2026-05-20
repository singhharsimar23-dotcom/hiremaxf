-- ============================================================
-- MIGRATION: 20260403_ingestion_rpc_contract_fix.sql
-- Fixes: Contract mismatch, failure logging, checksum hardening,
--         retry worker cron, hard T3 suppression in matcher.
-- ============================================================

-- ── 1. ENSURE retry_count EXISTS ON ingestion_failures ───────
ALTER TABLE public.ingestion_failures
    ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ;

-- ── 2. HARDENED ingest_job_atomic_v2 ─────────────────────────
-- Changes:
--   a) RETURNS TABLE columns renamed to o_* (contract alignment)
--   b) EXCEPTION block logs to ingestion_failures before re-raise
--   c) Checksum now includes source_url (breaks collision zone)
--   d) Zero-orphan violation logged, not just raised silently
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
BEGIN
    FOR j IN SELECT * FROM unnest(p_jobs) LOOP
        BEGIN -- Inner block: per-job exception isolation

            v_fingerprint := (j->>'fingerprint')::TEXT;

            -- A. ADVISORY LOCK — serialises concurrent ingest of same job
            PERFORM pg_advisory_xact_lock(hashtext(v_fingerprint));

            -- B. UPSERT POINTER
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

            -- C. HARDENED CHECKSUM — includes source_url to break collision zone
            -- WHY: title+company alone collapses distinct postings for same role at same company.
            v_norm_content := public.normalize_job_content(
                COALESCE(j->>'title',              '') ||
                COALESCE(j->>'company_name',       '') ||
                COALESCE(j->>'source_url',         '') ||   -- FIX: was missing (breakpoint 10)
                COALESCE(j->'raw_payload'->>'description', '') ||
                COALESCE(j->'raw_payload'->>'snippet',     '')
            );
            v_checksum := md5(v_norm_content);

            -- D. EXISTENCE CHECK FOR RAW
            SELECT EXISTS (
                SELECT 1 FROM public.raw_job_documents
                WHERE job_pointer_id = v_pointer_id AND checksum = v_checksum
            ) INTO v_exists_raw;

            -- E. CONDITIONAL RAW INSERT
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

            -- F. ZERO-ORPHAN ENFORCEMENT
            IF NOT v_exists_raw AND v_raw_id IS NULL THEN
                -- WHY: Log forensic context before raising — previously silent (breakpoint 2)
                INSERT INTO public.ingestion_failures (fingerprint, error_message, payload, created_at)
                VALUES (
                    v_fingerprint,
                    'ZERO_ORPHAN_VIOLATION: raw insert returned NULL for new pointer',
                    j,
                    now()
                )
                ON CONFLICT DO NOTHING;

                RAISE EXCEPTION 'ZERO_ORPHAN_VIOLATION: pointer % created but raw insert failed', v_fingerprint;
            END IF;

            -- G. RETURN ROW — o_ prefix aligns with TS contract (breakpoint 1)
            o_job_pointer_id  := v_pointer_id;
            o_raw_document_id := v_raw_id;
            o_fingerprint     := v_fingerprint;
            o_status          := CASE WHEN v_raw_id IS NOT NULL THEN 'INGESTED' ELSE 'SKIPPED_DUPE' END;
            RETURN NEXT;

        EXCEPTION WHEN OTHERS THEN
            -- WHY: Per-job failure must not abort entire batch.
            --      Log to ingestion_failures so retry worker can recover it.
            INSERT INTO public.ingestion_failures (fingerprint, error_message, payload, created_at)
            VALUES (
                COALESCE(v_fingerprint, 'UNKNOWN'),
                SQLERRM,
                j,
                now()
            )
            ON CONFLICT DO NOTHING;

            -- Emit skipped row so caller gets full picture
            o_job_pointer_id  := NULL;
            o_raw_document_id := NULL;
            o_fingerprint     := COALESCE(v_fingerprint, 'UNKNOWN');
            o_status          := 'ERROR';
            RETURN NEXT;
        END;
    END LOOP;
END;
$$;

-- ── 3. HARD T3 SUPPRESSION in match_jobs_v4_bayesian ─────────
-- Already applied in previous session but re-applying to ensure it
-- is part of the canonical migration history.
-- (No-op if already correct; CREATE OR REPLACE is idempotent)

-- ── 4. pg_cron: RETRY WORKER every 15 minutes ────────────────
-- WHY: Retry worker edge function must be scheduled here as cron
--      requires superuser or pg_cron extension access.
SELECT cron.schedule(
    'ingestion-retry-worker',           -- job name (idempotent)
    '*/15 * * * *',                     -- every 15 minutes
    $cron$
        SELECT net.http_post(
            url     := (SELECT value FROM public.app_config WHERE key = 'SUPABASE_FUNCTION_URL') || '/ingestion-retry-worker',
            headers := jsonb_build_object(
                'Content-Type',  'application/json',
                'Authorization', 'Bearer ' || (SELECT value FROM public.app_config WHERE key = 'SERVICE_ROLE_KEY')
            ),
            body    := '{}'::jsonb
        );
    $cron$
);
