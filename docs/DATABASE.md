# Database System
> Provider: Supabase PostgreSQL (Project: `ssuknybhzcuusjardsve`)
> Extensions: `pgvector`, `pg_cron`, `uuid-ossp`
> Last Updated: 2026-03-26 (Omni-US Audit)


---

## Overview
The database has **100+ tables** organized into 8 functional domains. Row-Level Security (RLS) is enabled on all user-facing tables.

---

## Domain 1: Job Ingestion & Indexing

### `job_pointers` *(Primary job table — 76,685 rows)*
The canonical table for all ingested job postings. Every scraper writes here.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | Primary key |
| `fingerprint` | TEXT | SHA-256 dedup hash (`company+title+location`) |
| `company_id` | UUID FK → companies | Linked company reference |
| `company_name` | TEXT | Direct company name (denormalized for fast reads) |
| `title` | TEXT | Job title as scraped |
| `role_category` | TEXT | Normalized role: `frontend`, `backend`, `ml`, etc. |
| `seniority_band` | TEXT | `intern`, `junior`, `mid`, `senior`, `staff`, `lead`, `principal`, `manager` |
| `location_type` | TEXT | `remote`, `hybrid`, `onsite` |
| `location_id` | INT | Location foreign key |
| `location_name` | TEXT | Human-readable location string |
| `state_code` | TEXT | US state code |
| `source_url` | TEXT | Original job posting URL |
| `source_type` | TEXT | Source platform (e.g., `WEWORKREMOTELY`, `JOOBLE`) |
| `first_seen_at` | TIMESTAMPTZ | Initial discovery timestamp |
| `last_verified_at` | TIMESTAMPTZ | Last time source URL was confirmed alive |
| `expires_at` | TIMESTAMPTZ | Automatic expiry (when detected as closed) |
| `confidence_tier` | TEXT | `high`, `medium`, `low` |
| `quality_score` | FLOAT | 0.0–1.0 quality signal (title + company + location + URL) |
| `discovery_method` | TEXT | `TECH_SCRAPE`, `BOARD_SCRAPE`, `SCOUT_*` |
| `validation_status` | TEXT | `UNVERIFIED`, `VERIFIED`, `EXPIRED` |
| `salary_min` / `salary_max` | INT | Raw salary range |
| `salary_low` / `salary_high` | INT | Enriched salary (from enrichment pipeline) |
| `salary_currency` | TEXT | Currency code |
| `salary_raw` | TEXT | Original salary string |
| `required_skills` | TEXT[] | Extracted required skills |
| `preferred_skills` | TEXT[] | Extracted preferred skills |
| `tech_stack` | TEXT[] | Technology stack |
| `years_required` | INT | Minimum experience years |
| `company_size` | TEXT | Company size category |
| `company_growth_rate` | NUMERIC | Growth signal |
| `hiring_urgency_score` | INT | 0–100 urgency signal |
| `competition_score` | INT | 0–100 estimated applicant competition |
| `referral_likelihood_score` | INT | Referral availability signal |
| `enrichment_status` | TEXT | `pending`, `complete` |
| `raw_payload` | JSONB | Full raw response from source |
| `is_direct_ats` | BOOLEAN | Posted directly on ATS (higher quality) |
| `is_direct_company` | BOOLEAN | Posted on company's own domain |
| `application_endpoint` | TEXT | Direct application URL |
| `ats_provider` | TEXT | ATS system: `greenhouse`, `lever`, `workday`, etc. |
| `canonical_id` | UUID | Deduplicated canonical pointer |
| `request_id` | UUID | Ingestion run ID |
| `created_at` | TIMESTAMPTZ | Row creation time |
| `updated_at` | TIMESTAMPTZ | Last modification time |
| `posting_age_days`| INT | Computed age since discovery (used for ranking) |
| `is_suspected_spam` | BOOLEAN | Tagged by agency spam detector |
| `spam_score` | FLOAT | Agency pattern matching score |
| `last_seen_at` | TIMESTAMPTZ | Latest heartbeat from pointer |
| `location_type` | TEXT | Enriched: `remote`, `onsite`, `hybrid` |

**Indexes:**
```sql
idx_job_pointers_salary_low         ON salary_low
idx_job_pointers_competition_score  ON competition_score
idx_job_pointers_hiring_urgency_score ON hiring_urgency_score
idx_job_pointers_enrichment_status  ON enrichment_status
idx_job_pointers_required_skills_gin GIN(required_skills)
idx_job_pointers_tech_stack_gin     GIN(tech_stack)
```

### `discovery_buffer` *(raw staging area)*
Raw unprocessed scramble waiting for parsing. Fully hardened state machine.
- `validation_status` constraint explicitly locks to: `'PENDING'`, `'PROCESSING'`, `'PERSISTED'`, `'REJECTED'`.
- `updated_at` timestamp ensures orphaned `'PROCESSING'` bounds are reclaimed safely after 30 mins.
- `pipeline_janitor` deletes persisted/rejected rows strictly after 3 days.

