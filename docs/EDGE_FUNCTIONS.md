# Edge Functions: Serverless Infrastructure Map

This document inventories the active and deployed Edge Functions, their triggers, and behavioral contracts.

## 1. Orchestration Functions

### `hiring-engine` (v40+)
- **Trigger**: HTTP POST from `ExecutionPreviewView.tsx`.
- **Endpoints**:
  - `/intent/resolve`: Normalizes raw role/seniority/location.
  - `/user-clustering/resolve`: Maps intent to a geographic/role cluster.
  - `/job-pointers/by-cluster`: Fetches scored job pointers via `match_jobs_v4`.
- **Responsibility**: Primary job discovery and Layer 1 matching orchestration.
- **Side Effects**: Reads `governor_state` for system throttling.

### `match-analyst`
- **Trigger**: HTTP POST from UI (Job Card analysis).
- **Responsibility**: Async AI-driven job alignment analysis.
- **Reliability**: Resetting stuck `analyzing` jobs (> 5m).

### `generate-diagnostic`
- **Trigger**: HTTP POST from `AIReviewView.tsx`.
- **Responsibility**: Single-resume 8-point market standing analysis.
- **Outputs**: Comprehensive `DiagnosticResult` saved to `analyses`.

### `execution-engine`
- **Trigger**: HTTP POST from Browser Extension `background.js`.
- **Responsibility**: Extension API router and DOM field classification.

---

## 2. Ingestion & Enrichment

| Function | Responsibility |
| :--- | :--- |
| `job-enrichment-analyst` | Enriches scraped jobs with salary, skills, and vector embeddings. |
| `ingest-identity` | Orchestrates professional identity synthesis from external sources. |
| `worker-linkedin` | OAuth-based LinkedIn profile retrieval. |
| `snapshot-builder` | Atomic profile synthesis and versioning. |
| `google-linkedin-scout` | Google-indexed LinkedIn job discovery via SerpApi. |

---

## 3. Career Optimization

| Function | Responsibility |
| :--- | :--- |
| `generate-rebuild` | AI resume rewriting and tailoring for specific jobs. |
| `generate-outlook` | Elite-locked High-signal Market Command snapshots. |

---

## 4. Shared Infrastructure

- `_shared/decision-engine.ts`: The authoritative source for probability math (`P(interview)`).
- `_shared/guardrails.ts`: Standardized JWT auth, rate limiting, and governor state checks.
- `_shared/analysis-context.ts`: Context window management for LLM-driven analyses.
