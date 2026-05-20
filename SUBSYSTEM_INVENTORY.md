# HireMax Subsystem Inventory
> Authoritative map of every functional area in the codebase

---

## 1. Job Ingestion Engine

**Purpose:** Orchestrates multi-source job ingestion from 35+ external APIs into the Supabase jobs table
**Current Location:** `core/ingestion-engine/` + `infra/connectors/` + `infra/adapters/`
**Entry Points:**
- `infra/workers/index.ts` — Cloudflare Worker cron trigger
- `core/ingestion-engine/group_processor.ts` — batch processing orchestrator

**Key Files:**
- `core/ingestion-engine/group_processor.ts` — parallel group processor
- `core/ingestion-engine/normalize.ts` — raw → canonical job normalization
- `core/ingestion-engine/dedup_service.ts` — fingerprint-based deduplication
- `core/ingestion-engine/lock_service.ts` — distributed lock (Redis-like via KV)
- `core/ingestion-engine/source_quarantine.ts` — circuit breaker per source
- `core/ingestion-engine/throttling_guard.ts` — rate limit enforcement
- `core/ingestion-engine/timeout_guard.ts` — execution timeout detection
- `infra/workers/config/sources.ts` — registry of all 35 active sources
- `infra/workers/config/worker_groups.ts` — ALPHA/BETA/GAMMA/DELTA partitioning

**Dependencies:** `infra/connectors/`, `infra/adapters/`, `core/shared/db/`, `infra/workers/types/`
**File Count:** 43 (core/ingestion-engine) + 35 (infra/connectors) + 38 (infra/adapters) = **116 total**
**Execution Mode:** Cron (Cloudflare Worker, every 2 minutes)
**Needs Migration:** No (already in correct layer; needs documentation)

---

## 2. Connector Fleet (Fetchers)

**Purpose:** HTTP fetchers — one per job source. Handles auth, pagination, rate limits, raw data retrieval.
**Current Location:** `infra/connectors/`
**Entry Points:** Called by adapters via `infra/adapters/[source].ts`

**Active Connectors (35):**
Greenhouse, Ashby, Lever, SmartRecruiters, Workable, Workday, Himalayas, Remote OK, WeWorkRemotely, Working Nomads, Static Feed, Adzuna, Reed, Jooble, USAJobs, LinkedIn Scout, Otta, Personio, Teamtailor, JazzHR, Jobvite, Comeet, Cord, Recruitee, BambooHR, Hired, Findwork, Dice, Careerjet, Jobicy, Hacker News, Builtin, Google Jobs, Scraper HTML, Indeed

**Dependencies:** `infra/workers/types/job.ts`, `core/shared/utils/errors.ts`
**File Count:** 35
**Execution Mode:** On-demand (called by ingestion engine)
**Needs Migration:** No

**⚠️ Legacy Duplicate:** `core/shared/shared-core/connectors/` contains 25 outdated versions — these are the old Supabase Edge Function connectors from a prior architecture. They should be archived.

---

## 3. Adapter Layer

**Purpose:** Thin wrappers that bridge connectors (raw HTTP) to the ingestion engine (canonical ParsedJob). Handles fetch + parse coordination.
**Current Location:** `infra/adapters/`
**Entry Points:** `infra/adapters/registry.ts` — returns adapter by JobSource type

**Key Files:**
- `infra/adapters/registry.ts` — central adapter registry
- `infra/adapters/interface.ts` — ConnectorAdapter contract
- `infra/adapters/[source].ts` × 36 — per-source adapters

**Dependencies:** `infra/connectors/`, `core/ingestion-engine/` (parsers), `infra/workers/types/`
**File Count:** 38
**Execution Mode:** On-demand
**Needs Migration:** No

---

## 4. Matching Engine

**Purpose:** User-job matching — producing ranked job lists based on user profile fit
**Current Location:** `core/matching-engine/` (EMPTY — only `execution/` subdir exists)
**Entry Points:** None yet
**Actual Logic Location:** Partially in `apps/web/lib/api-engine.ts` (Supabase RPC calls)
**File Count:** 0 implementations
**Needs Implementation:** YES — this engine exists only as a directory stub

---

## 5. Scoring Engine

**Purpose:** Mathematical scoring models — Bayesian, ensemble, callback prediction
**Current Location:** `core/scoring-engine/` (COMPLETELY EMPTY)
**Actual Logic Location:** Score calculation exists in `core/shared/shared-core/signal-math.ts` (11KB) and `core/shared/shared-core/market-math.ts` (7KB)
**File Count:** 0 implementations
**Needs Implementation:** YES — this engine exists only as an empty directory

---

## 6. Intelligence Engine (Market Intelligence)

**Purpose:** 12-layer market intelligence — trend detection, threat detection, timing windows, 90-day forecasting
**Current Location:** DOES NOT EXIST as a directory
**Actual Logic Location:**
- `core/shared/shared-core/decision-engine.ts` (25KB) — decision orchestration
- `core/shared/shared-core/signal-math.ts` (11KB) — signal mathematics
- `core/shared/shared-core/market-math.ts` (7KB) — market calculations
- `core/shared/shared-core/market-signals.ts` (2KB) — signal types
- `apps/web/components/CareerIntelligenceView.tsx` (37KB) — mixed UI + logic
- `apps/web/components/MarketOutlookView.tsx` (33KB) — mixed UI + logic
**File Count:** 0 (as a standalone engine)
**Needs Migration:** YES — logic needs to be extracted from shared-core and frontend components