### `raw_job_documents` *(raw HTML payload archive)*
- `parse_status` constraint explicitly locks to: `'pending'`, `'parsed'`, `'failed'`, `'dead_letter'`, `'retry'`, `null`.
- `pipeline_janitor` sweeps parsed jobs out 7 days post-parsing, and failed jobs 14 days later.
- Partial indexes on `parse_status='pending'` ensure `<1ms` lookup limits.

### `quarantine_jobs`
Jobs that failed quality checks and are held for manual review.

### `job_features` *(ML enrichment layer)*
Features extracted deterministically and by LLM: `role_category`, `experience_level`, `location_type`, `skills_hash`, `top_skills` (JSONB), `tech_stack` (JSONB), `skill_count`, `skill_rarity_score`, `hiring_signal`, `has_high_value_skill`, `skill_embedding` (VECTOR(768)).

### `job_ingestion_logs`
Per-job ingestion event log with error details.

### `ingestion_logs`
Per-run ingestion metadata: function name, timestamps, counts.

### `ingestion_queue`
Queue table for pending ingestion commands.

### `discovery_runs`
One row per scraper execution with: `source`, `jobs_found`, `jobs_new`, `jobs_updated`, `started_at`, `completed_at`.

### `source_reliability` / `source_reliability_v2`
Tracks per-source success rates, total jobs found, last success time.

