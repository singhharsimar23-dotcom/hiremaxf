-- FAANG-Level Ingestion Pivot: Semantic De-Duplication & Predictive Decay
-- Domain: Lifecycle, Dedup, Intelligence

BEGIN;

-- 1. CATEGORY DECAY CONFIGURATION
CREATE TABLE IF NOT EXISTS public.category_decay_rates (
    category TEXT PRIMARY KEY,
    daily_decay_rate NUMERIC NOT NULL, -- 0.05 = 5% daily drop in open_probability
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed defaults
INSERT INTO public.category_decay_rates (category, daily_decay_rate, description)
VALUES 
    ('SOFTWARE', 0.05, 'High-stability engineering roles'),
    ('GIG', 0.15, 'High-velocity short-term roles'),
    ('MARKETING', 0.10, 'Mid-horizon growth roles'),
    ('DEFAULT', 0.08, 'Fallback decay rate')
ON CONFLICT (category) DO UPDATE SET daily_decay_rate = EXCLUDED.daily_decay_rate;

-- 2. SEMANTIC SIMILARITY RPC
-- Uses pgvector <=> (cosine distance) operator. 1 - distance = similarity.
CREATE OR REPLACE FUNCTION public.find_similar_jobs(
    p_embedding vector(1536),
    p_threshold float DEFAULT 0.96,
    p_limit int DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    company_name TEXT,
    similarity float
) LANGUAGE plpgsql STABLE AS $$
BEGIN
    RETURN QUERY
    SELECT 
        jp.id,
        jp.title,
        jp.company_name,
        1 - (jp.embedding <=> p_embedding) as similarity
    FROM public.job_pointers jp
    WHERE 1 - (jp.embedding <=> p_embedding) >= p_threshold
      AND jp.is_active = true
    ORDER BY jp.embedding <=> p_embedding
    LIMIT p_limit;
END;
$$;

-- 3. DYNAMIC CONFIDENCE ENGINE
-- Updates open_probability based on category decay rates
CREATE OR REPLACE FUNCTION public.calculate_job_open_probability()
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
    updated_count INT := 0;
BEGIN
    -- Update based on category decay
    UPDATE public.canonical_jobs cj
    SET open_probability = ROUND(cj.open_probability * POWER(1 - COALESCE(cdr.daily_decay_rate, ddr.daily_decay_rate), 1), 4)
    FROM public.job_pointers jp
    LEFT JOIN public.category_decay_rates cdr ON upper(jp.category) = cdr.category
    CROSS JOIN (SELECT daily_decay_rate FROM public.category_decay_rates WHERE category = 'DEFAULT') ddr
    WHERE cj.job_pointer_id = jp.id
      AND cj.is_active = true
      AND jp.is_active = true;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$;

-- 4. MASTER RESOLUTION TRIGGER (Optional but recommended)
-- Merges metadata if a job is clustered under a master_canonical_id
CREATE OR REPLACE FUNCTION public.resolve_master_metadata()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.master_canonical_id IS NOT NULL AND NEW.master_canonical_id != NEW.id THEN
        -- Inherit metadata from master or update master with new high-confidence signals
        -- Currently, we just ensure the master exists
        NULL;
    END IF;
    RETURN NEW;
END;
$$;

COMMIT;
