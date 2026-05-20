# Source of Truth Architecture Map

This document reflects the **actual running architecture** in this repository, not an intended design.

## Real Data Flow
- External source APIs/feeds are fetched through `infra/connectors/*`.
- Source adapters in `infra/adapters/*` transform raw connector payloads into parsed job shape.
- `core/ingestion-engine/group_processor.ts` runs normalization (`Normalizer`), scoring (`QualityScorer`), and identity generation (`PersistenceEngine.generateIdentity`).
- `PersistenceEngine.upsert` writes canonical rows to `job_pointers`.
- Operational telemetry is written to `ingestion_runs`, `ingestion_logs`, `source_health`, `source_reliability`, and `worker_heartbeat`.

## Control Flow
- Runtime enters from `infra/workers/index.ts` through `fetch()` or `scheduled()`.
- `runIngestionTask` performs lock acquisition, preflight, source filtering, and invokes `runIngestionEngine`.
- `runIngestionEngine` processes tiers and per-source loops via `processSingle`.
- `processSingle` obtains adapter from registry, fetches batch, parses each item, gates quality, persists, and advances cursor.

## Identity Handling
- `source` originates in source config and parser output.
- `source_job_id` is parsed from upstream IDs (or aliased from `external_id`).
- `source`, `source_job_id`, company/title/location form fingerprint inputs inside `PersistenceEngine.generateIdentity`.
- `core/types.ts` enforces runtime source contract via `validateNormalizedJob`.

## Failure Handling Paths
- Fetch/parse/upsert failures are caught in `group_processor.ts` and logged via `PersistenceEngine.logAuditAction`.
- Failed records are sent to `ingestion_dlq` by `PersistenceEngine.pushToDLQ`.
- Throttle and quarantine decisions are handled in `core/orchestration.ts`.
- Tier/source locks (`lock_service.ts`) prevent duplicate concurrent processing.

## Contract Boundaries
- Canonical data contract: `core/ingestion-engine/core/types.ts`.
- Adapter boundary: `infra/adapters/interface.ts`.
- Adapter registration boundary: `infra/adapters/registry.ts`.
- Connector boundary: `infra/connectors/*`.
- DB transport boundary: `core/shared/db/client.ts`.

## Drift / Inconsistency Zones
- Hybrid adapter architecture remains (legacy adapter objects + BaseConnector instances).
- Some parser modules still use permissive input typing; runtime validation now catches invalid normalized outputs.
- Manual/public-profile ingestion modules are intentionally blocked until fully implemented persistence contracts exist.

---

## STEP 1 — ENTRYPOINT ANALYSIS

### Identified Entry Points
- `infra/workers/index.ts` -> `fetch(request, env)` for manual authenticated execution.
- `infra/workers/index.ts` -> `scheduled(event, env, ctx)` for cron execution.
- `infra/workers/cli/reprocess_failed.ts` for fallback replay (now guarded and disabled by default).

### Scheduling + Conditional Branches
- `LAUNCH_SAFE_MODE=true`: ALPHA + GAMMA ingestion with maintenance workflows still scheduled.
- `LAUNCH_SAFE_MODE=false`: minute-based ALPHA/BETA/GAMMA routing and maintenance triggers.
- `runIngestionTask` applies sequential tier lock + hard timeout + preflight filtering before engine run.

### Output: Execution Tree from Entrypoint
1. `index.ts` (`fetch` or `scheduled`)
2. `runIngestionTask` / `runLockedTask`
3. `runSourcePreflight` + `getHealthySources`
4. `runIngestionEngine`
5. `processSingle` per source
6. adapter fetch + parse loop
7. normalize -> score -> identity -> upsert -> cursor/metrics

## STEP 2 — DATA FLOW TRACE (END-TO-END)

Single job trace:

1. **Source fetch**
   - File: `infra/connectors/<source>.ts`
   - Function: `fetch*Jobs(...)`
   - Input -> Output: `(env, slug, offset, limit) -> raw[]`
   - Transform: remote API call + minimal paging/auth handling.

2. **Parsing**
   - File: `infra/adapters/<source>.ts`
   - Function: `parse(raw, label)`
   - Input -> Output: `raw -> ParsedJob-like object`
   - Transform: source-specific field mapping.

3. **Normalization**
   - File: `core/ingestion-engine/core/normalization.ts`
   - Function: `Normalizer.normalize(...)`
   - Input -> Output: parsed object -> validated `NormalizedJob`
   - Transform: URL cleanup, text cleanup, field aliasing, taxonomy coercion, runtime schema validation.

4. **Scoring / intelligence**
   - Files: `core/ingestion-engine/core/scoring.ts`, `core/ingestion-engine/core/intelligence.ts`
   - Functions: `QualityScorer.score`, `QualityScorer.isSpam`, `IntelligenceEngine.infer*`
   - Input -> Output: `NormalizedJob -> QualityScore (+ inferred role/seniority)`
   - Transform: deterministic quality grading + spam gate.

