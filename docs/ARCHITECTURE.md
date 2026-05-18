# Architecture: HireMax System Blueprint
> Last Updated: 2026-03-26 (Full System Audit)


---

## Data Flow

### 1. Unified Job Ingestion (Omni-US Protocol)
```
pg_cron → master-intelligence-orchestrator (T1/T2/T3 Tiers)
    │
    └── T1 Pulse: discovery-orchestrator-pulse (State Sharding + Keyword Rotation)
        ├── ats-engine-ultimate (23 Concurrent Instances)
        └── google-linkedin-scout (LinkedIn SerpAPI Backdoor)
```
- **Proof**: Verified `discovery-orchestrator` fires 24 sources simultaneously via `Promise.allSettled` without delays.
- **Rotation**: 5 US States + cyclically incrementing SerpAPI Tech Keywords per run.
- **Deduplication**: SHA-256 fingerprint remains the source of truth for intersection.


**Fingerprint formula:**
```
SHA-256( lowercase(company_name + "|" + job_title + "|" + location) )
```
This prevents duplicate postings from the same role appearing from different sources.

### 2. Data Cleaning
- `normalizeRole(title)` → maps title to 8 role categories: frontend, fullstack, mobile, devops, ml, data, security, backend
- `normalizeSeniority(title)` → intern, junior, mid, senior, staff, lead, principal, manager
- `normalizeLocation(location)` → remote, hybrid, onsite
- `calculateQualityScore()` → 0.0-1.0 score, requires title + company + location + valid URL
- Jobs with `quality_score < 0.5` are excluded from `match_jobs_v3()` results

