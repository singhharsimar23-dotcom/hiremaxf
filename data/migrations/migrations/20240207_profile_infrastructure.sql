-- HireMax Profile & Identity Ingestion Infrastructure
-- This schema implements a high-integrity, asynchronous ingestion pipeline.

-- 1. COMMAND LAYER: TRACKING INTENT & IDEMPOTENCY
CREATE TABLE IF NOT EXISTS public.ingestion_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    source TEXT NOT NULL, -- 'LINKEDIN', 'GITHUB', 'GMAIL', 'SCHOLAR', 'EXTERNAL'
    reason TEXT,
    issued_by TEXT DEFAULT 'USER',
    issued_at TIMESTAMPTZ DEFAULT now(),
    idempotency_key TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    error_reason TEXT,
    metadata JSONB DEFAULT '{}'
);

-- 2. RAW LAYER: APPEND-ONLY SOURCE STORAGE (FULL PAYLOAD PRESERVATION)
CREATE TABLE IF NOT EXISTS public.raw_linkedin_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    command_id UUID REFERENCES public.ingestion_commands(id),
    raw_payload JSONB NOT NULL,
    ingested_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.raw_github_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    command_id UUID REFERENCES public.ingestion_commands(id),
    raw_payload JSONB NOT NULL,
    ingested_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.raw_gmail_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    command_id UUID REFERENCES public.ingestion_commands(id),
    raw_payload JSONB NOT NULL,
    ingested_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.raw_external_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    command_id UUID REFERENCES public.ingestion_commands(id),
    url TEXT NOT NULL,
    raw_payload JSONB NOT NULL,
    ingested_at TIMESTAMPTZ DEFAULT now()
);

-- 3. EVIDENCE LAYER: THE SINGLE SOURCE OF TRUTH (IMMUTABLE RECORDS)
CREATE TABLE IF NOT EXISTS public.evidence_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    claim_type TEXT NOT NULL, -- 'EXPERIENCE', 'EDUCATION', 'SKILL', 'OUTCOME'
    source TEXT NOT NULL,
    raw_reference_id UUID NOT NULL, -- ID in one of the raw_ tables
    trust_score FLOAT DEFAULT 1.0,
    claim_data JSONB NOT NULL,
    state TEXT DEFAULT 'ACTIVE', -- 'ACTIVE', 'FROZEN', 'SUPERSEDED'
    ingested_at TIMESTAMPTZ DEFAULT now(),
    valid_from TIMESTAMPTZ DEFAULT now(),
    valid_to TIMESTAMPTZ
);

-- 4. SNAPSHOT LAYER: VERSIONED READINESS STATE (READ-ONLY FOR DOWNSTREAM)
CREATE TABLE IF NOT EXISTS public.profile_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    version INTEGER NOT NULL,
    verification_state TEXT NOT NULL, -- 'VERIFIED', 'INCOMPLETE'
    evidence_coverage_percentage INTEGER DEFAULT 0,
    coverage_by_source JSONB DEFAULT '{}',
    freshness_vector JSONB DEFAULT '{}', -- {linkedin_days_old, ...}
    snapshot_data JSONB NOT NULL, -- The full normalized profile
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. OBSERVABILITY LAYER: SYSTEM INTEGRITY LOG (APPEND-ONLY)
CREATE TABLE IF NOT EXISTS public.integrity_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    event_type TEXT NOT NULL, -- 'INGESTION', 'SECURITY', 'SYSTEM'
    source TEXT,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ DEFAULT now()
);

-- 6. OUTCOMES: SEPARATE NAMESPACE FOR LEARNING (DOES NOT MERGE INTO IDENTITY)
CREATE TABLE IF NOT EXISTS public.profile_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    source_reference_id UUID, -- Reference to Gmail snapshot or external source
    employer_name TEXT,
    funnel_stage TEXT, -- 'APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'REJECTION'
    outcome_classification TEXT,
    learning_metadata JSONB DEFAULT '{}',
    event_at TIMESTAMPTZ DEFAULT now()
);

-- INDEXING FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_evidence_user ON public.evidence_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_user ON public.profile_snapshots(user_id, version);
CREATE INDEX IF NOT EXISTS idx_integrity_user ON public.integrity_events(user_id);
CREATE INDEX IF NOT EXISTS idx_commands_user ON public.ingestion_commands(user_id, status);
