-- Consolidated 20260325_final_schema.sql
-- Purpose: Unified schema for Launch-Ready Ingestion

-- 1. Ensure extensions
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- 2. JOB POINTERS (The Central Registry)
CREATE TABLE IF NOT EXISTS public.job_pointers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fingerprint TEXT UNIQUE NOT NULL,
    company_name TEXT NOT NULL,
    company_id UUID REFERENCES public.companies(id),
    title TEXT NOT NULL,
    role_category TEXT,
    seniority_band TEXT,
    location_name TEXT,
    location_type TEXT DEFAULT 'onsite',
    source_url TEXT NOT NULL,
    source_type TEXT NOT NULL,
    ats_provider TEXT,
    external_id TEXT,
    is_direct_ats BOOLEAN DEFAULT false,
    confidence_tier TEXT DEFAULT 'medium',
    quality_score FLOAT DEFAULT 0.0,
    discovery_method TEXT,
    signal_tier TEXT DEFAULT 'T1',
    content_quality_score FLOAT DEFAULT 0.0,
    last_verified_at TIMESTAMPTZ DEFAULT now(),
    last_checked_at TIMESTAMPTZ DEFAULT now(),
    salary_raw TEXT,
    state_code TEXT,
    request_id UUID,
    ingestion_origin TEXT,
    canonical_job_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. RAW JOB DOCUMENTS (The Archive)
CREATE TABLE IF NOT EXISTS public.raw_job_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_pointer_id UUID REFERENCES public.job_pointers(id),
    source TEXT NOT NULL,
    source_type TEXT,
    source_url TEXT NOT NULL,
    checksum TEXT UNIQUE NOT NULL,
    raw_payload JSONB DEFAULT '{}',
    raw_html TEXT,
    full_text TEXT,
    is_parsed BOOLEAN DEFAULT false,
    parse_status TEXT DEFAULT 'pending',
    parse_attempts INTEGER DEFAULT 0,
    last_parsed_at TIMESTAMPTZ,
    error_reason TEXT,
    failure_class TEXT,
    content_quality_score FLOAT DEFAULT 0.0,
    signal_tier TEXT DEFAULT 'T1',
    orchestrator_run_id UUID,
    ingested_at TIMESTAMPTZ DEFAULT now(),
    crawl_metadata JSONB DEFAULT '{}',
    low_confidence BOOLEAN DEFAULT false
);

-- 4. ATOMIC RESOLUTION FUNCTION (v3)
-- Handles ON CONFLICT (fingerprint) DO UPDATE safely
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
    p_request_id UUID DEFAULT NULL
) RETURNS public.job_pointers AS $$
DECLARE
    r_pointer public.job_pointers;
BEGIN
    INSERT INTO public.job_pointers (
        fingerprint, company_name, title, location_name, 
        source_url, source_type, discovery_method, confidence_tier, 
        raw_payload, request_id, last_checked_at
    ) VALUES (
        p_fingerprint, p_company_name, p_title, p_location_name, 
        p_source_url, p_source_type, p_discovery_method, p_confidence_tier, 
        p_raw_payload, p_request_id, now()
    )
    ON CONFLICT (fingerprint) DO UPDATE SET
        last_checked_at = EXCLUDED.last_checked_at,
        request_id = EXCLUDED.request_id
    RETURNING * INTO r_pointer;

    RETURN r_pointer;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
