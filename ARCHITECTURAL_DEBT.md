# HireMax Architectural Debt Register
> Last Updated: 2026-04-10 | Severity: P0–P2

---

## 🔴 SEVERITY: CRITICAL (P0)

### C1: Triple Connector Redundancy
**Location:** `infra/connectors/`, `core/ingestion-engine/` (parsers), `core/shared/shared-core/connectors/`
**Impact:** 3 parallel implementations of the same connectors. No canonical source of truth. Any bug fix must be applied 3 times. New engineers cannot determine which version is authoritative.
**Detail:** For Greenhouse alone: `infra/connectors/greenhouse.ts` (fetcher), `core/ingestion-engine/greenhouse.ts` (parser/adapter), `core/shared/shared-core/connectors/greenhouse.ts` (legacy Edge Function version). All three exist simultaneously.
**Recommended Fix:** Canonize `infra/connectors/` as fetchers, `infra/adapters/` as fetch+parse wrappers. Archive `core/shared/shared-core/connectors/`.

### C2: Core Engines are Empty Shells
**Location:** `core/matching-engine/`, `core/scoring-engine/`
**Impact:** Two critical engines (`matching-engine`, `scoring-engine`) have zero implementation files. Any engineer or AI agent inspecting these directories will believe the system has no matching or scoring capability. The actual logic is buried inside `shared-core/` and the frontend.
**Detail:** `core/scoring-engine/` is a completely empty directory. `core/matching-engine/` has only an empty `execution/` subdirectory. The scoring logic that powers the 33% callback prediction claim lives in `signal-math.ts` and `market-math.ts` in `shared-core/`.
**Recommended Fix:** Create stub engine directories with `ARCHITECTURE.md`, `interface.ts`, `module.json`. Migrate logic from `shared-core/` in Phase 2.

### C3: Business Logic Entangled with UI Components
**Location:** `apps/web/components/`
**Impact:** Critical business logic (resume processing, market intelligence) lives inside React components. This makes it untestable without a browser, impossible to call from workers, and impossible to share with the API layer. Files like `ExecutionPreviewView.tsx` (87KB), `ProfileView.tsx` (74KB) likely contain thousands of lines of business logic mixed with JSX.
**Recommended Fix:** Extract engine logic into `core/resume-engine/` and `core/intelligence-engine/`. Components should only call engine interfaces.

---

## 🟡 SEVERITY: HIGH (P1)

### H1: No Intelligence Engine Directory
**Location:** Missing `core/intelligence-engine/`
**Impact:** The "12-layer Market Intelligence Engine" — a core product differentiator — has no dedicated code location. Logic is scattered across: `shared-core/decision-engine.ts`, `shared-core/signal-math.ts`, `shared-core/market-math.ts`, and frontend components. Any AI agent or engineer will fail to find it.
**Recommended Fix:** Create `core/intelligence-engine/` with all 12 layer stubs + `ARCHITECTURE.md` + `interface.ts`.

### H2: No Resume Engine Directory
**Location:** Missing `core/resume-engine/`
**Impact:** Resume processing is a core product feature marketed as an "8-layer Resume Singularity Engine". The actual logic lives in frontend components (`ResumeBuilder.tsx`, `ProfileView.tsx`). Zero separation between UI rendering and business logic.
**Recommended Fix:** Create `core/resume-engine/` with all 8 layer stubs + `ARCHITECTURE.md` + `interface.ts`.

### H3: Monolithic `shared-core/` Without Domain Classification
**Location:** `core/shared/shared-core/` (30 files)
**Impact:** 30 files of critical logic — including a 33KB tech ontology, 25KB decision engine, and 20KB analysis context — all live in a flat directory with no domain separation. `decision-engine.ts` belongs in intelligence. `tech-ontology.ts` belongs in resume/NLP. `job-normalizer.ts` belongs in ingestion. This is a logic dump masquerading as "shared" code.
**Recommended Fix:** Domain-classify each file in ARCHITECTURE.md. Migration to proper domains is Phase 2.

