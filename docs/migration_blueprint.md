# 🏗️ Ingestion Migration Blueprint: Evolutionary Documentation

**Document Status**: AUTHORITATIVE  
**Target Audience**: Future AI Agents / Principal Engineers  
**Goal**: Scaling from 3 to 44+ Connectors in Cloudflare Workers.

---

## 1. System Philosophy
The system is transitioning from ad-hoc, per-connector scripts to a **Standardized Adapter Architecture**. This ensures reliability, observability, and scalability without manual intervention.

### Core Principles:
- **Stateless Growth**: All state (locks, cursors) lives in Supabase.
- **Granular Locking**: Distributed locks at both the Group level and Source level.
- **Micro-Batching**: High-frequency, low-volume runs (< 2s) to stay within Worker limits.
- **Quarantine Safety**: Dead sources are automatically isolated (5 fails = 1 hr pause).

---

## 2. Connector Adapter Interface
Every connector MUST implement the following interface located at `infra/workers/core/adapter/interface.ts`:

```ts
interface ConnectorAdapter {
  /** Fetch a batch of raw jobs from the source */
  fetchBatch(env: Env, offset: number, limit: number): Promise<any[]>;
  
  /** Normalize raw data into the canonical ParsedJob shape */
  parse(raw: any, company: string): Promise<ParsedJob>;
  
  /** Optional: Quick check if the API/Scraper is up */
  healthCheck(env: Env): Promise<boolean>;
}
```

---

## 3. Worker Group Partitioning
Connectors are organized by risk and reliability to prevent "Slow Neighbors" from blocking the pipeline.

| Group | Tier | Description | Connector Examples |
| :--- | :--- | :--- | :--- |
| **Alpha** | A | Stable Direct APIs | Greenhouse, Lever, Ashby, Workable |
| **Beta** | B | Aggregators / Marketplace | Jooble, Adzuna, Reed, Indeed |
| **Gamma** | C | Remote Boards / Feeds | Remote OK, Jobicy, Himalayas |
| **Delta** | D | Legacy Scrapers (High Risk) | Otta, Cord, Hired, Scraper-HTML |

---

## 4. Reliability Modules (The "Guardrails")

### 🛡️ ThrottlingGuard
Prevents "DDoS" behavior on ATS providers by tracking requests per domain. If a provider is being hit too hard across different sources, the guard will delay execution.

### 🛡️ CanonicalDedupService
Prevents duplicate jobs. Many jobs are posted on both Greenhouse and LinkedIn. Before upserting, we check if the `source_url` or `fingerprint` already exists in a recent window.

### 🛡️ TimeoutGuard
Strictly monitors execution time. Workers must exit at 1500ms to allow 500ms for clean shutdown/lock release before CP platform kills the process.

---

## 5. Migration Workflow for New Connectors
1.  **Check Legacy Core**: Look for existing parser/fetcher logic in `supabase/functions/_shared/connectors/`.
2.  **Create Wrapper**: New file in `infra/workers/ingestion/{connector}.ts`.
3.  **Implement Adapter**: Wrap legacy logic into `ConnectorAdapter`.
4.  **Register Group**: Add to appropriate Group (Alpha/Beta/Gamma/Delta) in `worker_groups.ts`.
5.  **Enable**: Set `enabled: true` in `sources.ts`.

---

## 6. Known Failure Patterns
- **Memory OOM**: Aggregators (Reed/Adzuna) can return 5MB+ JSON. Always use `limit: 50` in `fetchBatch`.
- **Cursor Drift**: If a connector fails mid-batch, do NOT advance the cursor.
- **Dead Locks**: If a worker crashes, the lock will expire in 90 seconds.

---
*Signed, Principal Architect (Antigravity)*
