-- Enable Vector extension just in case (sub-linear entity resolution)
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. EVENT STREAM HARDENING

-- 1a. Add partition key to ingestion_events
ALTER TABLE public.ingestion_events
ADD COLUMN IF NOT EXISTS partition_key TEXT DEFAULT 'global';

-- 1b. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_partition_created ON public.ingestion_events (partition_key, created_at);
CREATE INDEX IF NOT EXISTS idx_events_topic_created ON public.ingestion_events (topic, created_at);

-- 1c. Create event_archive
CREATE TABLE IF NOT EXISTS public.event_archive (
    id UUID PRIMARY KEY,
    topic TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    partition_key TEXT DEFAULT 'global'
);
CREATE INDEX IF NOT EXISTS idx_event_archive_created ON public.event_archive (created_at);

-- 1d. Create dead_letter_events
CREATE TABLE IF NOT EXISTS public.dead_letter_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL,
    topic TEXT NOT NULL,
    payload JSONB,
    worker_name TEXT NOT NULL,
    error_message TEXT,
    failed_at TIMESTAMPTZ DEFAULT NOW(),
    partition_key TEXT
);
CREATE INDEX IF NOT EXISTS idx_dlq_failed_at ON public.dead_letter_events(failed_at);

-- 1e. Upgrade consumer_offsets to be partition-aware
-- We drop the old constraint if it existed and make a new composite primary key
-- Note: If consumer_offsets already existed in V1, we need to adapt it cleanly.
ALTER TABLE public.consumer_offsets
ADD COLUMN IF NOT EXISTS partition_key TEXT DEFAULT 'global';

-- Assuming existing constraint was UNIQUE(consumer_name) or PRIMARY KEY(consumer_name)
-- We must drop it and replace it with (consumer_name, partition_key). 
-- (Doing this safely with PL/pgSQL block to avoid errors if constraint names vary)
DO $$
DECLARE
    constraint_name text;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.consumer_offsets'::regclass AND contype = 'u';
    
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.consumer_offsets DROP CONSTRAINT ' || constraint_name;
    END IF;

    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.consumer_offsets'::regclass AND contype = 'p';

    IF constraint_name IS NOT NULL THEN
         EXECUTE 'ALTER TABLE public.consumer_offsets DROP CONSTRAINT ' || constraint_name;
    END IF;
END $$;

-- Make sure we don't have duplicates before adding the new constraint
DELETE FROM public.consumer_offsets WHERE ctid NOT IN (
    SELECT MAX(ctid) FROM public.consumer_offsets GROUP BY consumer_name, partition_key
);

ALTER TABLE public.consumer_offsets ADD PRIMARY KEY (consumer_name, partition_key);

-- 2. CORE STORAGE ENHANCEMENTS

-- 2a. Extend canonical_jobs with Lifecycle tracking
ALTER TABLE public.canonical_jobs
ADD COLUMN IF NOT EXISTS lifecycle_state TEXT DEFAULT 'discovered', -- 'discovered', 'active', 'aging', 'stale', 'expired'
ADD COLUMN IF NOT EXISTS open_probability NUMERIC DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS expiration_estimate TIMESTAMPTZ;

-- 2b. Add vector embeddings to job_features if not present
ALTER TABLE public.job_features
ADD COLUMN IF NOT EXISTS skill_embedding vector(1536);

-- 3. COMPANY IDENTITY GRAPH

CREATE TABLE IF NOT EXISTS public.company_nodes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    type TEXT DEFAULT 'COMPANY', -- COMPANY, SUBSIDIARY, BRAND, HOLDING
    domain TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.company_edges (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    parent_id UUID REFERENCES public.company_nodes(id) ON DELETE CASCADE,
    child_id UUID REFERENCES public.company_nodes(id) ON DELETE CASCADE,
    relation_type TEXT NOT NULL, -- OWNS, OPERATES_BRAND, SUBSIDIARY_OF
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(parent_id, child_id, relation_type)
);

-- 4. MARKET STATE ENGINE

CREATE TABLE IF NOT EXISTS public.company_market_state (
    company_key TEXT PRIMARY KEY,
    jobs_active INTEGER DEFAULT 0,
    jobs_new_1d INTEGER DEFAULT 0,
    jobs_new_7d INTEGER DEFAULT 0,
    jobs_new_30d INTEGER DEFAULT 0,
    hiring_velocity_7d NUMERIC DEFAULT 0,
    hiring_velocity_30d NUMERIC DEFAULT 0,
    growth_rate_7d NUMERIC DEFAULT 0,
    growth_rate_30d NUMERIC DEFAULT 0,
    engineering_jobs INTEGER DEFAULT 0,
    ml_jobs INTEGER DEFAULT 0,
    data_jobs INTEGER DEFAULT 0,
    product_jobs INTEGER DEFAULT 0,
    last_computed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_market_state_vel ON public.company_market_state (hiring_velocity_7d DESC);

-- 5. HIRING KNOWLEDGE GRAPH

CREATE TABLE IF NOT EXISTS public.hiring_graph_nodes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    label TEXT NOT NULL,
    type TEXT NOT NULL, -- SKILL, TECH, ROLE, LOCATION, TEAM
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(label, type)
);

CREATE TABLE IF NOT EXISTS public.hiring_graph_edges (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    source_id UUID REFERENCES public.hiring_graph_nodes(id) ON DELETE CASCADE,
    target_id UUID REFERENCES public.hiring_graph_nodes(id) ON DELETE CASCADE,
    relation_type TEXT NOT NULL, -- REQUIRES, USES, EXPANDS_TO, FORMS
    weight NUMERIC DEFAULT 1.0,
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_id, target_id, relation_type)
);

-- 6. FRONTEND SERVING

ALTER TABLE public.market_signals
ADD COLUMN IF NOT EXISTS signal_type TEXT,
ADD COLUMN IF NOT EXISTS company_key TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS confidence NUMERIC DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS detected_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_market_signals_detected ON public.market_signals(detected_at DESC);

CREATE TABLE IF NOT EXISTS public.technology_trends (
    tech_name TEXT PRIMARY KEY,
    demand_count INTEGER DEFAULT 0,
    growth_pct NUMERIC DEFAULT 0,
    momentum_score NUMERIC DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tech_trends_momentum ON public.technology_trends(momentum_score DESC);

-- 7. OBSERVABILITY

ALTER TABLE public.ingestion_metrics
ADD COLUMN IF NOT EXISTS consumer_lag INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS parser_failure_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS source_freshness_hrs NUMERIC DEFAULT 0;
