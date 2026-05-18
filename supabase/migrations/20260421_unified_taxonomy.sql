-- ════════════════════════════════════════════════════════════════════════════
-- supabase/migrations/20260421_unified_taxonomy.sql
-- Unified Taxonomy Migration — V5.1
--
-- CHANGE FROM V5.0:
--   CREATE INDEX CONCURRENTLY removed everywhere.
--   Supabase migrations run inside an implicit transaction block.
--   CONCURRENTLY cannot run inside a transaction — it would fail with:
--     ERROR 25001: CREATE INDEX CONCURRENTLY cannot run inside a transaction block
--
-- BUG FIX vs user-provided draft:
--   Section 5 had: UPDATE job_pointers SET role_category = 'manager'
--   'manager' is NOT in role_category_enum — it lives in seniority_band_enum.
--   Management roles are classified via seniority_band, NOT role_category.
--   Fixed to: UPDATE job_pointers SET role_category = 'other'
--
-- TYPE RECONCILIATION:
--   role_category enum:
--     Added: sre, ml, systems, tpm
--     Removed: ml_ai, qa, management
--     Kept: backend, frontend, fullstack, mobile, devops, data, security,
--           product, design, embedded, blockchain, other
--   seniority_band enum:
--     Added: lead, manager, unknown
--     Removed: c_level, vp, director
--     Kept: intern, junior, mid, senior, staff, principal
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Role Category Enum ──────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_category_enum') THEN
    CREATE TYPE role_category_enum AS ENUM (
      'backend', 'frontend', 'fullstack', 'mobile',
      'devops', 'sre', 'ml', 'data',
      'security', 'product', 'design', 'systems',
      'embedded', 'blockchain', 'tpm', 'other'
    );
  ELSE
    -- Idempotent additions for any values not yet present
    BEGIN ALTER TYPE role_category_enum ADD VALUE IF NOT EXISTS 'mobile';     EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE role_category_enum ADD VALUE IF NOT EXISTS 'sre';        EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE role_category_enum ADD VALUE IF NOT EXISTS 'ml';         EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE role_category_enum ADD VALUE IF NOT EXISTS 'systems';    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE role_category_enum ADD VALUE IF NOT EXISTS 'embedded';   EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE role_category_enum ADD VALUE IF NOT EXISTS 'blockchain'; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE role_category_enum ADD VALUE IF NOT EXISTS 'tpm';        EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE role_category_enum ADD VALUE IF NOT EXISTS 'security';   EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END$$;

-- ── 2. Seniority Band Enum ─────────────────────────────────────────────────
--
-- Matches taxonomy.ts: intern | junior | mid | senior | staff | principal | lead | manager | unknown

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'seniority_band_enum') THEN
    CREATE TYPE seniority_band_enum AS ENUM (
      'intern', 'junior', 'mid', 'senior',
      'staff', 'principal', 'lead', 'manager', 'unknown'
    );
  ELSE
    BEGIN ALTER TYPE seniority_band_enum ADD VALUE IF NOT EXISTS 'lead';    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE seniority_band_enum ADD VALUE IF NOT EXISTS 'manager'; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE seniority_band_enum ADD VALUE IF NOT EXISTS 'unknown'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END$$;

-- ── 3. Industry Vertical Enum ──────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'industry_vertical_enum') THEN
    CREATE TYPE industry_vertical_enum AS ENUM (
      'ai_ml', 'developer_tools', 'data_infra', 'cybersecurity', 'cloud_infra',
      'fintech', 'healthtech', 'edtech', 'legaltech', 'proptech', 'govtech', 'climate',
      'enterprise_saas', 'consumer', 'ecommerce', 'marketplace', 'other'
    );
  END IF;
END$$;

-- ── 4. job_pointers column additions ──────────────────────────────────────

ALTER TABLE job_pointers
  ADD COLUMN IF NOT EXISTS industry       industry_vertical_enum DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS other_metadata JSONB,
  ADD COLUMN IF NOT EXISTS enriched_at    TIMESTAMPTZ;