### `system_checkpoints` *(State Sharding Manager)*
Used by `discovery-orchestrator` to maintain 100% US coverage without timeouts.
- `key`: E.g., `'state_index'`.
- `value`: Current index in the 50-state array.
- **Proof**: Verified in [discovery-orchestrator/index.ts](file:///c:/Users/hprad/OneDrive/Desktop/hiremax/supabase/functions/discovery-orchestrator/index.ts).

### `job_scout_configs` *(Google Scout rotation manager)*
Manages rotating search queries (role + location) for `google-linkedin-scout`.
- `role_title`: The job title to search for (e.g., "Frontend Engineer").
- `geo_location`: The location to search in (e.g., "San Francisco, CA").
- `last_scanned_at`: Timestamp used for rotation logic (least recently scanned first).
- `is_active`: Boolean toggle to enable/disable specific query pairs.


---

## Domain 2: Companies

### `companies` *(21 columns)*
| Key Columns | Description |
|------------|-------------|
| `id` | UUID PK |
| `name` | Company name |
| `domain` | Company domain |
| `employee_count` | Headcount |
| `funding_stage` | Series A, B, etc. |
| `credibility_score` | Computed trust score (0–1) |
| `is_verified` | Domain verification flag |

### `company_health_signals`
Growth signals: `recent_layoff_flag`, `company_growth_rate`, hiring velocity.

### `company_momentum`
Trend data for company hiring patterns.

### `ats_company_registry`
Maps companies to their primary ATS platform and scrape targets.

---

## Domain 3: Candidate Intelligence

### `profiles` *(Primary user record)*
| Column | Type |
|--------|------|
| `id` | UUID FK → auth.users |
| `email` | TEXT |
| `full_name` | TEXT |
| `plan` | TEXT (`Starter`, `Market Verdict`, `Career Pro`, `Career Elite`, `Automation`) |
| `credits` | INT |
| `domain` | TEXT (`SWE`, `DATA_ML`, `DEVOPS_SRE`, etc.) |
| `resume_profiles` | JSONB (array of saved resumes) |
| `connected_providers` | TEXT[] |
| `metadata` | JSONB (daily limits, application counts) |

### `profile_snapshots`
Versioned snapshot of candidate profile for point-in-time scoring. Contains `snapshot_data` JSONB with skills, work history, signal health.

### `ml_candidate_embeddings` *(13 columns)*
Vector embedding of candidate profile for semantic matching.
| Column | Type |
|--------|------|
| `user_id` | UUID PK FK → auth.users |
| `embedding` | VECTOR(1536) |
| `confidence_score` | FLOAT |
| `is_anchored` | BOOLEAN |
| `anomaly_score` | FLOAT |
| `verified_skills` | TEXT[] |
| `channel_coherence_score` | FLOAT |

### `candidate_feature_vectors`
ML feature scores extracted from profile: `system_design_depth`, `distributed_systems_experience`, `machine_learning_experience`, `seniority_score`, `technical_depth`, `domain_expertise`, `capability_vector VECTOR(5)`.

### `career_work_history`, `career_skills`, `career_education`, `career_projects`, `career_publications`, `career_oss_contributions`, `career_achievements`
Structured career data tables populated via OAuth integrations (LinkedIn, GitHub, etc.).

---

## Domain 4: Analysis & Intelligence

### `analyses`
Stores completed resume diagnostic results.
| Column | Type |
|--------|------|
| `id` | UUID PK |
| `user_id` | UUID FK |
| `results_json` | JSONB |
| `created_at` | TIMESTAMPTZ |

### `market_snapshots`
Stores Gemini-generated market command projections (expire after 7 days).

### `market_signals`
Aggregated market intelligence: `job_count_30d`, `hiring_velocity`, `scarcity_index`, `timing_signal`, `repost_factor`.

### `market_demand_signals`, `market_supply_signals`, `market_equilibrium`, `market_signal_history`
Time-series market intelligence tables.

### `skill_ontology`, `candidate_skills`, `skill_cooccurrence`
The three-mode self-evolving Skill Graph system. `candidate_skills` logs unknown term occurrences from job parsings. Mode B promotes them to `skill_ontology` when statistically significant. `skill_cooccurrence` measures domain closeness.

---

## Domain 5: Application Execution

### `execution_runs`
One row per application batch execution.
| Column | Type |
|--------|------|
| `id` | UUID PK |
| `user_id` | UUID FK |
| `target_role` | TEXT |
| `status` | TEXT (`pending`, `running`, `completed`, `failed`) |
| `error_reason` | TEXT |
| `created_at` | TIMESTAMPTZ |
| `completed_at` | TIMESTAMPTZ |

### `execution_targets`
Individual job applications within a run.

### `execution_logs`
Step-by-step log entries for an execution run.

### `execution_audits`
Post-execution audit records with field-level detail.

### `applications`
Core application tracking table (17 columns).

### `application_executions`
Detailed ATS execution records.

### `application_timeline`
Timeline events for each application.

---

## Domain 6: ML / Scoring Infrastructure

### `scoring_weight_sets`
Stores the `β₀–β₅` weights for the probability model. Active set is used by `decision-engine.ts`.

### `ml_bandit_priors`
Multi-armed bandit priors for A/B testing weight configurations.

### `ml_talent_state`
Computed talent state per user: `CALIBRATING`, `STABLE`, etc.

### `ml_inference_logs`
Records every call to the decision engine with inputs and outputs.

### `hiring_decisions`
Persisted output of `computeHiringDecision()` for each job evaluation.

### `kill_zone_analyses`
Cached `KillZoneAnalysis` results (percentile, callback rate estimate, competition).

---

## Domain 7: Infrastructure

### `governor_state` *(Single-row circuit breaker)*
| Column | Description |
|--------|-------------|
| `current_mode` | `CONTROLLED`, `READ_ONLY`, `SAFE` |
| `scrape_success_rate` | Rolling success average (currently: 0.5) |
| `last_updated` | Timestamp of last mode change |

### `integrity_events`
All runtime errors logged by `Guardrails.handleError()`.

### `ingestion_sessions`, `ingestion_commands`, `ingestion_metrics`
Pipeline session management tables.

### `user_clusters`
Geographic location clusters: `US-WEST`, `US-EAST`, `US-CENTRAL`, `US-REMOTE`, `US-OTHER`.

### `dom_knowledge_base`
ATS-specific field patterns learned by the extension's field classifier.

---

## Stored Procedures & Crons (Public Schema)

| Function | Purpose |
|----------|---------|
| `match_jobs_v4()` | Primary job retrieval RPC — returns scored jobs with rich metadata (salary, age, vector) |
| `bulk_resolve_pointers_v4()` | **Proof of Hardening**: Unnests job arrays for atomic, connection-leak-proof insertion. |
| `purge_stale_data_v2()` | **Safety Proof**: Deletes non-bookmarked jobs < 48h old to maintain storage health. |
| `purge_raw_blobs_v1()` | Deletes 50KB raw documents after parsing to save 90% storage space. |
| `drain_discovery_buffer()` | Thread-safe `FOR UPDATE SKIP LOCKED` fetch; reclaims `PROCESSING` locks > 30m |
| `master_pipeline_tick()` | Primary 15-Minute Orchestrator triggering safe Edge bounds |
| `orchestrator_pulse_2h` | **Omni-US Cron**: Triggers 5-state sharding rotation every 2 hours. |


---

## Health Checks & Dashboards

### `pipeline_observability`
The comprehensive single source of truth for execution states.
Includes `docs_parsed`, `docs_failed`, `docs_pending`, `docs_retry`, `spam_count`, `expired_jobs`, `active_jobs`, `no_expiry`, `orphaned_canonicals`, `jobs_with_embeddings`, `candidate_skills_pending`, `candidate_skills_promoted`, `ontology_term_count`, `failures_timeout`, `failures_llm`, `failures_shallow`.

| Other Metrics | SQL |
|-------|-----|
| Job ingestion rate (7d) | `SELECT count(*) FROM job_pointers WHERE created_at > now() - interval '7 days'` |
| Null company rate | `SELECT count(*) FROM job_pointers WHERE company_name IS NULL` |
| Quality score distribution | `SELECT avg(quality_score), min(quality_score) FROM job_pointers` |
| Governor mode | `SELECT current_mode, scrape_success_rate FROM governor_state` |
| Embedding coverage | `SELECT count(*) FROM ml_candidate_embeddings WHERE embedding IS NOT NULL` |

---

## Current Weaknesses

1. **Company data sparsity** — company lookup insertion remains attempt-and-ignore.
2. **Hardcoded auth key in background.js** — `SUPABASE_ANON_KEY` is embedded in extension source code.