---

## 7. Resume Engine

**Purpose:** 8-layer resume processing — PDF parsing, skill extraction, embedding, scoring, optimization
**Current Location:** DOES NOT EXIST as a standalone directory
**Actual Logic Location:**
- `apps/web/components/ResumeBuilder.tsx` (27KB) — UI + processing logic mixed
- `apps/web/components/ProfileView.tsx` (74KB) — user profile + resume display
- `apps/web/components/FullReviewView.tsx` (39KB)
- `apps/web/components/TransformationFactory.tsx` (40KB)
- `apps/web/components/RebuildStandaloneView.tsx` (34KB)
- `core/shared/shared-core/job-normalizer.ts` — partial normalization
**File Count:** 0 (as a standalone engine)
**Needs Extraction:** YES — business logic is entangled with UI components

---

## 8. Enrichment Engine

**Purpose:** LLM-powered job enrichment — skill extraction, seniority classification, role categorization
**Current Location:** `infra/workers/enrichment.ts` (1.7KB entry) — invokes Groq API
**Actual Logic:** Within enrichment.ts and downstream Supabase Edge Functions
**File Count:** 1 (entry point only)
**Needs Expansion:** YES — no dedicated engine directory exists

---

## 9. Web Application

**Purpose:** React frontend — resume upload, job matching UI, market intelligence dashboard, application execution
**Current Location:** `apps/web/`
**Entry Points:** `apps/web/index.tsx` → `apps/web/App.tsx` (35KB main router)

**Key Components (Top 10 by size):**
- `ExecutionPreviewView.tsx` — 87KB (application execution engine UI)
- `ProfileView.tsx` — 74KB (user profile management)
- `TransformationFactory.tsx` — 40KB (resume transformation)
- `FullReviewView.tsx` — 39KB (resume review)
- `CareerIntelligenceView.tsx` — 37KB (market intelligence)
- `ApplicationsView.tsx` — 20KB
- `ResumeBuilder.tsx` — 27KB
- `MarketOutlookView.tsx` — 33KB
- `LandingPage.tsx` — 24KB
- `RebuildStandaloneView.tsx` — 34KB

**Dependencies:** Supabase JS, React, Lucide, Recharts, PDF.js, Mammoth
**File Count:** 37 components + 4 lib files + 9 root files
**Needs Migration:** No (correct layer)

---

## 10. Supabase Edge Functions

**Purpose:** Serverless compute for parsing, scraping, LinkedIn intelligence
**Current Location:** `infra/functions/`
**Functions:**
- `infra-gateway/` — API gateway, request routing
- `infra-parser/` — job parsing pipeline
- `infra-scraper/` — web scraping orchestration
- `worker-linkedin-v2/` — LinkedIn intelligence worker

**Dependencies:** `core/shared/shared-core/` (heavy dependency on shared logic)
**Needs Migration:** No (Supabase-specific deployment constraints)

---

## 11. Service Layer

**Purpose:** API endpoints and business logic orchestration
**Current Location:** `services/`
**Files:**
- `services/hiringProbabilityEngine.ts` (2.5KB) — hiring probability calculation
- `services/analytics/` — analytics endpoints
- `services/api/` — main API service
- `services/auth/` — authentication

---

## 12. Shared Core (Critical Logic Dump)

**Purpose:** Cross-cutting utilities imported by both Edge Functions and Workers
**Current Location:** `core/shared/shared-core/`
**Key Files (by domain):**

**Intelligence/Scoring Logic (should be in core/intelligence-engine):**
- `decision-engine.ts` (25KB)
- `signal-math.ts` (11KB)
- `market-math.ts` (7KB)
- `market-signals.ts` (2KB)

**NLP/Ontology (should be in core/resume-engine or shared/nlp):**
- `tech-ontology.ts` (33KB) — 33KB skill taxonomy
- `keyword-pool.ts` (8.7KB)
- `analysis-context.ts` (20KB)
- `guardrails.ts` (11KB)

**Ingestion Support:**
- `job-normalizer.ts` (8.5KB)
- `ingestion-guard.ts` (9.2KB)
- `binary-router.ts` (5KB)
- `fingerprint.ts` (3KB)

**Infrastructure:**
- `storage-client.ts` (9.4KB) — R2/B2 storage
- `redis.ts` (4KB)
- `security.ts` (2.2KB)

**Deprecated:**
- `connectors/` (25 files) — OLD connector set

---

## Cross-Cutting Concerns

| Concern | Current Location |
|---|---|
| Authentication | `services/auth/`, `apps/web/components/AuthView.tsx` |
| Logging | Inline `console.log/warn/error` — no centralized logger |
| Caching | `core/shared/shared-core/redis.ts` |
| Error Handling | `core/shared/utils/errors.ts` (partial) |
| Configuration | `.env`, `infra/workers/config/`, `core/shared/shared-core/env.ts` |
| Type System | `infra/workers/types/job.ts`, `apps/web/types.ts`, `core/shared/shared-core/types.ts` |
| Storage | `core/shared/shared-core/storage-client.ts`, `core/shared/db/` |
| Fingerprinting | `core/shared/shared-core/fingerprint.ts` |