-- ── 5. Migrate legacy role_category text values → canonical enum values ────
--
-- BUG FIX: Management roles → 'other' NOT 'manager'.
-- 'manager' is a seniority_band value. There is no 'manager' in role_category_enum.
-- Management seniority is already captured in the seniority_band column.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name  = 'job_pointers'
      AND column_name = 'role_category'
      AND data_type   = 'text'
  ) THEN
    -- Taxonomy renames
    UPDATE job_pointers SET role_category = 'ml'
      WHERE role_category IN ('ml_ai', 'Data & AI', 'data & ai', 'data_ai', 'ai', 'AI');
    UPDATE job_pointers SET role_category = 'devops'
      WHERE role_category IN ('devops/sre', 'platform', 'cloud');
    UPDATE job_pointers SET role_category = 'sre'
      WHERE role_category IN ('site reliability', 'site_reliability');
    -- FIX: 'management' roles have no role_category equivalent → 'other'
    -- Their seniority identity lives in seniority_band = 'manager'
    UPDATE job_pointers SET role_category = 'other'
      WHERE role_category IN ('management', 'Management', 'leadership', 'engineering_manager');
    -- Old IntelligenceEngine free-form labels
    UPDATE job_pointers SET role_category = 'backend'
      WHERE role_category IN ('software engineering', 'Software Engineering', 'engineering');
    -- qa roles → systems (QA/SDET now classified under systems engineering)
    UPDATE job_pointers SET role_category = 'systems'
      WHERE role_category IN ('qa', 'QA', 'quality assurance', 'quality_assurance');
    -- Catch-all: anything not in the canonical set → 'other'
    UPDATE job_pointers SET role_category = 'other'
      WHERE role_category IS NULL
        OR role_category NOT IN (
          'backend','frontend','fullstack','mobile','devops','sre','ml','data',
          'security','product','design','systems','embedded','blockchain','tpm','other'
        );
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name  = 'job_pointers'
      AND column_name = 'seniority_band'
      AND data_type   = 'text'
  ) THEN
    -- Consolidate removed bands → 'manager'
    UPDATE job_pointers SET seniority_band = 'manager'
      WHERE seniority_band IN ('c_level', 'vp', 'director', 'C-Level', 'VP', 'Director');
    UPDATE job_pointers SET seniority_band = 'lead'
      WHERE seniority_band IN ('tech_lead', 'tech lead', 'technical lead');
    -- Normalise caps variants
    UPDATE job_pointers SET seniority_band = 'senior'
      WHERE seniority_band IN ('Senior', 'SENIOR', 'sr');
    UPDATE job_pointers SET seniority_band = 'mid'
      WHERE seniority_band IN ('Mid-Level', 'mid-level', 'mid_level', 'Mid', 'MID');
    UPDATE job_pointers SET seniority_band = 'junior'
      WHERE seniority_band IN ('Junior', 'JUNIOR', 'jr', 'Entry Level', 'entry-level', 'new_grad');
    -- Catch-all: anything unrecognised → 'unknown'
    UPDATE job_pointers SET seniority_band = 'unknown'
      WHERE seniority_band IS NULL
        OR seniority_band NOT IN (
          'intern','junior','mid','senior','staff','principal','lead','manager','unknown'
        );
  END IF;
END$$;

-- ── 6. Indexes ─────────────────────────────────────────────────────────────
-- No CONCURRENTLY — migration runs in a transaction block.

CREATE INDEX IF NOT EXISTS idx_job_pointers_role_category
  ON job_pointers(role_category) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_job_pointers_seniority_band
  ON job_pointers(seniority_band) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_job_pointers_industry
  ON job_pointers(industry) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_job_pointers_enriched
  ON job_pointers(enriched) WHERE enriched = false AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_job_pointers_taxonomy_quality
  ON job_pointers(role_category, seniority_band, quality_score DESC)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_job_pointers_other_metadata
  ON job_pointers USING GIN (other_metadata)
  WHERE other_metadata IS NOT NULL;

