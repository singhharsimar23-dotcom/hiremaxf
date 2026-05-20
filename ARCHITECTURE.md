# HireMax System Architecture
> Version: 2.0 | Domain: Predictive Hiring Intelligence Platform

---

## System Overview

HireMax is a predictive hiring intelligence platform that tells engineers **the future of their career market**. It combines real-time job ingestion from 35+ sources, AI-powered resume analysis, mathematical matching models (33% callback prediction), and 12-layer market intelligence to give users a decisive advantage in their job search.

**Core Value Proposition:** Not just "here are jobs" — but "here are the RIGHT jobs, at the RIGHT time, with an application that CONVERTS."

---

## Architectural Principles

1. **AI-First Navigation** — Every module is self-documenting. `MODULE_REGISTRY.json` is the machine-readable map. `ARCHITECTURE.md` files exist in every major directory.
2. **Zero Ambiguity** — Explicit contracts define every module boundary. `interface.ts` files are the law.
3. **Domain Isolation** — Clear, enforced boundaries between subsystems. No forbidden imports.
4. **Single Responsibility** — Each module does ONE thing perfectly.
5. **Predictable Structure** — Any engineer or AI agent can find any subsystem in under 30 seconds.
6. **Production First** — No dead code in active directories. Dead code lives in `archive/`.

---

## System Layers

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: Applications  (apps/)                         │
│  React Web App · Chrome Extension · Admin Dashboard     │
├─────────────────────────────────────────────────────────┤
│  Layer 2: Services  (services/)                         │
│  API Routes · Auth · Analytics · Webhooks               │
├─────────────────────────────────────────────────────────┤
│  Layer 3: Core Engines  (core/)                         │
│  Matching · Intelligence · Resume · Scoring · Ingestion │
├─────────────────────────────────────────────────────────┤
│  Layer 4: Infrastructure  (infra/)                      │
│  Connectors · Adapters · Workers · Edge Functions       │
├─────────────────────────────────────────────────────────┤
│  Layer 5: Shared Utilities  (core/shared/)              │
│  Types · Utils · DB · Cache · Errors                    │
├─────────────────────────────────────────────────────────┤
│  Layer 6: Data  (data/)                                 │
│  Schemas · Migrations · Seeds                           │
└─────────────────────────────────────────────────────────┘
```

---

## Module Map

| Module | Location | Status | Purpose |
|---|---|---|---|
| Ingestion Engine | `core/ingestion-engine/` | ✅ Active | Multi-source job ingestion pipeline |
| Connector Fleet | `infra/connectors/` | ✅ Active | 35 HTTP fetchers |
| Adapter Layer | `infra/adapters/` | ✅ Active | Fetch+parse bridge |
| Workers | `infra/workers/` | ✅ Active | Cloudflare Worker scheduler |
| Edge Functions | `infra/functions/` | ✅ Active | Supabase serverless |
| Web App | `apps/web/` | ✅ Active | React frontend |
| Intelligence Engine | `core/intelligence-engine/` | 🔧 Stub | 12-layer market intelligence |
| Resume Engine | `core/resume-engine/` | 🔧 Stub | 8-layer resume processing |
| Matching Engine | `core/matching-engine/` | 🔧 Stub | User-job matching |
| Scoring Engine | `core/scoring-engine/` | 🔧 Stub | Mathematical scoring models |
| Enrichment Engine | `core/enrichment-engine/` | 🔧 Stub | LLM enrichment |
| Services API | `services/api/` | ✅ Active | REST API layer |
| Shared Core | `core/shared/` | ✅ Active | Cross-cutting utilities |

---

---

## The Trusted Core
The HireMax monorepo is anchored by the **Trusted Core** (located in `core/ingestion-engine/`). This subsystem is the absolute source of truth for:
1. **High-Fidelity Normalization**: Converting chaotic raw job data into canonical, predictable records.
2. **Deterministic Identity**: Generating SHA-256 fingerprints to eliminate duplicate entities globally.
3. **Signal Math Scoring**: Evaluating tech density and job quality using a canonical 600+ technology token map.

All other infrastructure (Connectors, Workers, Edge Functions) must be "Dumb" clients that delegate all logical decisions to the Trusted Core facades.

---

## Data Flow Architecture

### Primary Data Flow (Trusted Core Pipeline)
```
External Job APIs (35+ sources)
    ↓
infra/connectors/[source].ts        [Dumb Fetcher: extracts raw data]
    ↓
core/ingestion-engine/normalize.ts  [Trusted Core: high-fidelity cleaning]
    ↓
