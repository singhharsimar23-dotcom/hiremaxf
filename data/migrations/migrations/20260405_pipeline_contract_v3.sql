-- 🔎 HIREMAX SYSTEM REPAIR MODE — MISSION CRITICAL
-- Unifies the ingestion and ranking RPCs, points the ranking engine to the correct embedding table, 
-- and fixes the Mission Control view to account for the actual embedding table used.

BEGIN;

-- 1. CONSOLIDATE INGESTION RPC (DROP ALL OVERLOADS FIRST)
DROP FUNCTION IF EXISTS public.ingest_job_atomic_v2(jsonb);
DROP FUNCTION IF EXISTS public.ingest_job_atomic_v2(text, text, text, text, text, jsonb, text, text);
DROP FUNCTION IF EXISTS public.ingest_job_atomic_v2(jsonb[]);

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

-- 2. CONSOLIDATE RANKING ENGINE (DROP ALL OVERLOADS FIRST)
DROP FUNCTION IF EXISTS public.match_jobs_v4(uuid, integer, double precision, double precision, double precision);
DROP FUNCTION IF EXISTS public.match_jobs_v4(text, text[], integer, text, boolean, vector, uuid);
DROP FUNCTION IF EXISTS public.match_jobs_v4(uuid, text, text[], integer, text, boolean, vector);

CREATE OR REPLACE FUNCTION public.match_jobs_v4(
    p_user_id uuid,
    p_candidate_role text,
    p_candidate_skills text[],
    p_candidate_experience_years integer,
    p_candidate_location text,
    p_remote_preference boolean,
    p_candidate_embedding vector(768)
)
 RETURNS TABLE(
    job_id uuid, company_name text, title text, work_mode text, location_raw text, 
    source_url text, posting_age_days integer, skills jsonb,
    vector_similarity double precision, skill_overlap_ratio double precision, 
    match_score double precision
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_signal_health DOUBLE PRECISION;
BEGIN
    -- 🔎 FORENSIC GATE: Use system_control_center or default to high-health
    SELECT COALESCE(signal_health_score, 1.0) INTO v_signal_health 
    FROM public.system_control_center LIMIT 1;

    RETURN QUERY
    WITH candidate_skills AS (
        SELECT unnest(p_candidate_skills) AS skill
    ),
    filtered_jobs AS (
        SELECT 
            cj.id,
            COALESCE(cj.canonical_company_key, 'Unknown')::TEXT as company_name,
            cj.normalized_title AS title,
            COALESCE(cj.employment_type, 'full_time') AS work_mode,
            COALESCE(cj.normalized_location, 'Remote') AS location_raw,
            rjd.source_url,
            GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - cj.created_at)) / 86400))::INTEGER AS posting_age_days,
            to_jsonb(cj.skills) as skills,
            e.embedding
        FROM public.canonical_jobs cj
        JOIN public.raw_job_documents rjd ON rjd.id = cj.raw_document_id
        LEFT JOIN public.job_embeddings e ON e.canonical_job_id = cj.id
        WHERE cj.is_active = true
            AND cj.is_ready = true -- 🔥 MANDATORY INTELLIGENCE GATE
            AND (p_candidate_role = '' OR cj.normalized_title ILIKE '%' || p_candidate_role || '%')
    )
    SELECT
        f.id,
        f.company_name,
        f.title,
        f.work_mode,
        f.location_raw,
        f.source_url,
        f.posting_age_days,
        f.skills,
        (1.0 - (f.embedding <=> p_candidate_embedding))::DOUBLE PRECISION as v_similarity,
        CASE 
            WHEN f.skills IS NULL OR jsonb_array_length(f.skills) = 0 THEN 0.3::DOUBLE PRECISION
            ELSE (SELECT count(*)::float / GREATEST(jsonb_array_length(f.skills), 1) 
                  FROM jsonb_array_elements_text(f.skills) s 
                  WHERE lower(s) IN (SELECT lower(skill) FROM candidate_skills))::DOUBLE PRECISION
        END as s_overlap,
        ((1.0 - (f.embedding <=> p_candidate_embedding)) * 0.7 + 0.3)::DOUBLE PRECISION as match_score
    FROM filtered_jobs f
    WHERE f.embedding IS NOT NULL
    ORDER BY match_score DESC
    LIMIT 50;
