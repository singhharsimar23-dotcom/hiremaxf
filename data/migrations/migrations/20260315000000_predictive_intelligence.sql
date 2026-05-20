-- Phase 4: Hiring Momentum & Predictive Intelligence

-- 1. EXTEND MARKET STATE ENGINE
ALTER TABLE public.company_market_state
ADD COLUMN IF NOT EXISTS velocity_7d NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS velocity_30d NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS hma_score NUMERIC DEFAULT 0;

-- 2. MOMENTUM SIGNALS STORAGE
CREATE TABLE IF NOT EXISTS public.market_momentum_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT DEFAULT 'COMPANY',
    entity_key TEXT NOT NULL,
    velocity_7d NUMERIC,
    velocity_30d NUMERIC,
    hma_score NUMERIC,
    confidence_score NUMERIC,
    evidence_count INTEGER,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sector_momentum_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sector TEXT NOT NULL,
    velocity_7d NUMERIC,
    velocity_30d NUMERIC,
    hma_score NUMERIC,
    confidence_score NUMERIC,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 3. REFINED DEMAND FORECAST STORAGE
CREATE TABLE IF NOT EXISTS public.company_demand_forecast (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_key TEXT NOT NULL UNIQUE,
    forecast_timestamp TIMESTAMPTZ DEFAULT NOW(),
    predicted_roles JSONB DEFAULT '[]'::jsonb,
    predicted_hiring_velocity NUMERIC,
    confidence_score NUMERIC,
    forecast_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. MARKET OUTLOOK RPC ENDPOINTS

-- Hiring Momentum Radar (Top companies by hma_score)
CREATE OR REPLACE FUNCTION public.get_hiring_momentum_radar(limit_count INT DEFAULT 50)
RETURNS TABLE (
    company TEXT,
    velocity_7d NUMERIC,
    velocity_30d NUMERIC,
    hma_score NUMERIC,
    confidence_score NUMERIC
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT 
        entity_key as company,
        mms.velocity_7d,
        mms.velocity_30d,
        mms.hma_score,
        mms.confidence_score
    FROM public.market_momentum_signals mms
    WHERE mms.timestamp > NOW() - INTERVAL '24 hours'
    ORDER BY hma_score DESC
    LIMIT limit_count;
END;
$$;

-- Sector Momentum
CREATE OR REPLACE FUNCTION public.get_sector_momentum()
RETURNS TABLE (
    sector TEXT,
    velocity_7d NUMERIC,
    velocity_30d NUMERIC,
    hma_score NUMERIC,
    confidence_score NUMERIC
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sms.sector,
        sms.velocity_7d,
        sms.velocity_30d,
        sms.hma_score,
        sms.confidence_score
    FROM public.sector_momentum_signals sms
    WHERE sms.timestamp > NOW() - INTERVAL '24 hours'
    ORDER BY hma_score DESC;
END;
$$;

-- Demand Forecasts
CREATE OR REPLACE FUNCTION public.get_demand_forecasts()
RETURNS TABLE (
    company TEXT,
    predicted_roles JSONB,
    confidence_score NUMERIC,
    forecast_reason TEXT
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT 
        company_key as company,
        cdf.predicted_roles,
        cdf.confidence_score,
        cdf.forecast_reason
    FROM public.company_demand_forecast cdf
    WHERE confidence_score >= 0.75
    ORDER BY confidence_score DESC;
END;
$$;

-- Signal Explainability (Update)
CREATE OR REPLACE FUNCTION public.get_signal_evidence(p_signal_id UUID)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'signal_id', p_signal_id,
        'evidence', metadata,
        'confidence', confidence_score
    ) INTO result
    FROM public.market_signals
    WHERE id = p_signal_id;
    
    IF result IS NULL THEN
        SELECT jsonb_build_object(
            'signal_id', p_signal_id,
            'hma_score', hma_score,
            'confidence', confidence_score
        ) INTO result
        FROM public.market_momentum_signals
        WHERE id = p_signal_id;
    END IF;

    RETURN result;
END;
$$;
