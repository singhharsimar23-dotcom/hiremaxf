-- ============================================================
-- SYSTEM HARDENING MIGRATION v1 — 2026-03-21
-- Domains: Lifecycle, Dedup, Search, Observability, Skill Graph
-- ============================================================

-- ── 1. LIFECYCLE COLUMNS ────────────────────────────────────
ALTER TABLE public.canonical_jobs
  ADD COLUMN IF NOT EXISTS last_seen_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_suspected_spam   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS spam_score          NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE public.raw_job_documents
  ADD COLUMN IF NOT EXISTS failure_class         TEXT,
  ADD COLUMN IF NOT EXISTS retry_after           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS content_quality_score NUMERIC;

-- ── 2. EXPIRATION BACKFILL ──────────────────────────────────
UPDATE public.canonical_jobs
SET expiration_estimate = created_at + INTERVAL '30 days',
    last_seen_at        = created_at
WHERE expiration_estimate IS NULL;

UPDATE public.canonical_jobs
SET is_active = false
WHERE expiration_estimate < NOW() AND is_active = true;

-- ── 3. INDEXES ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_canonical_is_active     ON public.canonical_jobs (is_active);
CREATE INDEX IF NOT EXISTS idx_canonical_expiration    ON public.canonical_jobs (expiration_estimate) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_canonical_last_seen     ON public.canonical_jobs (last_seen_at);
CREATE INDEX IF NOT EXISTS idx_canonical_spam          ON public.canonical_jobs (is_suspected_spam) WHERE is_suspected_spam = true;
CREATE INDEX IF NOT EXISTS idx_canonical_company_title ON public.canonical_jobs (company_id, normalized_title);
CREATE INDEX IF NOT EXISTS idx_canonical_enrichment    ON public.canonical_jobs (enrichment_status);
CREATE INDEX IF NOT EXISTS idx_raw_docs_retry_after    ON public.raw_job_documents (retry_after) WHERE parse_status = 'retry';
CREATE INDEX IF NOT EXISTS idx_raw_docs_failure_class  ON public.raw_job_documents (failure_class) WHERE failure_class IS NOT NULL;

