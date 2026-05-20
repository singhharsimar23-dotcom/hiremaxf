# HireMax — AI Agent Navigation Guide

---

## ⚡ Vibecoding Agentic Shortcuts
**To assign a task without planning, just prefix your request with the Agent Name:**

*   **`Agent Fleet:`** For `infra/connectors` or `infra/adapters`. (e.g., *"Agent Fleet: Add a new Workday subdomain connector"*)
*   **`Agent Core:`** For `core/ingestion-engine` or `core/shared`. (e.g., *"Agent Core: Improve seniority detection for Lead roles"*)
*   **`Agent App:`** For `apps/web`. (e.g., *"Agent App: Add a 'Copy Link' button to the job card"*)
*   **`Agent Infra:`** For `infra/functions` or `infra/workers`. (e.g., *"Agent Infra: Fix the enrichment cron timeout"*)

---

> **READ THIS FIRST.** This file is the authoritative entry point for any AI coding agent working in this codebase.

---

## What This System Does

HireMax is a **predictive hiring intelligence platform** that gives software engineers a decisive edge in their job search. Core capabilities:

1. **Real-time job ingestion** — 35 live sources, every 2 minutes, into Supabase PostgreSQL
2. **Resume Singularity Engine** — 8-layer pipeline scoring and optimizing resumes (0–100)
3. **Market Intelligence Engine** — 12-layer pipeline producing 90-day hiring foresight, threat signals, opportunity windows
4. **Matching Engine** — mathematical user-job matching targeting 33% callback prediction
5. **Application Execution** — one-click tailored application campaigns

---

## Primary Navigation Files (Read These)

| File | What It Contains |
|---|---|
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | System layers, dependency rules, module map, full data flows |
| [`MODULE_REGISTRY.json`](./MODULE_REGISTRY.json) | Machine-readable map of every module with paths, deps, forbidden imports |
| [`SYSTEM_MAP.md`](./SYSTEM_MAP.md) | All 5 execution pipelines as ASCII flow diagrams |
| [`RUNBOOK.md`](./RUNBOOK.md) | All entrypoints, dev startup, env vars, debug commands |
| [`SUBSYSTEM_INVENTORY.md`](./SUBSYSTEM_INVENTORY.md) | Per-subsystem file inventories with key file breakdowns |
| [`ARCHITECTURAL_DEBT.md`](./ARCHITECTURAL_DEBT.md) | Known issues, severity ratings, where legacy code lives |

> **Do NOT read `docs/` first.** The files in `docs/` are legacy documents from prior development phases. They contain outdated architecture, superseded designs, and stale system descriptions. See [`docs/LEGACY_NOTICE.md`](./docs/LEGACY_NOTICE.md) for the full index.

---

## Directory Map — Where Things Live

```
hiremax/
├── ARCHITECTURE.md          ← START HERE for system overview
├── MODULE_REGISTRY.json     ← START HERE for machine-readable module map
│
├── core/                    ← All business logic engines
│   ├── ingestion-engine/    ← Job ingestion orchestration (ACTIVE, 43 files)
│   ├── matching-engine/     ← User-job matching (STUB — pending implementation)
│   ├── scoring-engine/      ← Mathematical scoring models (STUB — pending)
│   ├── intelligence-engine/ ← 12-layer market intelligence (STUB — pending)
│   ├── resume-engine/       ← 8-layer resume processing (STUB — pending)
│   ├── enrichment-engine/   ← LLM enrichment pipeline (STUB — partial)
│   └── shared/
│       ├── shared-core/     ← Critical cross-cutting logic (30 files, DO NOT move without audit)
│       ├── db/              ← Database access layer
│       ├── cursor/          ← Pagination state management
│       └── utils/           ← General utilities
│
├── infra/                   ← Infrastructure layer
│   ├── connectors/          ← 35 HTTP fetchers, one per job source (CANONICAL)
│   ├── adapters/            ← 38 fetch+parse wrappers (CANONICAL)
│   ├── workers/             ← Supabase cron jobs (ingestion, enrichment, cleaning)
│   └── functions/           ← Supabase Edge Functions (gateway, parser, scraper)
│
├── apps/
│   └── web/                 ← React frontend (37 components, Vite 6)
│
├── services/                ← HTTP API layer
│
├── data/
│   └── migrations/          ← 74 Supabase SQL migration files (DO NOT DELETE)
│
├── tests/
│   └── architecture/        ← Dependency contract enforcement tests
│
└── docs/                    ← LEGACY DOCUMENTS — see docs/LEGACY_NOTICE.md
```

---

## Dependency Rules — Strictly Enforced

```
ALLOWED:
    apps/ → services/ → core/ → infra/ → shared/

FORBIDDEN (will fail architecture tests):
    core/ → apps/         ❌ Business logic never imports UI
    core/ → services/     ❌ Engines don't call the API layer
    infra/ → services/    ❌ Infrastructure never imports API layer
    shared/ → core/       ❌ Shared utilities remain dependency-free
    shared/ → apps/       ❌ Same rule
```

Enforced by: `tests/architecture/dependency-contracts.test.ts`
Run: `npx vitest tests/architecture/`

---

## Execution Model — Supabase Cron, Not Cloudflare

The workers in `infra/workers/` are **Supabase cron jobs** (PostgreSQL `pg_cron` or Supabase Cron), **not** Cloudflare Workers.

| Worker | Entry Point | Schedule | Platform |
|---|---|---|---|
| Job Ingestion | `infra/workers/index.ts` | Every 2 min | **Supabase Cron** |
| LLM Enrichment | `infra/workers/enrichment.ts` | Every 5 min | **Supabase Cron** |
| Database Cleaner | `infra/workers/cleaner.ts` | Daily | **Supabase Cron** |

