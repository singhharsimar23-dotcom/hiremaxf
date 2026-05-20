-- Phase 6.0: Hardened Ingestion Engine (Advisory Locks + Normalized Checksums)
-- WHY: Prevents 7k+ orphans and ensures data moot integrity.

-- 1. Correct the Foreign Key (Zero-Orphan Foundation)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'raw_job_documents_job_pointer_id_fkey'
    ) THEN
        ALTER TABLE public.raw_job_documents DROP CONSTRAINT raw_job_documents_job_pointer_id_fkey;
    END IF;
END $$;

ALTER TABLE public.raw_job_documents 
    ADD CONSTRAINT raw_job_documents_job_pointer_id_fkey 
    FOREIGN KEY (job_pointer_id) 
    REFERENCES public.job_pointers(id) 
    ON DELETE CASCADE;

-- Ensure it's not nullable (Future Prevention)
-- WARNING: This may fail if orphans currently exist. 
-- Cleanup must happen first in a real migration, but here we'll force it after delete.
-- ALTER TABLE public.raw_job_documents ALTER COLUMN job_pointer_id SET NOT NULL;

-- 2. Create Normalization Helper
CREATE OR REPLACE FUNCTION public.normalize_job_content(p_text TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Strip HTML, lowercase, collapse all whitespace to single spaces, trim.
    RETURN trim(lower(regexp_replace(
        regexp_replace(p_text, '<[^>]*>', '', 'g'), -- Strip HTML
        '\s+', ' ', 'g' -- Collapse whitespace
    )));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. The Atomic v2 RPC
CREATE OR REPLACE FUNCTION public.ingest_job_atomic_v2(p_jobs jsonb[])
RETURNS TABLE (job_pointer_id UUID, raw_document_id UUID, fingerprint TEXT, status TEXT) AS $$
DECLARE
    j jsonb;
    v_pointer_id UUID;
    v_raw_id UUID;
    v_norm_content TEXT;
    v_checksum TEXT;
    v_fingerprint TEXT;
    v_exists_raw BOOLEAN;
BEGIN
    FOR j IN SELECT * FROM unnest(p_jobs) LOOP
        v_fingerprint := (j->>'fingerprint')::TEXT;
        
        -- A. ADVISORY LOCK (Transaction-level)
        -- WHY: Ensures serializeable access per job fingerprint.
        PERFORM pg_advisory_xact_lock(hashtext(v_fingerprint));

        -- B. RESOLVE POINTER
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
            request_id = EXCLUDED.request_id,
            signal_tier = EXCLUDED.signal_tier,
            -- Update raw_payload metadata if provided
            raw_payload = COALESCE(EXCLUDED.raw_payload, job_pointers.raw_payload)
        RETURNING id INTO v_pointer_id;

        -- C. GENERATE NORMALIZED CHECKSUM
        -- WHY: Avoid drift duplication (spacing/case)
        v_norm_content := public.normalize_job_content(
            COALESCE(j->>'title', '') || 
            COALESCE(j->>'company_name', '') || 
            COALESCE(j->'raw_payload'->>'description', '') || 
            COALESCE(j->'raw_payload'->>'snippet', '') -- Account for Scout snippets
        );
        v_checksum := md5(v_norm_content);

        -- D. CHECK FOR EXISTING RAW
        SELECT EXISTS (
            SELECT 1 FROM public.raw_job_documents 
            WHERE job_pointer_id = v_pointer_id AND checksum = v_checksum
        ) INTO v_exists_raw;

        -- E. CONDITIONAL RAW INGESTION
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

        -- F. THE ZERO-ORPHAN CONTRACT
        -- If it's a first-time capture (no existing raw) but insert failed? Rollback.
        IF NOT v_exists_raw AND v_raw_id IS NULL THEN
            RAISE EXCEPTION 'RAW_FOR_CONTRACT_VIOLATION: Cannot create pointer % without raw evidence.', v_fingerprint;
        END IF;

        -- G. RETURN DATA
        job_pointer_id := v_pointer_id;
        raw_document_id := v_raw_id;
        fingerprint := v_fingerprint;
        status := CASE WHEN v_raw_id IS NOT NULL THEN 'INGESTED' ELSE 'SKIPPED_DUPE' END;
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
