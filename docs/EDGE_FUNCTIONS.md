# Edge Functions: Serverless Infrastructure Map

This document inventories the active and deployed Edge Functions, their triggers, and behavioral contracts.

## 1. Orchestration Functions

### `ingest-identity`
- **Trigger**: HTTP POST from UI (`ProfileView.tsx`).
- **Inputs**: `{ source, source_type, action, payload, url_classification }`.
- **Outputs**: `{ command_id, session_id, status: 'processing' }` (HTTP 202).
- **Responsibility**: Idempotency checks, session initialization, and worker dispatch.
- **Side Effects**: Inserts into `ingestion_sessions` and `ingestion_commands`.

### `snapshot-builder`
- **Trigger**: HTTP POST from Workers (upon convergence) or Manual Rebuild.
- **Inputs**: `{ user_id, session_id (optional) }`.
- **Responsibility**: Atomic profile synthesis from `career_*` domain and `evidence_ledger`.
- **Side Effects**: Creates versioned `profile_snapshots`; updates `profile_strength_history`.
- **Gate**: Aborts if `session_id` provided but state != `converged`.

## 2. Ingestion Workers (v2.5 Hardened)

All workers share a common interface and must:
1. Write to `raw_*_snapshots`.
2. Extract atomic claims to `evidence_ledger`.
3. Populate `career_*` tables with specific `extraction_method`.
4. Call `increment_session_completion` RPC.

| Function | Source Type | Special Logic |
| :--- | :--- | :--- |
| `worker-linkedin` | OAuth | Full profile extraction; Verified. |
| `worker-github` | OAuth | Repo and skill extraction; Verified. |
| `worker-gmail` | Node | ATS/Learning outcome extraction; Ground Truth. |
| `worker-external` | URL | SSRF Guard; Spoof Guard; Text Density Check. |
| `worker-resume` | File | Parser-based extraction; Synthetic/Parsed. |

## 3. Peripheral Functions (Search & Apply)
- `generate-diagnostic`: Performs Resume/Job fit analysis.
- `generate-rebuild`: Optimizes resumes for specific roles.
- `ats-scraper`: (Legacy?) Scrapes ATS systems for job data.
- `job-governor`: Manages daily scrape budgets and system state.

## 4. Shared Libraries
- `_shared/signal-math.ts`: Authoritative source for temporal decay and scoring logic.
- `_shared/supabase_client.ts`: Utility for service-role interactions.
