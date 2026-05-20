-- 1. BULK RESOLVE POINTERS V4 (The Connection Fix)
CREATE OR REPLACE FUNCTION public.bulk_resolve_pointers_v4(p_jobs jsonb[])
RETURNS TABLE (id uuid, fingerprint text) AS $$
BEGIN
    RETURN QUERY
    WITH input_data AS (
        SELECT 
            (val->>'fingerprint')::text as f_print,
            (val->>'company_name')::text as c_name,
            (val->>'title')::text as j_title,
            (val->>'location_name')::text as l_name,
            (val->>'source_url')::text as s_url,
            (val->>'source_type')::text as s_type,
            (val->>'discovery_method')::text as d_method,
            (val->>'confidence_tier')::text as c_tier,
            (val->>'signal_tier')::text as s_tier,
            (val->'raw_payload')::jsonb as r_payload,
            (val->>'request_id')::uuid as r_id
        FROM unnest(p_jobs) val
    ),
    upserted AS (
        INSERT INTO public.job_pointers (
            fingerprint, company_name, title, location_name, 
            source_url, source_type, discovery_method, 
            confidence_tier, signal_tier, raw_payload, request_id,
            first_seen_at, last_verified_at, validation_status,
            sponsorship_type -- We'll use this for the regex match
        )
        SELECT 
            f_print, c_name, j_title, l_name, 
            s_url, s_type, d_method, 
            COALESCE(c_tier, 'low'), COALESCE(s_tier, 'T1'), r_payload, r_id,
            now(), now(), 'pending',
            CASE 
                WHEN j_title ~* '\b(h1b|visa|sponsorship)\b' OR (r_payload->>'description') ~* '\b(h1b|visa|sponsorship)\b' 
                THEN 'supported' 
                ELSE 'unknown' 
            END
        FROM input_data
        ON CONFLICT (fingerprint) DO UPDATE SET
            last_verified_at = now(),
            request_id = EXCLUDED.request_id,
            signal_tier = EXCLUDED.signal_tier
        RETURNING job_pointers.id, job_pointers.fingerprint
    )
    SELECT u.id, u.fingerprint FROM upserted u;
END;
$$ LANGUAGE plpgsql;

-- 2. MATERIALIZE & BURN (The Space Saver)
CREATE OR REPLACE FUNCTION public.purge_raw_blobs_v1()
RETURNS void AS $$
BEGIN
    DELETE FROM public.raw_job_documents
    WHERE is_parsed = true
    AND ingested_at < now() - interval '48 hours';
END;
$$ LANGUAGE plpgsql;

-- 3. PRODUCT-FIRST RETENTION (The 14-Day Scale Rule)
CREATE OR REPLACE FUNCTION public.purge_expired_canonical_v1()
RETURNS void AS $$
BEGIN
    DELETE FROM public.canonical_jobs
    WHERE (expiration_estimate < now() OR created_at < now() - interval '14 days') -- Tightened for scale
    AND id NOT IN (SELECT job_id FROM public.user_bookmarks)
    AND id NOT IN (SELECT p.id FROM public.job_pointers p JOIN public.applications a ON p.id = a.job_pointer_id);
END;
$$ LANGUAGE plpgsql;

-- 4. CRON: 2-HOUR OMNI-US SWEEP (The Sweet Spot)
-- Remove old schedules to prevent double-firing
SELECT cron.unschedule('discovery-orchestrator-6h');
SELECT cron.unschedule('discovery-orchestrator-1h');

SELECT cron.schedule(
    'discovery-orchestrator-2h',
    '0 */2 * * *',
    'SELECT net.http_post(
        url := ''https://ssuknybhzcuusjardsve.functions.supabase.co/functions/v1/discovery-orchestrator'',
        headers := jsonb_build_object(
            ''Content-Type'', ''application/json'',
            ''Authorization'', ''Bearer '' || (SELECT value FROM public.system_settings WHERE key = ''SERVICE_ROLE_KEY'')
        ),
        body := ''{}''::jsonb
    );'
);

-- Register Storage Purges
SELECT cron.schedule(
    'purge-raw-blobs-6h',
    '30 */6 * * *',
    'SELECT public.purge_raw_blobs_v1();'
);

SELECT cron.schedule(
    'purge-canonical-daily',
    '0 0 * * *',
    'SELECT public.purge_expired_canonical_v1();'
);