-- ── 7. Cursors table + RPCs ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cursors (
  source             TEXT        PRIMARY KEY,
  current_offset     BIGINT      NOT NULL DEFAULT 0,
  is_paused          BOOLEAN     NOT NULL DEFAULT false,
  consecutive_errors INT         NOT NULL DEFAULT 0,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION read_cursor(p_source TEXT)
RETURNS TABLE(current_offset BIGINT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
    SELECT c.current_offset FROM cursors c WHERE c.source = p_source;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::BIGINT;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION atomic_advance_cursor(p_source TEXT, p_increment BIGINT)
RETURNS TABLE(old_offset BIGINT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_old BIGINT;
BEGIN
  INSERT INTO cursors(source, current_offset, updated_at)
  VALUES (p_source, p_increment, NOW())
  ON CONFLICT (source) DO UPDATE
    SET current_offset = cursors.current_offset + EXCLUDED.current_offset,
        updated_at     = NOW()
  RETURNING cursors.current_offset - p_increment INTO v_old;
  RETURN QUERY SELECT COALESCE(v_old, 0);
END;
$$;

CREATE OR REPLACE FUNCTION atomic_reset_cursor_if_eq(
  p_source TEXT, p_expected_offset BIGINT
)
RETURNS TABLE(reset BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_rows INT;
BEGIN
  UPDATE cursors
  SET    current_offset = 0, updated_at = NOW()
  WHERE  source = p_source AND current_offset = p_expected_offset;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN QUERY SELECT (v_rows > 0);
END;
$$;

-- ── 8. Advisory Lock RPCs ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS advisory_locks (
  lock_name   TEXT        PRIMARY KEY,
  owner_id    TEXT        NOT NULL,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL
);

CREATE OR REPLACE FUNCTION acquire_lock(
  p_lock_name TEXT, p_owner_id TEXT, p_ttl_seconds INT DEFAULT 90
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM advisory_locks WHERE expires_at < NOW();
  BEGIN
    INSERT INTO advisory_locks(lock_name, owner_id, expires_at)
    VALUES (p_lock_name, p_owner_id, NOW() + (p_ttl_seconds || ' seconds')::INTERVAL);
    RETURN true;
  EXCEPTION WHEN unique_violation THEN
    RETURN false;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION release_lock(p_lock_name TEXT, p_owner_id TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM advisory_locks WHERE lock_name = p_lock_name AND owner_id = p_owner_id;
END;
$$;

CREATE OR REPLACE FUNCTION refresh_lock(
  p_lock_name TEXT, p_owner_id TEXT, p_ttl_seconds INT DEFAULT 90
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_rows INT;
BEGIN
  UPDATE advisory_locks
  SET    expires_at = NOW() + (p_ttl_seconds || ' seconds')::INTERVAL
  WHERE  lock_name = p_lock_name AND owner_id = p_owner_id AND expires_at > NOW();
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN (v_rows > 0);
END;
$$;

-- ── 9. Supporting tables ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS source_health (
  source             TEXT        NOT NULL,
  run_date           DATE        NOT NULL,
  http_status        INT,
  response_time_ms   INT,
  error_message      TEXT,
  consecutive_errors INT         NOT NULL DEFAULT 0,
  raw_fetched        INT         NOT NULL DEFAULT 0,
  usable_stored      INT         NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source, run_date)
);

CREATE INDEX IF NOT EXISTS idx_source_health_source
  ON source_health(source, run_date DESC);

CREATE TABLE IF NOT EXISTS source_reliability (
  source_name             TEXT        PRIMARY KEY,
  duplicate_rate_last_run FLOAT       NOT NULL DEFAULT 0,
  avg_duplicate_rate      FLOAT       NOT NULL DEFAULT 0,
  last_insert_count       INT         NOT NULL DEFAULT 0,
  last_run_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