-- ── 4. SPAM DETECTION RPC ───────────────────────────────────
-- Returns true if (company, title) spans 5+ distinct locations
-- Description similarity check enforced at application layer
CREATE OR REPLACE FUNCTION public.detect_agency_spam(p_company_id UUID, p_title TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT COUNT(DISTINCT normalized_location) >= 5
  FROM   public.canonical_jobs
  WHERE  company_id = p_company_id AND normalized_title ILIKE p_title AND is_active = true;
$$;

-- ── 5. ORPHAN REPAIR ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.repair_orphan_canonical_jobs(p_limit INT DEFAULT 500)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE repaired INT := 0; rec RECORD;
BEGIN
  FOR rec IN
    SELECT cj.id AS canonical_id, rjd.id AS raw_doc_id
    FROM   public.canonical_jobs cj
    JOIN   public.raw_job_documents rjd USING (job_pointer_id)
    WHERE  cj.raw_document_id IS NULL AND cj.job_pointer_id IS NOT NULL
    LIMIT  p_limit
  LOOP
    UPDATE public.canonical_jobs SET raw_document_id = rec.raw_doc_id WHERE id = rec.canonical_id;
    repaired := repaired + 1;
  END LOOP;
  RETURN repaired;
END;
$$;

-- ── 6. HYBRID RANKING RPC (replaces static 0.45 floor) ─────
-- Formula: 60% skill overlap + 25% recency decay + 15% experience match
-- Works WITHOUT vector embeddings. Remote filter strictly enforced.
CREATE OR REPLACE FUNCTION public.match_jobs_deterministic(
  p_candidate_skills  TEXT[],
  p_experience_years  INT     DEFAULT 3,
  p_remote_preference BOOLEAN DEFAULT false,
  p_location          TEXT    DEFAULT NULL,
  p_limit             INT     DEFAULT 50
)
RETURNS TABLE (
  job_id              UUID,
  normalized_title    TEXT,
  company_name        TEXT,
  normalized_location TEXT,
  location_type       TEXT,
  skills              TEXT[],
  salary_min          NUMERIC,
  salary_max          NUMERIC,
  experience_required INT,
  match_score         NUMERIC,
  skill_overlap_count INT,
  recency_score       NUMERIC,
  is_suspected_spam   BOOLEAN,
  created_at          TIMESTAMPTZ
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT
    cj.id,
    cj.normalized_title,
    c.name,
    cj.normalized_location,
    cj.location_type,
    cj.skills,
    cj.salary_min,
    cj.salary_max,
    cj.experience_required,
    ROUND((
      0.60 * CASE
        WHEN cardinality(p_candidate_skills) = 0 THEN 0.5
        ELSE LEAST(1.0,
          cardinality(ARRAY(SELECT unnest(cj.skills) INTERSECT SELECT unnest(p_candidate_skills)))::NUMERIC
          / NULLIF(cardinality(p_candidate_skills), 0)
        )
      END
      + 0.25 * EXP(-GREATEST(0, EXTRACT(EPOCH FROM (NOW() - cj.created_at)) / 2592000.0))
      + 0.15 * GREATEST(0.0, 1.0 - ABS(COALESCE(cj.experience_required, p_experience_years) - p_experience_years)::NUMERIC / 5.0)
    )::NUMERIC, 4)                                         AS match_score,
    cardinality(ARRAY(SELECT unnest(cj.skills) INTERSECT SELECT unnest(p_candidate_skills))) AS skill_overlap_count,
    ROUND(EXP(-GREATEST(0, EXTRACT(EPOCH FROM (NOW() - cj.created_at)) / 2592000.0))::NUMERIC, 4) AS recency_score,
    cj.is_suspected_spam,
    cj.created_at
  FROM public.canonical_jobs cj
  LEFT JOIN public.companies c ON c.id = cj.company_id
  WHERE cj.is_active = true
    AND cj.is_suspected_spam = false
    AND CASE
          WHEN p_remote_preference THEN cj.location_type = 'remote'
          WHEN p_location IS NOT NULL THEN
            cj.normalized_location ILIKE '%' || p_location || '%' OR cj.location_type = 'remote'
          ELSE true
        END
  ORDER BY match_score DESC
  LIMIT p_limit;
END;
$$;

-- ── 7. SKILL GRAPH TABLES ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.skill_ontology (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  term            TEXT    NOT NULL,
  normalized_term TEXT    NOT NULL UNIQUE,
  domain          TEXT    NOT NULL,
  synonyms        TEXT[]  DEFAULT '{}',
  weight          NUMERIC NOT NULL DEFAULT 1.0,
  source          TEXT    NOT NULL DEFAULT 'seed',
  first_seen_at   TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at    TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ontology_domain ON public.skill_ontology (domain);
CREATE INDEX IF NOT EXISTS idx_ontology_weight ON public.skill_ontology (weight DESC);

CREATE TABLE IF NOT EXISTS public.candidate_skills (
  id                  UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  term                TEXT  NOT NULL UNIQUE,
  frequency           INT   NOT NULL DEFAULT 1,
  growth_rate         NUMERIC DEFAULT 0,
  co_occurring_skills TEXT[] DEFAULT '{}',
  contexts            TEXT[] DEFAULT '{}',
  status              TEXT  NOT NULL DEFAULT 'pending',
  probable_domain     TEXT,
  llm_validated       BOOLEAN DEFAULT false,
  llm_domain          TEXT,
  llm_synonyms        TEXT[] DEFAULT '{}',
  first_seen_at       TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at        TIMESTAMPTZ DEFAULT NOW(),
  promoted_at         TIMESTAMPTZ,
  CONSTRAINT candidate_skill_status CHECK (status IN ('pending','promoted','rejected'))
);

CREATE INDEX IF NOT EXISTS idx_candidate_status ON public.candidate_skills (status);
CREATE INDEX IF NOT EXISTS idx_candidate_freq   ON public.candidate_skills (frequency DESC);

CREATE TABLE IF NOT EXISTS public.skill_cooccurrence (
  skill_a      TEXT    NOT NULL,
  skill_b      TEXT    NOT NULL,
  co_count     INT     NOT NULL DEFAULT 1,
  weight       NUMERIC NOT NULL DEFAULT 1.0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY  (skill_a, skill_b),
  CONSTRAINT   cooccur_order CHECK (skill_a < skill_b)
);

CREATE INDEX IF NOT EXISTS idx_cooccur_a ON public.skill_cooccurrence (skill_a);
CREATE INDEX IF NOT EXISTS idx_cooccur_b ON public.skill_cooccurrence (skill_b);

-- ── 8. OBSERVABILITY VIEW ───────────────────────────────────
CREATE OR REPLACE VIEW public.pipeline_observability AS
SELECT
  (SELECT COUNT(*) FROM public.raw_job_documents WHERE parse_status = 'parsed')    AS docs_parsed,
  (SELECT COUNT(*) FROM public.raw_job_documents WHERE parse_status = 'failed')    AS docs_failed,
  (SELECT COUNT(*) FROM public.raw_job_documents WHERE parse_status = 'pending')   AS docs_pending,
  (SELECT COUNT(*) FROM public.raw_job_documents WHERE parse_status = 'retry')     AS docs_retry,
  (SELECT COUNT(*) FROM public.canonical_jobs WHERE is_suspected_spam = true)      AS spam_count,
  (SELECT COUNT(*) FROM public.canonical_jobs WHERE is_active = false)             AS expired_jobs,
  (SELECT COUNT(*) FROM public.canonical_jobs WHERE is_active = true)              AS active_jobs,
  (SELECT COUNT(*) FROM public.canonical_jobs WHERE expiration_estimate IS NULL)   AS no_expiry,
  (SELECT COUNT(*) FROM public.canonical_jobs WHERE raw_document_id IS NULL)       AS orphaned_canonicals,
  (SELECT COUNT(*) FROM public.job_features WHERE skill_embedding IS NOT NULL)     AS jobs_with_embeddings,
  (SELECT COUNT(*) FROM public.canonical_jobs WHERE cardinality(skills) > 0)       AS jobs_with_skills,
  (SELECT COUNT(*) FROM public.candidate_skills WHERE status = 'pending')          AS candidate_skills_pending,
  (SELECT COUNT(*) FROM public.candidate_skills WHERE status = 'promoted')         AS candidate_skills_promoted,
  (SELECT COUNT(*) FROM public.skill_ontology)                                     AS ontology_term_count,
  (SELECT COUNT(*) FROM public.raw_job_documents WHERE failure_class = 'TIMEOUT')  AS failures_timeout,
  (SELECT COUNT(*) FROM public.raw_job_documents WHERE failure_class = 'LLM_FAILED') AS failures_llm,
  (SELECT COUNT(*) FROM public.raw_job_documents WHERE failure_class = 'SHALLOW_CONTENT') AS failures_shallow,
  NOW() AS computed_at;

-- ── 9. INVARIANT GUARD ──────────────────────────────────────
-- Detect docs stuck in processing loop (should always return 0 rows)
CREATE OR REPLACE FUNCTION public.get_parse_loop_risk()
RETURNS TABLE(doc_id UUID, attempts INT, status TEXT, last_parsed TIMESTAMPTZ)
LANGUAGE sql STABLE AS $$
  SELECT id, parse_attempts, parse_status, last_parsed_at
  FROM   public.raw_job_documents
  WHERE  parse_attempts >= 3 AND parse_status NOT IN ('failed','parsed','skipped')
  ORDER  BY parse_attempts DESC LIMIT 100;
$$;