core/ingestion-engine/core/scoring  [Trusted Core: Signal Math evaluation]
    ↓
core/ingestion-engine/dedup_service [Trusted Core: SHA-256 identity]
    ↓
data/job_pointers                   [Canonical Database Storage]
    ↓
core/enrichment-engine/             [LLM skill extraction]
    ↓
data/jobs (enriched=true)           [Ready for Search & Match]
```

---

## Execution Flows

### 1. Job Ingestion Flow (Every 2 minutes)
```
[Cloudflare Cron]
    → infra/workers/index.ts (partitioned: ALPHA/BETA/GAMMA/DELTA)
    → core/ingestion-engine/group_processor.ts
    → [for each source]:
        → infra/adapters/registry.ts → getAdapter(source)
        → adapter.fetchBatch() → infra/connectors/[source].ts
        → adapter.parse() → ParsedJob
        → dedup_service.isDuplicate()
        → core/shared/db/jobs.ts → upsertJob()
    → cursor updated, quarantine reported
```

### 2. User-Job Matching Flow (On-demand)
```
[User profile updated OR new jobs ingested]
    → services/api/match
    → core/matching-engine/index.ts
    → Fetch user profile (data/users)
    → Fetch candidate jobs (data/jobs)
    → core/scoring-engine/ (Bayesian + ensemble)
    → core/matching-engine/ranker.ts
    → data/match_results (upsert)
    → Return top 10 to apps/web
```

### 3. Market Intelligence Flow (Every hour)
```
[Cloudflare Cron]
    → infra/workers/intelligence/index.ts
    → core/intelligence-engine/index.ts
    → Layer 01: Ingest market signals
    → Layer 02-04: Normalize, extract, detect trends
    → Layer 05-06: Bayesian learning + causal inference
    → Layer 07: 90-day prediction generation
    → Layer 08-09: Threat + opportunity detection
    → Layer 10-11: Timing intelligence + hidden jobs
    → Layer 12: Market synthesis
    → data/market_intelligence (upsert)
```

### 4. Resume Processing Flow (On-demand)
```
[User uploads resume]
    → services/api/resume (HTTP endpoint)
    → Supabase Storage (PDF stored)
    → core/resume-engine/index.ts
    → Layer 01-02: Parse + extract text
    → Layer 03: Embedding generation (Groq/Gemini)
    → Layer 04: Skill mapping (core/shared/shared-core/tech-ontology.ts)
    → Layer 05-06: Experience + quality scoring
    → Layer 07: Singularity score calculation
    → Layer 08: Optimization suggestions
    → data/user_profiles (updated)
    → Trigger matching flow
```

---

## Dependency Rules

### Allowed Dependencies ✅
```
apps/ → services/
apps/ → shared/
services/ → core/
services/ → shared/
services/ → data/ (read-only schema types)
core/ → infra/
core/ → shared/
core/ → data/ (read-only schema types)
infra/ → shared/
shared/ → shared/
```

### Forbidden Dependencies ❌
```
core/ → apps/
core/ → services/
infra/ → core/        (infra does not orchestrate core engines)
infra/ → services/
shared/ → core/
shared/ → infra/
shared/ → apps/
shared/ → services/
data/ → anything      (data layer is passive)
```

---

## Infrastructure Stack

| Component | Technology | Purpose |
|---|---|---|
| Database | Supabase PostgreSQL | Primary data store |
| Serverless | Supabase Edge Functions | Parser, scraper, gateway |
| Workers | Cloudflare Workers | Ingestion scheduler, enrichment |
| LLM | Groq API | Skill extraction, classification |
| LLM | Google Gemini API | Analysis, intelligence |
| Storage | Supabase Storage | Resume PDFs |
| Cache | Redis (via shared-core) | Rate limiting, locks |
| Frontend | React + Vite | Web application |

---

## Module Registry

See [`MODULE_REGISTRY.json`](./MODULE_REGISTRY.json) for the complete machine-readable module map.

## System Flows

See [`SYSTEM_MAP.md`](./SYSTEM_MAP.md) for full ASCII flow diagrams.

## Operations

See [`RUNBOOK.md`](./RUNBOOK.md) for all execution entrypoints and operational procedures.

## Subsystem Detail

See [`SUBSYSTEM_INVENTORY.md`](./SUBSYSTEM_INVENTORY.md) for per-subsystem breakdowns.

## Debt Register

See [`ARCHITECTURAL_DEBT.md`](./ARCHITECTURAL_DEBT.md) for all known issues and remediation plans.
