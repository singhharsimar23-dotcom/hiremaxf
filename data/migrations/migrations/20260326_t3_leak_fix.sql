-- 1. Enforce is_parsed = true for T3 (Low Signal) sources
-- This prevents the parser-worker from ever picking up these jobs for LLM verification.
CREATE OR REPLACE FUNCTION public.enforce_t3_parsed()
RETURNS TRIGGER AS $$
BEGIN
    -- If signal_tier is T3, force it to be 'parsed' immediately
    IF NEW.signal_tier = 'T3' THEN
        NEW.is_parsed := true;
        NEW.parse_status := 'low_signal';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_t3_parsed ON public.raw_job_documents;
CREATE TRIGGER trg_enforce_t3_parsed
BEFORE INSERT OR UPDATE ON public.raw_job_documents
FOR EACH ROW EXECUTE FUNCTION public.enforce_t3_parsed();

-- 2. Update resolve_job_pointer_v3 to include signal_tier propagation
CREATE OR REPLACE FUNCTION public.resolve_job_pointer_v3(
    p_fingerprint TEXT,
    p_company_name TEXT,
    p_title TEXT,
    p_location_name TEXT,
    p_source_url TEXT,
    p_source_type TEXT,
    p_discovery_method TEXT,
    p_confidence_tier TEXT,
    p_raw_payload JSONB DEFAULT '{}',
    p_request_id UUID DEFAULT NULL,
    p_signal_tier TEXT DEFAULT 'T1' -- NEW
) RETURNS public.job_pointers AS $$
DECLARE
    r_pointer public.job_pointers;
BEGIN
    INSERT INTO public.job_pointers (
        fingerprint, company_name, title, location_name, 
        source_url, source_type, discovery_method, confidence_tier, 
        raw_payload, request_id, signal_tier, last_checked_at
    ) VALUES (
        p_fingerprint, p_company_name, p_title, p_location_name, 
        p_source_url, p_source_type, p_discovery_method, p_confidence_tier, 
        p_raw_payload, p_request_id, p_signal_tier, now()
    )
    ON CONFLICT (fingerprint) DO UPDATE SET
        last_checked_at = EXCLUDED.last_checked_at,
        request_id = EXCLUDED.request_id,
        signal_tier = COALESCE(EXCLUDED.signal_tier, job_pointers.signal_tier)
    RETURNING * INTO r_pointer;

    RETURN r_pointer;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update bulk_resolve_pointers_v4 to include signal_tier propagation
CREATE OR REPLACE FUNCTION public.bulk_resolve_pointers_v4(p_jobs jsonb[])
RETURNS TABLE (id UUID, fingerprint TEXT, signal_tier TEXT) AS $$
BEGIN
    RETURN QUERY
    INSERT INTO public.job_pointers (
        fingerprint, company_name, title, location_name, 
        source_url, source_type, discovery_method, confidence_tier, 
        raw_payload, request_id, signal_tier, last_checked_at
    )
    SELECT 
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
        COALESCE((j->>'signal_tier')::TEXT, 'T1'),
        now()
    FROM unnest(p_jobs) AS j
    ON CONFLICT (fingerprint) DO UPDATE SET
        last_checked_at = EXCLUDED.last_checked_at,
        request_id = EXCLUDED.request_id,
        signal_tier = COALESCE(EXCLUDED.signal_tier, job_pointers.signal_tier)
    RETURNING public.job_pointers.id, public.job_pointers.fingerprint, public.job_pointers.signal_tier;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