### 3. Embedding Generation (Vector-V6)
- **Job Embeddings**: Hardened v6 pipeline using **Gemini v1 REST API** (directly calling `generativelanguage.googleapis.com`).
- **Proof**: Verified [feature-worker/index.ts](file:///c:/Users/hprad/OneDrive/Desktop/hiremax/supabase/functions/feature-worker/index.ts) uses direct REST to bypass SDK versioning issues.
- **Vector Dimension**: 768 (Gemini natively) optimized for pgvector HNSW indexes.
- **Scale**: Batching is set to 2,500 jobs per run with 1s cool-downs to prevent rate-limiting.


### 4. Storage Layer (Hardened Self-Cleaning Model)
```
Raw scrape data          → discovery_buffer (TTL: 48h)
Enriched job records     → canonical_jobs (TTL: 14d)
Active Job Pointers      → job_pointers (Filtered by Gemini-v6 Quality)
```
*Note: The `purge_stale_data_v2` and `purge_raw_blobs_v1` RPCs strictly enforce 500MB bounds. User data is protected via `JOIN user_bookmarks` in all purge logic.*
- **Proof**: Verified purge RPCs in [omni_us_hardened_final.sql](file:///c:/Users/hprad/OneDrive/Desktop/hiremax/supabase/migrations/20260326_omni_us_hardened_final.sql).


### 5. Retrieval
The `match_jobs_v4()` PostgreSQL RPC is the primary retrieval mechanism:
```sql
match_jobs_v4(
    p_user_id UUID,
    p_candidate_role TEXT,
    p_candidate_skills TEXT[],
    p_candidate_experience_years INT,
    p_candidate_location TEXT,
    p_remote_preference BOOLEAN,
    p_candidate_embedding VECTOR(1536)
)
```
Returns up to 200 ranked jobs from `job_pointers` including rich metadata:
- `salary_raw`, `salary_min`, `salary_max`
- `posting_age_days`, `posted_at`
- `work_mode`, `skills`, `tech_stack`
- `vector_similarity`, `skill_overlap_ratio`, `eligibility_score`

### 6. Ranking
The `decision-engine.ts` shared library implements the 5-domain probability model:
```
P(interview) = σ(β₀ + β₁·Candidate + β₂·Market + β₃·Recruiter + β₄·Timing + β₅·EmergingSkills)
```
Weights are loaded from `scoring_weight_sets` (updated by `optimize-weights`) or fall back to hardcoded defaults. The LLM then explains the computed scores — it does NOT recompute them.

### 7. Browser Interaction
```
[Page Load] → content.js detects ATS form structure
    ↓
DOM hash + field inventory sent to background.js
    ↓
background.js calls execution-engine/evaluate-context (JWT-authenticated)
    ↓
Response: field mapping strategy + autofill values
    ↓
content.js applies fills; overlay.js renders recommendation UI
    ↓
On submit: APPLICATION_SUBMITTED event → telemetry logged
```

---

## Service Interaction Map

### Extension → API
```
background.js (MV3 Service Worker)
    │
    ├── /evaluate-context    → field classification + autofill strategy
    ├── /heartbeat           → keep execution session alive
    ├── /record-telemetry-batch → batch telemetry flush (every 30s or 10 events)
    ├── /resume/get-signed-url → JIT Supabase Storage signed URL for resume upload
    ├── /generate-rich-answers → Gemini-powered essay generation
    ├── /learn-mapping       → save manual field overrides to DB
    └── /audit/execution     → log execution outcomes
```
All calls go through `execution-engine` Edge Function at `https://ssuknybhzcuusjardsve.supabase.co/functions/v1/execution-engine`.

### Web App → API
```
App.tsx (React)
    │
    ├── supabase.functions.invoke('generate-diagnostic') → resume analysis
    ├── supabase.functions.invoke('generate-rebuild')    → resume optimization
    ├── supabase.functions.invoke('generate-outlook')    → market command
    ├── CareerIntelligenceView → hiring-engine (job matching)
    │       ├── POST /intent/resolve     → locations normalization
    │       ├── GET  /user-clustering/resolve → assign cluster
    │       └── GET  /job-pointers/by-cluster → scored job list
    └── ApplicationExecutionView → execution-engine (run management)
```

### Database → Vector Search
```
candidate_embedding (from ml_candidate_embeddings) 
    → passed into match_jobs_v3() as p_candidate_embedding
    → SQL: 1.0 - (job.embedding <=> candidate.embedding) → vector_similarity
    (Note: job embeddings not yet on job_pointers — currently uses 0.5 neutral default)
```

---

## Critical Components

| Component | File | Why Critical |
|-----------|------|-------------|
| `decision-engine.ts` | `_shared/decision-engine.ts` | The core scoring model. All ranking flows through this |
| `guardrails.ts` | `_shared/guardrails.ts` | JWT auth + governor gate for all protected endpoints |
| `match_jobs_v4` | DB migration | The RPC that bridges candidate profile to job retrieval with rich data |
| `hiring-engine` | `supabase/functions/hiring-engine/` | Orchestrates intent → cluster → jobs flow for the frontend (v40+) |
| `match-analyst` | `supabase/functions/match-analyst/` | Provides deep AI-driven match insights and reliability recovery |
| `execution-engine` | `supabase/functions/execution-engine/` | All extension API calls go through this single function |
| `governor_state` | DB table | Single-row state machine: `CONTROLLED`, `READ_ONLY`, `SAFE` |
| `background.js` | `chrome-extension/background.js` | Manages auth sessions, routes all extension messages |
| `content.js` | `chrome-extension/content.js` | ATS form detection, field classification, autofill execution |

---

## Governor / Circuit Breaker

The system has a single-row `governor_state` table that controls whether write operations are allowed:

| Mode | Behavior |
|------|----------|
| `CONTROLLED` | Normal operation — all writes permitted |
| `READ_ONLY` | Write operations blocked; reads allowed |
| `SAFE` | Everything blocked; emergency stop |

All Edge Functions that write data check this via `Guardrails.checkGovernor()` before proceeding.

---

## Current Weaknesses

1. **Company data sparsity** — many `job_pointers` rows have `company_id = NULL` because company insert is attempt-and-ignore.
2. **Hardcoded auth key in background.js** — `SUPABASE_ANON_KEY` is embedded in extension source code. This is public-facing but should be noted.
3. **Polling instead of Realtime** — `App.tsx` still uses some interval polling, though core stats now use Realtime subscriptions.
