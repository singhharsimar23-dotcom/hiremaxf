-- 1. EVENT ARCHIVAL RPC
CREATE OR REPLACE FUNCTION public.archive_old_events(retention_days INT, batch_limit INT)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
    archived_count INT;
BEGIN
    WITH deleted_rows AS (
        DELETE FROM public.ingestion_events
        WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL
        RETURNING *
    )
    INSERT INTO public.event_archive (id, topic, payload, created_at, partition_key)
    SELECT id, topic, payload, created_at, partition_key FROM deleted_rows
    LIMIT batch_limit;
    
    GET DIAGNOSTICS archived_count = ROW_COUNT;
    RETURN archived_count;
END;
$$;

-- 2. MARKET STATS CALCULATION RPC
CREATE OR REPLACE FUNCTION public.calculate_company_market_stats()
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO public.company_market_state (
        company_key,
        jobs_active,
        jobs_new_1d,
        jobs_new_7d,
        jobs_new_30d,
        hiring_velocity_7d,
        hiring_velocity_30d,
        growth_rate_7d,
        growth_rate_30d,
        engineering_jobs,
        ml_jobs,
        data_jobs,
        product_jobs,
        last_computed_at
    )
    SELECT 
        canonical_company_key as company_key,
        COUNT(*) FILTER (WHERE lifecycle_state = 'active') as jobs_active,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day') as jobs_new_1d,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as jobs_new_7d,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as jobs_new_30d,
        
        -- Hiring Velocity (relative to previous period)
        (COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::NUMERIC - 
         COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '7 days' AND created_at >= NOW() - INTERVAL '14 days')::NUMERIC) as hiring_velocity_7d,
        
        (COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::NUMERIC - 
         COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '30 days' AND created_at >= NOW() - INTERVAL '60 days')::NUMERIC) as hiring_velocity_30d,
         
        -- Growth Rate %
        COALESCE(
            (COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::NUMERIC / 
            NULLIF(COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '7 days' AND created_at >= NOW() - INTERVAL '14 days'), 0)), 
            0
        ) as growth_rate_7d,

        -- Role Distributions
        COUNT(*) FILTER (WHERE role_category = 'engineering') as engineering_jobs,
        COUNT(*) FILTER (WHERE role_category = 'ml') as ml_jobs,
        COUNT(*) FILTER (WHERE role_category = 'data') as data_jobs,
        COUNT(*) FILTER (WHERE role_category = 'product') as product_jobs,
        NOW() as last_computed_at
    FROM public.canonical_jobs
    GROUP BY canonical_company_key
    ON CONFLICT (company_key) DO UPDATE SET
        jobs_active = EXCLUDED.jobs_active,
        jobs_new_1d = EXCLUDED.jobs_new_1d,
        jobs_new_7d = EXCLUDED.jobs_new_7d,
        jobs_new_30d = EXCLUDED.jobs_new_30d,
        hiring_velocity_7d = EXCLUDED.hiring_velocity_7d,
        hiring_velocity_30d = EXCLUDED.hiring_velocity_30d,
        growth_rate_7d = EXCLUDED.growth_rate_7d,
        engineering_jobs = EXCLUDED.engineering_jobs,
        ml_jobs = EXCLUDED.ml_jobs,
        data_jobs = EXCLUDED.data_jobs,
        product_jobs = EXCLUDED.product_jobs,
        last_computed_at = EXCLUDED.last_computed_at;
END;
$$;

-- 3. FRONTEND MARKET OUTLOOK APIS (RPC)

CREATE OR REPLACE FUNCTION public.get_hiring_velocity_rankings()
RETURNS SETOF public.company_market_state LANGUAGE sql STABLE AS $$
    SELECT * FROM public.company_market_state 
    ORDER BY hiring_velocity_7d DESC 
    LIMIT 20;
$$;

CREATE OR REPLACE FUNCTION public.get_tech_demand_trends()
RETURNS SETOF public.technology_trends LANGUAGE sql STABLE AS $$
    SELECT * FROM public.technology_trends 
    ORDER BY momentum_score DESC 
    LIMIT 20;
$$;

CREATE OR REPLACE FUNCTION public.get_hiring_freeze_radar()
RETURNS SETOF public.company_market_state LANGUAGE sql STABLE AS $$
    SELECT * FROM public.company_market_state 
    WHERE hiring_velocity_7d < -5 -- Example threshold for "freeze"
    ORDER BY hiring_velocity_7d ASC;
$$;
