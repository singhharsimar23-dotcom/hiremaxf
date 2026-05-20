-- Migration: 20260315000004_fix_health_rpc_final.sql
-- Goal: Fix column reference in get_pipeline_health.

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
    SELECT COUNT(*) INTO total_lag
    FROM public.ingestion_events
    WHERE created_at > (
        SELECT COALESCE(MIN(e.created_at), now() - interval '1 year')
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
    -- Using computed_at as verified via schema inspection
    SELECT COUNT(*) / 7.0 INTO emission_rate 
    FROM public.market_signals 
    WHERE computed_at > now() - interval '7 days';

    -- Source Coverage Ratio (minimum of last 24h)
    SELECT MIN(coverage_ratio) INTO cov_ratio 
    FROM public.source_coverage_metrics 
    WHERE timestamp > now() - interval '24 hours';

    RETURN jsonb_build_object(
        'status', CASE WHEN COALESCE(total_lag, 0) > 5000 THEN 'degraded' ELSE 'healthy' END,
        'worker_lag', COALESCE(total_lag, 0),
        'dlq_event_count', dlq_count,
        'forecast_accuracy_rate', ROUND(COALESCE(acc_rate, 1.0)::numeric, 2),
        'signal_emission_rate', ROUND(COALESCE(emission_rate, 0)::numeric, 2),
        'source_coverage_ratio', ROUND(COALESCE(cov_ratio, 1.0)::numeric, 2),
        'timestamp', now()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