END;
$function$;

-- 3. FIX MISSION CONTROL VIEW (Point to job_embeddings, not job_features)
CREATE OR REPLACE VIEW public.system_control_center AS
 WITH stats AS (
         SELECT count(*) AS total_active,
            count(*) FILTER (WHERE canonical_jobs.is_suspected_spam) AS spam_count,
            count(*) FILTER (WHERE ((canonical_jobs.skills <> '{}'::text[]) OR (canonical_jobs.low_confidence_flag = true) OR (canonical_jobs.id IN ( SELECT job_embeddings.canonical_job_id
                   FROM job_embeddings)))) AS intelligence_covered,
            count(*) FILTER (WHERE (canonical_jobs.last_seen_at > (now() - '7 days'::interval))) AS fresh_count,
            count(*) FILTER (WHERE (canonical_jobs.merge_confidence_score < 0.8)) AS low_confidence_merges
           FROM canonical_jobs
          WHERE (canonical_jobs.is_active = true)
        ), parse_stats AS (
         SELECT count(*) FILTER (WHERE (raw_job_documents.parse_status = 'parsed'::text)) AS parsed_count,
            count(*) FILTER (WHERE (raw_job_documents.parse_status = 'failed'::text)) AS failed_count
           FROM raw_job_documents
        )
 SELECT round(((parse_stats.parsed_count)::numeric / (GREATEST((parse_stats.parsed_count + parse_stats.failed_count), (1)::bigint))::numeric), 4) AS parsing_success_rate,
    round(((stats.intelligence_covered)::numeric / (GREATEST(stats.total_active, (1)::bigint))::numeric), 4) AS intelligence_coverage,
    round(((stats.fresh_count)::numeric / (GREATEST(stats.total_active, (1)::bigint))::numeric), 4) AS freshness_integrity,
    round(((stats.spam_count)::numeric / (GREATEST(stats.total_active, (1)::bigint))::numeric), 4) AS spam_leakage,
    round((1.0 - ((stats.low_confidence_merges)::numeric / (GREATEST(stats.total_active, (1)::bigint))::numeric)), 4) AS dedup_accuracy,
    round(((((parse_stats.parsed_count)::numeric / (GREATEST((parse_stats.parsed_count + parse_stats.failed_count), (1)::bigint))::numeric) * 0.5) + (((stats.fresh_count)::numeric / (GREATEST(stats.total_active, (1)::bigint))::numeric) * 0.5)), 4) AS system_health_score,
    round(((((stats.intelligence_covered)::numeric / (GREATEST(stats.total_active, (1)::bigint))::numeric) * 0.7) + ((1.0 - ((stats.spam_count)::numeric / (GREATEST(stats.total_active, (1)::bigint))::numeric)) * 0.3)), 4) AS signal_health_score,
    round(((((((parse_stats.parsed_count)::numeric / (GREATEST((parse_stats.parsed_count + parse_stats.failed_count), (1)::bigint))::numeric) * 0.5) + (((stats.fresh_count)::numeric / (GREATEST(stats.total_active, (1)::bigint))::numeric) * 0.5)) + ((((stats.intelligence_covered)::numeric / (GREATEST(stats.total_active, (1)::bigint))::numeric) * 0.7) + ((1.0 - ((stats.spam_count)::numeric / (GREATEST(stats.total_active, (1)::bigint))::numeric)) * 0.3))) / (2)::numeric), 4) AS total_health_score,
    ( SELECT COALESCE(stddev_pop((hiring_decisions.interview_probability)::numeric), 0.1) AS "coalesce"
           FROM hiring_decisions
          WHERE (hiring_decisions.created_at > (now() - '1 day'::interval))) AS ranking_variance
   FROM stats,
    parse_stats;

COMMIT;
