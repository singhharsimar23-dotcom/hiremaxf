# HireMax System Map
> Complete execution flow diagrams for every major pipeline

---

## 1. Job Ingestion Pipeline

```
┌────────────────────────────────────────────────┐
│  TRIGGER: Cloudflare Cron — every 2 minutes    │
└──────────────────────┬─────────────────────────┘
                       ↓
          infra/workers/index.ts
          [Partitioned scheduler]
                       ↓
          ┌────────────────────────┐
          │  Worker Group Router   │
          │  ALPHA → ATS sources   │
          │  BETA  → Aggregators   │
          │  GAMMA → Remote boards │
          │  DELTA → Niche boards  │
          └──────────┬─────────────┘
                     ↓
     core/ingestion-engine/group_processor.ts
     [Parallel processing per group]
                     ↓
     ┌───────────────────────────────────────┐
     │  For each source in group:            │
     │                                       │
     │  1. isQuarantined()  → skip if bad    │
     │  2. checkThrottle()  → skip if busy   │
     │  3. acquireLock()    → exclusive run  │
     │  4. getCursor()      → get offset     │
     │                                       │
     │  infra/adapters/registry.ts           │
     │  → getAdapter(source)                 │
     │                                       │
     │  adapter.fetchBatch()                 │
     │  → infra/connectors/[source].ts       │
     │  → [External API HTTP call]           │
     │  → raw[] returned                     │
     │                                       │
     │  adapter.parse()                      │
     │  → core/ingestion-engine/[source].ts  │
     │  → ParsedJob[] returned               │
     │                                       │
     │  dedup_service.isDuplicate()          │
     │  → skip if fingerprint exists         │
     │                                       │
     │  core/shared/db/jobs.ts               │
     │  → upsertJob(ParsedJob)               │
     │  → Supabase PostgreSQL                │
     │                                       │
     │  updateCursor() + reportSuccess()     │
     │  releaseLock()                        │
     └───────────────────────────────────────┘
                     ↓
     ┌──────────────────────────────────────┐
     │  New jobs land in data/jobs          │
     │  with enriched=false                 │
     └──────────────────────────────────────┘
```

---

## 2. Job Enrichment Pipeline

```
┌────────────────────────────────────────────────┐
│  TRIGGER: Cloudflare Cron — every 5 minutes    │
│  OR: Triggered after ingestion batch           │
└──────────────────────┬─────────────────────────┘
                       ↓
         infra/workers/enrichment.ts
                       ↓
         Fetch jobs WHERE enriched=false
         LIMIT: 10 per run
                       ↓
         ┌─────────────────────────────┐
         │  For each unenriched job:   │
         │                             │
         │  → core/enrichment-engine   │
         │    (Groq API)               │
         │                             │
         │  Extract:                   │
         │  • Required skills []       │
         │  • Seniority level          │
         │  • Role category            │
         │  • Company stage            │
         └─────────────────────────────┘
                       ↓
         Patch job: enriched=true
         data/jobs updated
```

---

## 3. User-Job Matching Pipeline

```
┌────────────────────────────────────────────────────┐
│  TRIGGER: User updates profile OR requests matches │
└──────────────────────┬─────────────────────────────┘
                       ↓
         services/api/match (HTTP POST)
                       ↓
         core/matching-engine/index.ts
                       ↓
         ┌──────────────────────────────────┐
         │  Fetch user profile              │
         │  → data/users table              │
         │                                  │
         │  Fetch candidate jobs            │
         │  → data/jobs (enriched=true)     │
         └──────────────────────────────────┘
                       ↓
         core/scoring-engine/
         ┌──────────────────────────────────┐
         │  → Bayesian Scorer               │
         │    (skill overlap probability)   │
         │  → Ensemble Scorer               │
         │    (weighted signals)            │
         │  → Neural Scorer                 │
         │    (embedding similarity)        │
         │                                  │
         │  Output: {job_id, score, reason} │
         └──────────────────────────────────┘
                       ↓
         core/matching-engine/ranker.ts
         → Sort by composite score
         → Apply diversity filter
         → Top N results
                       ↓
         data/match_results (upsert)
                       ↓
         Return to services/api → apps/web
         [User sees ranked job list]
```

---

## 4. Market Intelligence Pipeline