5. **Persistence**
   - File: `core/ingestion-engine/core/persistence.ts`
   - Functions: `generateIdentity`, `upsert`, `advanceCursor`, `recordSourceStats`
   - Input -> Output: `(NormalizedJob + score) -> UpsertResult + cursor/metrics updates`
   - Transform: SHA-256 identity, upsert payload shaping, DB writes, run/audit telemetry.

6. **Metrics / output**
   - Files: `core/shared/db/metrics.ts`, `core/ingestion-engine/core/persistence.ts`
   - Output: run summaries, per-source stats, audit logs, heartbeat.

## STEP 3 — SOURCE IDENTITY FLOW

### Lifecycle
1. Source seed in `infra/workers/config/sources.ts` (`slug`, `source`, `tier`).
2. Adapter gets source from registry key and parser emits job `source`.
3. `Normalizer.normalize` passes source through `validateNormalizedJob` (`core/types.ts`).
4. `PersistenceEngine.generateIdentity` uses source-context fields for fingerprint/canonical hash.
5. Persisted row stores `source` and `external_id` in `job_pointers`.

### Inconsistency Handling
- Previously mismatched parser/source namespaces were normalized (`static-feed`, `hacker-news-jobs`, `linkedin-scout`).
- `JobSource` union and runtime source set are now aligned in `core/types.ts` (includes `wellfound`, `yc-startups`, `yc-startups-eng`).

### Output: Identity Lifecycle Map
`sources.ts` -> adapter registry key -> parser `source` -> `validateNormalizedJob` -> `generateIdentity` -> `job_pointers(source, external_id, fingerprint, canonical_hash)`

## STEP 4 — DEDUPLICATION + IDENTITY LOGIC

### external_id generation
- Comes from parser as `source_job_id` (or aliased from `external_id` in normalizer).

### UUID fallback behavior
- `getSafeTraceId` in persistence uses deterministic UUID-style fallback for non-UUID trace IDs.
- Identity fingerprint itself does **not** use random UUID fallback; it uses deterministic hash inputs.

### fingerprint computation
- `PersistenceEngine.generateIdentity` computes SHA-256 over canonical source identity fields:
  - fingerprint raw: `company|title|location|sourceId`
  - canonical hash raw: `company|title|role|seniority`

### dedupe decisions
- Primary dedupe occurs in `upsert` on conflict key `fingerprint`.
- Upsert result determines inserted vs duplicate branch.

### Output: Full Identity + Dedupe Chain
`source_job_id/external_id` -> normalized job -> `generateIdentity()` -> `fingerprint/canonical_hash` -> `supabaseUpsert(job_pointers, on_conflict=fingerprint)` -> inserted or duplicate skip.

## STEP 5 — FAILURE PATH ANALYSIS

### Fail-open zones
- Source fetchers that returned empty arrays on broad exceptions were a fail-open zone; key connectors (`workable`, `workday`) now throw on non-404 failures.

### Silent-failure zones
- Prior placeholder ingestion modules returned success without work; now hard-fail with explicit `*_NOT_IMPLEMENTED` errors.
- Reprocess CLI previously simulated success; now guarded/disabled unless explicitly enabled.

### Retry zones
- DB write and DLQ paths use retry wrapper `withRetry` in persistence.
- Cursor and RPC calls use timeout wrappers and explicit error logging.
- Lock refresh failure aborts current task path.

### Output: Failure Map
- **Fail-open:** reduced in connectors and throttle logic.
- **Silent-failure:** blocked in placeholder modules and replay CLI.
- **Retry:** DB upsert/DLQ/RPC guarded with retry/timeout wrappers.

## STEP 6 — CONNECTOR / ADAPTER ARCHITECTURE

### Actual connector types in code
- Legacy adapter contract (`ConnectorAdapter`): `fetchBatch + parse (+healthCheck)`.
- BaseConnector implementations (modern) bridged into registry.

### Registration and invocation
1. `infra/adapters/registry.ts` stores adapter map by source.
2. `group_processor.ts` calls `getAdapter(source)`.
3. Adapter executes fetch + parse for each item.

### Unsafe bridging / any usage
- Registry previously relied on `as any` for BaseConnector instances.
- Current implementation now uses runtime shape-checked bridge (`asConnectorAdapter`) to reduce unsafe casting risk.

### Output: Actual Connector Architecture
Hybrid runtime:
- **Path A:** legacy adapter object -> group processor.
- **Path B:** BaseConnector instance -> runtime bridge -> group processor.
This is functional today, but full unification to one adapter contract is still a strategic cleanup opportunity.