### H4: Root Directory Pollution (13 log/junk files)
**Location:** Repository root
**Files:** `deploy.log`, `deploy_utf8.log`, `final_proof.log`, `final_proof_utf8.log`, `probe_output.log`, `test_output.log`, `test_output_utf8.log`, `multi_log.txt`, `visibility_output.log`, `response.json`, `gh_no_content.json`, `gh_test.json`, `test_alias.ts`
**Impact:** Professional repositories do not have logs in the root. Any new engineer's first impression of the codebase is garbage files. CI/CD tools may accidentally include these.
**Recommended Fix:** Delete all. Add to `.gitignore`.

### H5: Worker Output Logs Committed to SCM
**Location:** `infra/workers/out.txt`, `out2.txt`, `out3.txt`, `out4.txt`, `out5.txt`, `output.log`
**Impact:** Runtime output logs committed to version control. Will grow unbounded. Add noise to diffs.
**Recommended Fix:** Delete all. Add `*.log`, `out*.txt` to `.gitignore`.

### H6: No Centralized Logger
**Location:** Entire codebase
**Impact:** All services use inline `console.log/warn/error`. No correlation IDs, no structured JSON logs, no log levels, no ability to trace a single ingestion run end-to-end.
**Recommended Fix:** Create `shared/utils/logger.ts` with structured logging interface.

### H7: No API Contract Types
**Location:** `services/api/`
**Impact:** The API layer has no TypeScript interface contracts. Request/response shapes are implicit.
**Recommended Fix:** Create `services/api/interface.ts`.

---

## 🟢 SEVERITY: MEDIUM (P2)

### M1: Naming Inconsistency Between Layers
**Detail:** `infra/adapters/` uses `snake_case` for filenames (`remote_ok.ts`). `core/shared/shared-core/connectors/` uses `kebab-case` (`remote-ok.ts`). No consistent standard enforced.
**Recommended Fix:** Define naming convention in `CONTRIBUTING.md`. Enforce via CI.

### M2: Duplicate Build Config
**Location:** `apps/web/vite.config.js` AND `apps/web/vite.config.ts`
**Impact:** Vite will load one unpredictably. Maintaining two configs causes drift.
**Recommended Fix:** Delete `vite.config.js`, keep `vite.config.ts`.

### M3: No MODULE_REGISTRY.json
**Impact:** No machine-readable map of the system. AI agents and new engineers must read every file to understand the architecture.
**Recommended Fix:** Create `MODULE_REGISTRY.json` at root.

### M4: Fragmented Documentation (32 files in docs/)
**Detail:** 32 documentation files including `FINAL_ARCHITECTURE.md`, `ARCHITECTURE.md`, `SYSTEM_OVERVIEW.md`, `INGESTION_V2_ARCHITECTURE.md` — multiple competing "architecture" documents with no single source of truth.
**Recommended Fix:** Consolidate into root `ARCHITECTURE.md` + `docs/` for supplementary deep-dives.

### M5: No Dependency Constraint Enforcement
**Impact:** Nothing prevents a developer from importing `apps/` inside `core/`. The architectural rules defined in documentation have no automated enforcement.
**Recommended Fix:** Create `tests/architecture/dependency-contracts.test.ts`.

### M6: Missing enrichment-engine Directory
**Location:** `infra/workers/enrichment.ts` is the only enrichment file
**Impact:** Enrichment runs as an anonymous function in the worker, not a standalone engine. Cannot be tested independently or called from other contexts.
**Recommended Fix:** Create `core/enrichment-engine/` with `ARCHITECTURE.md` + `interface.ts`.

---

## Dependency Graph Issues

### Circular Dependencies (Suspected)
- `infra/adapters/` → `core/ingestion-engine/` → references adapter logic back to adapters (via `getAdapter()`)
- `core/shared/shared-core/` → imported by BOTH Edge Functions and Workers (cross-platform dependency)

### Forbidden Couplings
- `apps/web/components/` → Contains business logic that should be in `core/`
- `core/shared/shared-core/connectors/` → Legacy connectors that duplicate `infra/connectors/`

### Missing Abstractions
- No `BaseConnector` interface unifying all 35 connectors
- No `BaseEngine` interface for core engines
- No `APIResponse<T>` generic for the services layer
- No centralized error type hierarchy
