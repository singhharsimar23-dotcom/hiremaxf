-- 1. True Append-Only Event Log
CREATE TABLE IF NOT EXISTS ingestion_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ingestion_events_topic_idx ON ingestion_events(topic);
CREATE INDEX IF NOT EXISTS ingestion_events_created_at_idx ON ingestion_events(created_at);

-- Consumer Offsets
CREATE TABLE IF NOT EXISTS consumer_offsets (
    consumer_name TEXT PRIMARY KEY,
    last_processed_event_id UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Raw Data Archive (Safely Alter)
ALTER TABLE raw_job_documents
ADD COLUMN IF NOT EXISTS source TEXT,
ADD COLUMN IF NOT EXISTS raw_html TEXT,
ADD COLUMN IF NOT EXISTS crawl_metadata JSONB;

CREATE INDEX IF NOT EXISTS raw_job_documents_source_idx ON raw_job_documents(source);

-- 3. Canonical Jobs (Safely Alter)
ALTER TABLE canonical_jobs
ADD COLUMN IF NOT EXISTS canonical_company_key TEXT,
ADD COLUMN IF NOT EXISTS lifecycle_state TEXT DEFAULT 'discovered',
ADD COLUMN IF NOT EXISTS open_probability NUMERIC,
ADD COLUMN IF NOT EXISTS expiration_estimate TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS raw_document_id UUID,
ADD COLUMN IF NOT EXISTS parser_version TEXT,
ADD COLUMN IF NOT EXISTS normalizer_version TEXT,
ADD COLUMN IF NOT EXISTS entity_resolver_version TEXT;

CREATE INDEX IF NOT EXISTS canonical_jobs_company_idx ON canonical_jobs(canonical_company_key);

-- 4. Feature Store (Safely Alter)
ALTER TABLE job_features
ADD COLUMN IF NOT EXISTS salary_estimate NUMERIC,
ADD COLUMN IF NOT EXISTS skill_embedding vector(1536),
ADD COLUMN IF NOT EXISTS required_experience INT,
ADD COLUMN IF NOT EXISTS seniority_probability JSONB,
ADD COLUMN IF NOT EXISTS job_freshness_score NUMERIC,
ADD COLUMN IF NOT EXISTS company_growth_rate NUMERIC,
ADD COLUMN IF NOT EXISTS market_competitiveness NUMERIC,
ADD COLUMN IF NOT EXISTS feature_engine_version TEXT;

-- 5. Source Reliability (Safely Alter)
ALTER TABLE source_reliability
ADD COLUMN IF NOT EXISTS jobs_found_7d INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS jobs_new_7d INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS error_rate_pct NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS latency_ms_avg NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS freshness_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS reliability_score NUMERIC DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();

-- 6. Market Intelligence Layer (Safely Alter)
ALTER TABLE company_hiring_signals
ADD COLUMN IF NOT EXISTS company_key TEXT,
ADD COLUMN IF NOT EXISTS jobs_this_week INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS jobs_last_week INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS hiring_velocity NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS growth_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS role_distribution JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 7. Serving Layer Abstraction
CREATE TABLE IF NOT EXISTS jobs_serving (
    job_id UUID PRIMARY KEY,
    title TEXT,
    company_name TEXT,
    location TEXT,
    role_category TEXT,
    seniority_band TEXT,
    salary_estimate NUMERIC,
    job_freshness_score NUMERIC,
    market_competitiveness NUMERIC,
    source_url TEXT,
    first_seen_at TIMESTAMPTZ,
    last_verified_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS jobs_serving_company_idx ON jobs_serving(company_name);

-- 9. Pipeline Observability (Safely Alter)
ALTER TABLE ingestion_metrics
ADD COLUMN IF NOT EXISTS stage TEXT,
ADD COLUMN IF NOT EXISTS events_per_minute INT,
ADD COLUMN IF NOT EXISTS pipeline_latency_ms INT,
ADD COLUMN IF NOT EXISTS parser_failure_rate NUMERIC,
ADD COLUMN IF NOT EXISTS dedupe_ratio NUMERIC,
ADD COLUMN IF NOT EXISTS entity_resolution_confidence NUMERIC;

CREATE INDEX IF NOT EXISTS ingestion_metrics_stage_idx ON ingestion_metrics(stage);
-- timestamp index already exists or you can add if needed, skipping to avoid duplicates

-- Enable RLS
ALTER TABLE ingestion_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumer_offsets ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_job_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_reliability ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_hiring_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs_serving ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_metrics ENABLE ROW LEVEL SECURITY;
