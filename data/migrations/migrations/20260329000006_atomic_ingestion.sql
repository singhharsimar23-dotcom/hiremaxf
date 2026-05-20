-- Phase 2.1: Ingestion Engine Restoration (Atomic Restoration)
-- Purpose: Enforce the Raw-First contract. Atomically ingest Raw Docs + Pointers.

-- 1. Create the Atomic Ingestion RPC
CREATE OR REPLACE FUNCTION public.ingest_atomic_raw_v1(p_jobs jsonb[])
RETURNS TABLE (job_pointer_id UUID, raw_document_id UUID, fingerprint TEXT) AS $$
DECLARE
    j jsonb;
    v_pointer_id UUID;
    v_raw_id UUID;
    v_checksum TEXT;
BEGIN
    FOR j IN SELECT * FROM unnest(p_jobs) LOOP
        -- A. Upsert/Resolve the Job Pointer
        INSERT INTO public.job_pointers (
            fingerprint, company_name, title, location_name, 
            source_url, source_type, discovery_method, confidence_tier, 
            raw_payload, request_id, last_checked_at, signal_tier
        ) VALUES (
            (j->>'fingerprint')::TEXT,
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
            (j->>'signal_tier')::public.signal_tier -- Explicit cast
        )
        ON CONFLICT (fingerprint) DO UPDATE SET
            last_checked_at = EXCLUDED.last_checked_at,
            request_id = EXCLUDED.request_id,
            signal_tier = EXCLUDED.signal_tier
        RETURNING id INTO v_pointer_id;

        -- B. Generate Content Checksum (MD5 of payload + title)
        -- WHY: Detect if the description changed at the same URL
        v_checksum := md5(COALESCE(j->>'title', '') || COALESCE(j->>'company_name', '') || COALESCE(j->'raw_payload'->>'description', '') || COALESCE(j->>'source_url', ''));

        -- C. Conditional Insert into raw_job_documents
        -- WHY: Only insert if we haven't seen this CONTENT before for this pointer
        INSERT INTO public.raw_job_documents (
            job_pointer_id, source, source_type, source_url, 
            raw_payload, checksum, signal_tier, parse_status, 
            is_parsed, low_confidence, orchestrator_run_id, ingested_at
        )
        SELECT 
            v_pointer_id,
            (j->>'source_name')::TEXT,
            (j->>'source_type')::TEXT,
            (j->>'source_url')::TEXT,
            (j->'raw_payload')::JSONB,
            v_checksum,
            (j->>'signal_tier')::public.signal_tier,
            COALESCE(j->>'parse_status', 'pending'), -- Allow override for T3
            (COALESCE(j->>'is_parsed', 'false'))::BOOLEAN, -- Allow override for T3
            (COALESCE(j->>'low_confidence', 'false'))::BOOLEAN,
            (j->>'request_id')::UUID,
            now()
        WHERE NOT EXISTS (
            SELECT 1 FROM public.raw_job_documents 
            WHERE job_pointer_id = v_pointer_id AND checksum = v_checksum
        )
        RETURNING id INTO v_raw_id;

        job_pointer_id := v_pointer_id;
        raw_document_id := v_raw_id;
        fingerprint := (j->>'fingerprint')::TEXT;
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the Ingestion Integrity View
-- WHY: Identify "Orphaned Pointers" (Pointers without raw documents)
CREATE OR REPLACE VIEW public.view_ingestion_integrity AS
SELECT 
    jp.id as pointer_id,
    jp.fingerprint,
    jp.source_type,
    jp.created_at as seen_at,
    count(rjd.id) as raw_doc_count
FROM public.job_pointers jp
LEFT JOIN public.raw_job_documents rjd ON rjd.job_pointer_id = jp.id
GROUP BY 1, 2, 3, 4
ORDER BY raw_doc_count ASC;

COMMENT ON VIEW public.view_ingestion_integrity IS 'Audit view to detect pointers lacking original raw source data (Data Moat Health).';