Supabase Edge Functions live in `infra/functions/` and are HTTP-triggered.

---

## Engine Status Reference

| Engine | Directory | Status | Note |
|---|---|---|---|
| Ingestion Engine | `core/ingestion-engine/` | ✅ **ACTIVE** | 43 files, fully operational |
| Connector Fleet | `infra/connectors/` | ✅ **ACTIVE** | 35 connectors |
| Adapter Layer | `infra/adapters/` | ✅ **ACTIVE** | 38 adapters |
| Web App | `apps/web/` | ✅ **ACTIVE** | React + Vite, 37 components |
| Edge Functions | `infra/functions/` | ✅ **ACTIVE** | Supabase Edge Runtime (Deno) |
| Enrichment Engine | `core/enrichment-engine/` | ⚠️ **PARTIAL** | Entry at `infra/workers/enrichment.ts` |
| Matching Engine | `core/matching-engine/` | 🔧 **STUB** | Interface defined, needs implementation |
| Scoring Engine | `core/scoring-engine/` | 🔧 **STUB** | Logic in `shared-core/signal-math.ts` |
| Intelligence Engine | `core/intelligence-engine/` | 🔧 **STUB** | Logic scattered, see ARCHITECTURE.md |
| Resume Engine | `core/resume-engine/` | 🔧 **STUB** | Logic inside `apps/web/components/` |

---

## Critical Files You Must Know

### The Shared-Core (30 files — DO NOT casually import or move)
`core/shared/shared-core/` is a critical shared package imported by both Supabase Edge Functions and Workers. Key files:
- `decision-engine.ts` (25KB) — intelligence orchestration
- `tech-ontology.ts` (33KB) — 2000+ skill taxonomy
- `signal-math.ts` (11KB) — scoring math
- `job-normalizer.ts` (8.5KB) — canonical job normalization
- `ingestion-guard.ts` (9.2KB) — ingestion circuit breaker via Supabase

### The Types Contract
- `infra/workers/types/job.ts` — canonical `ParsedJob`, `JobSource`, `Env` — **use this for all type definitions**
- `apps/web/types.ts` — frontend-only types

### The Adapter Registry
- `infra/adapters/registry.ts` — the single place to register or look up any connector adapter

### The Source Config
- `infra/workers/config/sources.ts` — the master list of all 35 active job sources

---

## Forbidden Patterns — Never Do These

```typescript
// ❌ Importing core engine logic directly into infra
import { groupProcessor } from '../../core/ingestion-engine/group_processor';

// ❌ Using legacy connectors (they are superseded)
import greenhouse from '../shared-core/connectors/greenhouse'; // WRONG

// ✅ Use the canonical connectors
import greenhouse from '../../infra/connectors/greenhouse'; // CORRECT

// ❌ Writing to root directory
fs.writeFileSync('./output.log', data); // will be auto-gitignored but don't do it

// ❌ Importing from docs/ as if it's current architecture
// docs/ files are LEGACY — see docs/LEGACY_NOTICE.md

// ✅ Formatting: For interface contracts, use the pattern in core/[engine]/interface.ts
// ✅ For new connectors: implement BaseConnector from infra/connectors/base-connector.ts
// ✅ For new adapters: implement ConnectorAdapter from infra/adapters/interface.ts
```

---

## How to Add a New Job Connector

1. Create `infra/connectors/[source_name].ts` — implement `BaseConnector` interface
2. Create `infra/adapters/[source_name].ts` — implement `ConnectorAdapter` interface
3. Register in `infra/workers/config/sources.ts`
4. Assign to a worker group in `infra/workers/config/worker_groups.ts`
5. Test via: `npx tsx infra/workers/scripts/certification_suite.ts`

---

## How to Implement a Stub Engine

All stub engines have `interface.ts` files defining the full contract. To implement:

1. Read `core/[engine]/ARCHITECTURE.md` — it tells you exactly what the engine does, inputs, outputs
2. Read `core/[engine]/interface.ts` — this is the exact TypeScript contract to implement
3. Read `core/[engine]/module.json` — tells you `current_logic_in` — where the existing logic actually lives
4. Create `core/[engine]/index.ts` — the engine entry point
5. Build against the interface, moving logic from `current_logic_in` locations

---

## Tech Stack

| Layer | Technology |
|---|---|
| Database | Supabase PostgreSQL (primary) |
| Serverless | Supabase Edge Functions (Deno runtime) |
| Cron Jobs | Supabase Cron (`pg_cron`) |
| LLM — Enrichment | Groq API |
| LLM — Analysis | Google Gemini API |
| Storage | Supabase Storage (resume PDFs) |
| Frontend | React 19 + Vite 6 |
| Deploy | Supabase (Edge Functions + DB + Cron) |

---

## Environment Variables (Required)

```bash
SUPABASE_URL                 # Project URL
SUPABASE_ANON_KEY            # Public key (web + edge functions)
SUPABASE_SERVICE_ROLE_KEY    # Admin key (workers, bypasses RLS)
SUPABASE_DB_URL              # Direct DB (migrations)
GROQ_API_KEY                 # LLM enrichment
GEMINI_API_KEY               # LLM analysis
ADZUNA_APP_ID / ADZUNA_APP_KEY  # Optional: Adzuna aggregator
REED_API_KEY                 # Optional: Reed UK jobs
JOOBLE_API_KEY               # Optional: Jooble aggregator
```
