# System Weakness Register
> Maintained By: Engineering Team
> Last Updated: 2026-03-11
> Status: Living document — update after every production incident or architectural decision

---

## How to Use This Document

Every weakness listed here has three components:
1. **Impact** — what breaks if this isn't fixed
2. **Current state** — what exists now to mitigate
3. **Fix** — the correct remediation

---

## Infrastructure Weaknesses

### W-01: Job Embeddings Missing on `job_pointers`
**Severity: CRITICAL**
**Impact:** Domain 3 (Recruiter Surface) of the probability model defaults to keyword overlap. Semantic matching is disabled. The system cannot distinguish "wrote distributed systems code" from "listed Python on a resume."
**Current State:** `vector_similarity` is hardcoded to `0.5` (neutral) in `match_jobs_v3`. All jobs show equal baseline semantic relevance.
**Fix:** Add `embedding VECTOR(1536)` column to `job_pointers`. Embed job title + description during ingestion using the same Gemini model used for resumes. Add HNSW index. Enable cosine similarity in `match_jobs_v3`.

### W-02: `discovery_buffer` Backlog
**Severity: HIGH**
**Impact:** 169,593 raw records sit unprocessed. These are jobs that scrapers found but never promoted to `job_pointers`. The ranking engine cannot see them.
**Current State:** `discovery-buffer-processor` function exists but is not on a cron schedule.
**Fix:** Add `discovery-buffer-processor` to `pg_cron` schedule. Run every 15 minutes to drain the buffer.

### W-03: `candidate_feature_vectors` Sparsity
**Severity: HIGH**
**Impact:** For users without a populated `candidate_feature_vectors` row, all Domain 1 sub-signals (`impact_density`, `ownership_markers`, `architecture_scope`) default to `0.4`. All users appear equally qualified to the scoring model.
**Current State:** `extract-candidate-features` must be explicitly called; not auto-triggered on profile update.
**Fix:** Trigger `extract-candidate-features` automatically after every resume upload or profile update.

---

## Data Quality Weaknesses

### W-04: Company Name Collisions
**Severity: MEDIUM**
**Impact:** `"Google"`, `"Google Inc."`, `"Google LLC"` create 3 separate company rows in `companies`. Credibility scores and health signals are fragmented.
**Current State:** Company lookup uses `ILIKE` without normalization.
**Fix:** Normalize company names to a canonical form (strip legal suffixes, lowercase) before lookup. Add a `name_normalized` column with a unique index.

### W-05: Company Insert Race Condition
**Severity: MEDIUM**
**Impact:** Concurrent scraper runs can both attempt to insert the same company, causing one to fail. The failed insert returns `null` for `company_id`, which propagates to `job_pointers`.
**Current State:** `maybeSingle()` + `INSERT` pattern mitigates most cases but not parallel concurrent runs.
**Fix:** Use `INSERT ... ON CONFLICT (name_normalized) DO NOTHING RETURNING id` and then fetch the existing row if insert fails.

### W-06: No Salary Data on Most Jobs
**Severity: MEDIUM**
**Impact:** The `salary_min/max` filtering in the frontend cannot work effectively. Users can't filter by salary range.
**Current State:** Salary is only populated by `job-enrichment-agent`, which has limited throughput.
**Fix:** Parse salary from job description during initial scrape using regex patterns. Add to `tech-board-scraper` and `job-board-scraper` before the insert.

### W-07: `required_skills` Empty on Most Rows
**Severity: MEDIUM**
**Impact:** Skill overlap matching in `match_jobs_v3` returns 0 for most jobs. Domain 3 keyword overlap falls back to empty-set comparison.
**Current State:** Skills populated only by enrichment agent (slow, low coverage).
**Fix:** Extract skills from job title during scraping using a curated keyword list. Store in `required_skills[]`. Full NLP extraction can come later via enrichment.

---

## Architectural Weaknesses

### W-08: `jobs` Table Missing
**Severity: RESOLVED** (2026-03-11)
`match_jobs_v3` was previously pointing to `public.jobs` which didn't exist. Remapped to `job_pointers`. Confirmed working.

### W-09: Config.toml Duplicate Entry
**Severity: RESOLVED** (2026-03-11)
Duplicate `[functions.materialize-job]` in `config.toml` was blocking all CLI deploys. Fixed.

### W-10: No Alerting Infrastructure
**Severity: HIGH**
**Impact:** System failures go undetected until users report them. The governor state, ingestion rate, and error rate are only visible via manual SQL queries.
**Current State:** `integrity_events` table exists but nothing reads it.
**Fix:** Add a `governor-reporter` scheduled function that reads `discovery_runs`, `integrity_events`, and sends a Slack webhook if any threshold is breached.

### W-11: Polling Instead of Realtime
**Severity: LOW**
**Impact:** `App.tsx` polling every 15 seconds for execution run status creates unnecessary DB load at scale. With many concurrent users, this creates thundering herd queries.
**Current State:** Interval-based polling.
**Fix:** Switch to Supabase Realtime subscription on `execution_runs` table for `user_id = $current_user`.

### W-12: Single User Embedding per Profile
**Severity: MEDIUM**
**Impact:** Users targeting multiple roles (e.g., "Backend SWE" and "ML Engineer") share one embedding vector. The ranking engine serves the same jobs regardless of which role the user is browsing.
**Current State:** `ml_candidate_embeddings` is keyed by `user_id` only.
**Fix:** Key by `(user_id, resume_profile_id)`. Support one embedding per saved resume profile.

---

## Security Weaknesses

### W-13: Anon Key in Extension Source Code
**Severity: LOW** (by design — anon key is public)
**Impact:** Anyone who decompiles the extension binary sees the Supabase anon key. This is the intended use of anon keys but creates confusion about secret management.
**Current State:** `SUPABASE_ANON_KEY` hardcoded in `background.js`.
**Fix:** Acceptable as-is per Supabase design. Document that this is intentional. Ensure RLS policies are correctly applied to prevent privilege escalation via anon key.

### W-14: Production Domain Not in `externally_connectable`
**Severity: HIGH** (before app store release)
**Impact:** The web app's production domain cannot send `AUTH_HANDOFF` to the extension. Auth will silently fail in production.
**Current State:** Only `localhost:3000` and `localhost:5173` listed.
**Fix:** Add production domain (e.g., `https://hiremax.app/*`) to `manifest.json externally_connectable.matches`.

---

## Performance Weaknesses

### W-15: No EXPLAIN ANALYZE at Production Scale
**Severity: MEDIUM**
**Impact:** `match_jobs_v3` behavior at 76k+ rows with multiple JOINs is untested under concurrent load.
**Current State:** No query performance baseline exists.
**Fix:** Run `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM match_jobs_v3(...)` with production-representative inputs. Add indexes if sequential scans appear.

### W-16: Scraper Runs All Sources in Parallel Without Rate Limiting
**Severity: MEDIUM**
**Impact:** On each orchestrator trigger, all scrapers fire simultaneously and each makes many parallel API calls. This risks hitting rate limits on external APIs (Jooble, Careerjet, etc.) and creating database connection spikes.
**Current State:** `Promise.allSettled()` with no concurrency control.
**Fix:** Add per-source delay jitter. Implement a concurrency limit using `p-limit` or equivalent.
