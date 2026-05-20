-- SWEEP 8: LAZARUS PROTOCOL & TELEMETRY HARDENING
-- Objective: Ensure reposted jobs are re-activated and ingestion runs are traceable.

-- 1. Metadata Checkpointing for Ingestion Runs
ALTER TABLE public.ingestion_runs 
ADD COLUMN IF NOT EXISTS last_page INTEGER DEFAULT 1;

-- 2. Performance Indexes for Dedupe
CREATE INDEX IF NOT EXISTS idx_job_pointers_fingerprint_checked 
ON public.job_pointers(fingerprint, last_checked_at);

-- 3. Lazarus Protocol: Atomic Re-activation in ingest_job_atomic_v2
CREATE OR REPLACE FUNCTION public.ingest_job_atomic_v2(p_jobs jsonb[])
 RETURNS TABLE(o_job_pointer_id uuid, o_raw_document_id uuid, o_fingerprint text, o_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    j               jsonb;
    v_pointer_id    UUID;
    v_raw_id        UUID;
    v_norm_content  TEXT;
    v_checksum      TEXT;
    v_fingerprint   TEXT;
BEGIN
    FOR j IN SELECT * FROM unnest(p_jobs) LOOP
        BEGIN
            v_fingerprint := (j->>'fingerprint')::TEXT;

            -- ATOMIC UPSERT POINTER
            INSERT INTO public.job_pointers (
                fingerprint, company_name, title, location_name,
                source_url, source_type, discovery_method, confidence_tier,
                raw_payload, last_checked_at, signal_tier
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
                now(),
                (COALESCE(j->>'signal_tier', 'T3'))::public.signal_tier
            )
            ON CONFLICT (fingerprint) DO UPDATE SET
                last_checked_at = now(),
                signal_tier     = EXCLUDED.signal_tier,
                raw_payload     = COALESCE(EXCLUDED.raw_payload, job_pointers.raw_payload)
            RETURNING id INTO v_pointer_id;

            -- [LAZARUS PROTOCOL] Re-activate canonical job if it exists
            UPDATE public.canonical_jobs
            SET 
                is_active = true,
                last_seen_at = now(),
                updated_at = now()
            WHERE job_pointer_id = v_pointer_id;

            -- COLLISION-RESISTANT CHECKSUM (SHA-256)
            v_norm_content := lower(trim(
                COALESCE(j->>'title', '') || 
                COALESCE(j->>'company_name', '') || 
                COALESCE(j->>'full_text', j->'raw_payload'->>'description', '')
            ));
            v_checksum := encode(digest(v_norm_content, 'sha256'), 'hex');

            -- ATOMIC INSERT DOCUMENT
            INSERT INTO public.raw_job_documents (
                job_pointer_id, source, source_type, source_url,
                raw_payload, full_text, checksum, signal_tier, parse_status,
                is_parsed, low_confidence, ingested_at
            ) VALUES (
                v_pointer_id,
                (j->>'source_name')::TEXT,
                (j->>'source_type')::TEXT,
                (j->>'source_url')::TEXT,
                (j->'raw_payload')::JSONB,
                COALESCE(j->>'full_text', j->'raw_payload'->>'description', ''),
                v_checksum,
                (COALESCE(j->>'signal_tier', 'T3'))::public.signal_tier,
                'pending',
                false,
                (COALESCE(j->>'low_confidence', 'false'))::BOOLEAN,
                now()
            )
            ON CONFLICT (job_pointer_id, checksum) DO NOTHING
            RETURNING id INTO v_raw_id;

            o_job_pointer_id  := v_pointer_id;
            o_raw_document_id := v_raw_id;
            o_fingerprint     := v_fingerprint;
            -- Logic: If v_raw_id is NULL, it means the document (checksum) already existed.
            -- But the pointer was touched, so we return 'SKIPPED_DUPE'.
            o_status          := CASE WHEN v_raw_id IS NOT NULL THEN 'INGESTED' ELSE 'SKIPPED_DUPE' END;
            RETURN NEXT;

        EXCEPTION WHEN OTHERS THEN
            INSERT INTO public.ingestion_failures (fingerprint, error_message, payload)
            VALUES (COALESCE(v_fingerprint, 'UNKNOWN'), SQLERRM, j);
            
            o_job_pointer_id  := NULL;
            o_raw_document_id := NULL;
            o_fingerprint     := COALESCE(v_fingerprint, 'UNKNOWN');
            o_status          := 'ERROR';
            RETURN NEXT;
        END;
    END LOOP;
END;
$function$;