```
┌─────────────────────────────────────────────┐
│  TRIGGER: Cloudflare Cron — every hour      │
└──────────────────────┬──────────────────────┘
                       ↓
   infra/workers/intelligence/index.ts
                       ↓
   core/intelligence-engine/index.ts
                       ↓
   ┌──────────────────────────────────────────────┐
   │  LAYER 01: Data Ingestion                    │
   │  → Read data/jobs (last 30 days)             │
   │  → Read data/market_signals                  │
   │                                              │
   │  LAYER 02: Normalization                     │
   │  → Standardize company names, roles          │
   │                                              │
   │  LAYER 03: Signal Extraction                 │
   │  → Identify demand spikes per skill/role     │
   │  → Hiring velocity per company               │
   │                                              │
   │  LAYER 04: Trend Detection                   │
   │  → Rolling 7/30/90 day trend lines           │
   │  → Momentum calculation                      │
   │                                              │
   │  LAYER 05: Bayesian Learning                 │
   │  → Update prior beliefs with new data        │
   │  → Recalibrate prediction confidence         │
   │                                              │
   │  LAYER 06: Causal Inference                  │
   │  → Funding → hiring correlation              │
   │  → Layoff → rehiring patterns                │
   │                                              │
   │  LAYER 07: 90-Day Prediction                 │
   │  → Forecast demand by role/skill/region      │
   │  → Confidence intervals                      │
   │                                              │
   │  LAYER 08: Threat Detection                  │
   │  → Identify roles under automation threat    │
   │  → Detect market saturation signals          │
   │                                              │
   │  LAYER 09: Opportunity Detection             │
   │  → Identify undersupplied skill sets         │
   │  → High-signal low-competition windows       │
   │                                              │
   │  LAYER 10: Timing Intelligence               │
   │  → Optimal application timing by company     │
   │  → Quarterly budget cycle detection          │
   │                                              │
   │  LAYER 11: Hidden Job Detection              │
   │  → LinkedIn team growth signals              │
   │  → Job posting before official listings      │
   │                                              │
   │  LAYER 12: Market Synthesis                  │
   │  → Unified intelligence summary              │
   │  → User-personalized insights                │
   └──────────────────────────────────────────────┘
                       ↓
   data/market_intelligence (upsert)
                       ↓
   Available via services/api → apps/web
   [CareerIntelligenceView, MarketOutlookView]
```

---

## 5. Resume Processing Pipeline

```
┌─────────────────────────────────────────────┐
│  TRIGGER: User uploads resume (PDF/DOCX)    │
└──────────────────────┬──────────────────────┘
                       ↓
   services/api/resume (HTTP POST)
                       ↓
   Supabase Storage → PDF stored
                       ↓
   core/resume-engine/index.ts
                       ↓
   ┌──────────────────────────────────────────┐
   │  LAYER 01: Parsing                       │
   │  → PDF.js / Mammoth for DOCX             │
   │  → Raw text extraction                   │
   │                                          │
   │  LAYER 02: Extraction                    │
   │  → Contact info, experience blocks       │
   │  → Education, skills sections            │
   │                                          │
   │  LAYER 03: Embedding Generation          │
   │  → Groq/Gemini embedding API             │
   │  → Vector representation of resume       │
   │                                          │
   │  LAYER 04: Skill Mapping                 │
   │  → core/shared/shared-core/tech-ontology │
   │  → 33KB taxonomy of 2000+ skills         │
   │  → Canonical skill normalization         │
   │                                          │
   │  LAYER 05: Experience Scoring            │
   │  → YOE per technology                    │
   │  → Seniority signal detection            │
   │                                          │
   │  LAYER 06: Quality Assessment            │
   │  → ATS compatibility scan               │
   │  → Missing section detection            │
   │  → Keyword density analysis             │
   │                                          │
   │  LAYER 07: Singularity Score             │
   │  → Composite score 0-100                 │
   │  → Signal Math calculation               │
   │                                          │
   │  LAYER 08: Optimization Suggestions      │
   │  → Specific actionable rewrites          │
   │  → ATS keyword injection recommendations │
   └──────────────────────────────────────────┘
                       ↓
   data/user_profiles (updated)
                       ↓
   Trigger matching pipeline
```

---

## Component Interaction Rules

```
ALLOWED IMPORTS:
  apps/ → services/         ✅ Frontend calls API
  apps/ → shared/           ✅ Frontend uses shared types
  services/ → core/         ✅ API orchestrates engines
  services/ → shared/       ✅ API uses shared utilities
  core/ → infra/            ✅ Engines use connectors
  core/ → shared/           ✅ Engines use shared utilities
  infra/ → shared/          ✅ Infrastructure uses shared

FORBIDDEN IMPORTS:
  core/ → apps/             ❌ Engines do NOT import UI
  core/ → services/         ❌ Engines do NOT call API
  infra/ → core/            ❌ Infrastructure does NOT orchestrate
  infra/ → services/        ❌ Infrastructure does NOT call API layer
  shared/ → core/           ❌ Shared must be dependency-free
  shared/ → apps/           ❌ Shared must be dependency-free
  shared/ → services/       ❌ Shared must be dependency-free
```

---

## Execution Triggers Summary

| Worker | Trigger | Entry Point | Schedule |
|---|---|---|---|
| Ingestion | Cron | `infra/workers/index.ts` | Every 2 min |
| Enrichment | Cron | `infra/workers/enrichment.ts` | Every 5 min |
| Cleaner | Cron | `infra/workers/cleaner.ts` | Daily |
| Match | HTTP POST | `services/api/match` | On-demand |
| Resume | HTTP POST | `services/api/resume` | On-demand |
| Intelligence | Cron | `infra/workers/intelligence/` | Hourly |

---

## Data Layer Map

| Table | Written By | Read By | Purpose |
|---|---|---|---|
| `jobs` | ingestion-engine | matching-engine, enrichment | Canonical job listings |
| `users` | web app (profile) | matching-engine | User profiles + resume data |
| `match_results` | matching-engine | web app | Scored job matches |
| `market_signals` | intelligence-engine | intelligence-engine | Raw market signal data |
| `market_intelligence` | intelligence-engine | web app, services/api | Processed intelligence |
| `cursors` (KV) | ingestion-engine | ingestion-engine | Pagination state |
| `quarantine` (KV) | ingestion-engine | ingestion-engine | Circuit breaker state |
