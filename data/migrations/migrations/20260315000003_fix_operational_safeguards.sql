-- Migration: 20260315000003_fix_operational_safeguards.sql
-- Goal: Fix schema mismatches and logic in operational safeguards.

-- 1. Fix replay_pipeline
CREATE OR REPLACE FUNCTION public.replay_pipeline(start_timestamp TIMESTAMPTZ)
RETURNS JSONB AS $$
DECLARE
    target_id UUID;
BEGIN
    -- Reset derived tables
    TRUNCATE TABLE public.canonical_jobs CASCADE;
    TRUNCATE TABLE public.job_features CASCADE;
    TRUNCATE TABLE public.company_market_state CASCADE;
    TRUNCATE TABLE public.market_momentum_signals CASCADE;
    TRUNCATE TABLE public.company_demand_forecast CASCADE;

    -- Find the event ID to start from
    SELECT id INTO target_id FROM public.ingestion_events 
    WHERE created_at >= start_timestamp 
    ORDER BY created_at ASC LIMIT 1;

    -- Reset consumer offsets for all workers
    UPDATE public.consumer_offsets 
    SET last_processed_event_id = target_id,
        updated_at = now();

    RETURN jsonb_build_object(
        'status', 'success',
        'message', 'Derived tables truncated and offsets reset. Workers will resume processing.',
        'replay_start_id', target_id,
        'replay_start_time', start_timestamp
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fix get_pipeline_health
CREATE OR REPLACE FUNCTION public.get_pipeline_health()
RETURNS JSONB AS $$
DECLARE
    total_lag INTEGER;
    dlq_count INTEGER;
    acc_rate FLOAT;
    emission_rate FLOAT;
    cov_ratio FLOAT;
BEGIN
    -- Worker Lag (Count of events after the earliest processed event among all consumers)
    -- This is a conservative measure of total system lag.
    SELECT COUNT(*) INTO total_lag
    FROM public.ingestion_events
    WHERE created_at > (
        SELECT MIN(e.created_at)
        FROM public.consumer_offsets co
        JOIN public.ingestion_events e ON co.last_processed_event_id = e.id
    );

    -- DLQ Count
    SELECT COUNT(*) INTO dlq_count FROM public.dead_letter_events;

    -- Forecast Accuracy (avg of last 30 days)
    SELECT AVG(accuracy_score) INTO acc_rate 
    FROM public.forecast_accuracy_metrics 
    WHERE evaluation_timestamp > now() - interval '30 days';

    -- Signal Emission Rate (signals per day from market_signals)
    -- Ensure market_signals exists and has computed_at
    SELECT COUNT(*) / 7.0 INTO emission_rate 
    FROM public.market_signals 
    WHERE created_at > now() - interval '7 days';

    -- Source Coverage Ratio (minimum of last 24h)
    SELECT MIN(coverage_ratio) INTO cov_ratio 
    FROM public.source_coverage_metrics 
    WHERE timestamp > now() - interval '24 hours';

    RETURN jsonb_build_object(
        'status', CASE WHEN total_lag > 5000 THEN 'degraded' ELSE 'healthy' END,
        'worker_lag', COALESCE(total_lag, 0),
        'dlq_event_count', dlq_count,
        'forecast_accuracy_rate', ROUND(COALESCE(acc_rate, 1.0)::numeric, 2),
        'signal_emission_rate', ROUND(emission_rate::numeric, 2),
        'source_coverage_ratio', ROUND(COALESCE(cov_ratio, 1.0)::numeric, 2),
        'timestamp', now()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
