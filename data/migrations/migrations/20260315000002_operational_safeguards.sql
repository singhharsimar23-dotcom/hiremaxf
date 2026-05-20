-- Migration: 20260315000002_operational_safeguards.sql
-- Goal: Implement operational safeguards for reliability, observability, and auditability.

-- 1. Forecast Drift Monitoring
CREATE TABLE IF NOT EXISTS public.forecast_accuracy_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    forecast_id UUID NOT NULL,
    company_key TEXT NOT NULL,
    forecast_timestamp TIMESTAMPTZ NOT NULL,
    predicted_roles TEXT[] NOT NULL,
    actual_roles_detected TEXT[] NOT NULL,
    accuracy_score FLOAT NOT NULL,
    evaluation_timestamp TIMESTAMPTZ DEFAULT now()
);

-- 2. Ingestion Coverage Monitoring
CREATE TABLE IF NOT EXISTS public.source_coverage_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_name TEXT NOT NULL,
    expected_jobs_7d INTEGER NOT NULL,
    actual_jobs_7d INTEGER NOT NULL,
    coverage_ratio FLOAT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT now()
);

-- 3. Signal Provenance Tracking (Lineage)
ALTER TABLE public.market_momentum_signals 
ADD COLUMN IF NOT EXISTS source_event_ids UUID[],
ADD COLUMN IF NOT EXISTS source_scrapers TEXT[],
ADD COLUMN IF NOT EXISTS processing_versions TEXT[],
ADD COLUMN IF NOT EXISTS generated_timestamp TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.company_demand_forecast 
ADD COLUMN IF NOT EXISTS source_event_ids UUID[],
ADD COLUMN IF NOT EXISTS source_scrapers TEXT[],
ADD COLUMN IF NOT EXISTS processing_versions TEXT[],
ADD COLUMN IF NOT EXISTS generated_timestamp TIMESTAMPTZ DEFAULT now();

-- 4. Pipeline Replay Capability
CREATE OR REPLACE FUNCTION public.replay_pipeline(start_timestamp TIMESTAMPTZ)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    -- Reset derived tables
    TRUNCATE TABLE public.canonical_jobs CASCADE;
    TRUNCATE TABLE public.job_features CASCADE;
    TRUNCATE TABLE public.company_market_state CASCADE;
    TRUNCATE TABLE public.market_momentum_signals CASCADE;
    TRUNCATE TABLE public.company_demand_forecast CASCADE;

    -- Reset consumer offsets for all workers to the start timestamp
    -- Note: We assume ingestion_events table exists and has created_at
    -- We can't actually 're-run' the workers here as they are external Edge Functions,
    -- but we can reset the state so they pull from the beginning.
    -- To truly 'replay' synchronously, we would need to trigger them.
    UPDATE public.consumer_offsets 
    SET last_event_id = (
        SELECT id FROM public.ingestion_events 
        WHERE created_at >= start_timestamp 
        ORDER BY created_at ASC LIMIT 1
    );

    RETURN jsonb_build_object(
        'status', 'success',
        'message', 'Derived tables truncated and offsets reset. Workers will resume processing from requested timestamp.',
        'replay_start', start_timestamp
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Signal Lineage Debugging
CREATE OR REPLACE FUNCTION public.get_signal_lineage(signal_id UUID)
RETURNS JSONB AS $$
DECLARE
    sig_type TEXT;
    lineage JSONB;
BEGIN
    -- Check momentum signals first
    IF EXISTS (SELECT 1 FROM public.market_momentum_signals WHERE id = signal_id) THEN
        SELECT jsonb_build_object(
            'type', 'momentum',
            'origin_events', source_event_ids,
            'sources', source_scrapers,
            'versions', processing_versions,
            'timestamp', generated_timestamp
        ) INTO lineage
        FROM public.market_momentum_signals WHERE id = signal_id;
    -- Then check forecasts
    ELSIF EXISTS (SELECT 1 FROM public.company_demand_forecast WHERE id = signal_id) THEN
        SELECT jsonb_build_object(
            'type', 'forecast',
            'origin_events', source_event_ids,
            'sources', source_scrapers,
            'versions', processing_versions,
            'timestamp', generated_timestamp
        ) INTO lineage
        FROM public.company_demand_forecast WHERE id = signal_id;
    ELSE
        RETURN jsonb_build_object('error', 'Signal not found');
    END IF;

    RETURN lineage;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Extended Health Metrics
CREATE OR REPLACE FUNCTION public.get_pipeline_health()
RETURNS JSONB AS $$
DECLARE
    total_lag INTEGER;
    dlq_count INTEGER;
    acc_rate FLOAT;
    emission_rate FLOAT;
    cov_ratio FLOAT;
BEGIN
    -- Worker Lag
    SELECT COALESCE(SUM(id), 0) INTO total_lag -- This is a placeholder, real lag = (max_id - offset)
    FROM (
        SELECT (SELECT MAX(id::text) FROM public.ingestion_events) as max_id, last_event_id 
        FROM public.consumer_offsets
    ) s;

    -- DLQ Count
    SELECT COUNT(*) INTO dlq_count FROM public.dead_letter_events;

    -- Forecast Accuracy (avg of last 30 days)
    SELECT AVG(accuracy_score) INTO acc_rate 
    FROM public.forecast_accuracy_metrics 
    WHERE evaluation_timestamp > now() - interval '30 days';

    -- Signal Emission Rate (signals per day)
    SELECT COUNT(*) / 7.0 INTO emission_rate 
    FROM public.market_signals 
    WHERE computed_at > now() - interval '7 days';

    -- Source Coverage Ratio (minimum of last 24h)
    SELECT MIN(coverage_ratio) INTO cov_ratio 
    FROM public.source_coverage_metrics 
    WHERE timestamp > now() - interval '24 hours';

    RETURN jsonb_build_object(
        'status', 'healthy',
        'worker_lag', total_lag,
        'dlq_event_count', dlq_count,
        'forecast_accuracy_rate', COALESCE(acc_rate, 1.0),
        'signal_emission_rate', emission_rate,
        'source_coverage_ratio', COALESCE(cov_ratio, 1.0),
        'timestamp', now()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Automated Forecast Evaluation Job
CREATE OR REPLACE FUNCTION public.evaluate_forecast_accuracy()
RETURNS void AS $$
DECLARE
    f RECORD;
    actual_count INTEGER;
    detected_roles TEXT[];
BEGIN
    FOR f IN 
        SELECT id, company_key, predicted_roles, forecast_timestamp 
        FROM public.company_demand_forecast 
        WHERE generated_timestamp < now() - interval '7 days'
        AND id NOT IN (SELECT forecast_id FROM public.forecast_accuracy_metrics)
    LOOP
        -- Find actual jobs posted after the forecast for these roles
        SELECT array_agg(DISTINCT role_category) INTO detected_roles
        FROM public.canonical_jobs
        WHERE company_domain = f.company_key
        AND created_at > f.forecast_timestamp
        AND role_category = ANY(f.predicted_roles);

        -- Calculate score (Intersection / Predicted)
        IF array_length(f.predicted_roles, 1) > 0 THEN
            actual_count := COALESCE(array_length(detected_roles, 1), 0);
            INSERT INTO public.forecast_accuracy_metrics (
                forecast_id, company_key, forecast_timestamp, 
                predicted_roles, actual_roles_detected, accuracy_score
            ) VALUES (
                f.id, f.company_key, f.forecast_timestamp, 
                f.predicted_roles, COALESCE(detected_roles, '{}'), 
                actual_count::float / array_length(f.predicted_roles, 1)
            );
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Source Coverage Monitoring Job
CREATE OR REPLACE FUNCTION public.monitor_source_coverage()
RETURNS void AS $$
DECLARE
    src RECORD;
    hist_avg FLOAT;
    cur_count INTEGER;
BEGIN
    FOR src IN SELECT DISTINCT source_name FROM public.source_coverage_metrics UNION SELECT 'default' LOOP
        -- Calculate historical 7d average (baseline)
        SELECT COALESCE(AVG(actual_jobs_7d), 10) INTO hist_avg 
        FROM public.source_coverage_metrics 
        WHERE source_name = src.source_name;

        -- Count actual jobs in last 7d
        SELECT COUNT(*) INTO cur_count 
        FROM public.ingestion_events 
        WHERE metadata->>'source' = src.source_name
        AND created_at > now() - interval '7 days';

        INSERT INTO public.source_coverage_metrics (
            source_name, expected_jobs_7d, actual_jobs_7d, coverage_ratio
        ) VALUES (
            src.source_name, hist_avg::int, cur_count, 
            CASE WHEN hist_avg > 0 THEN cur_count / hist_avg ELSE 1.0 END
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
