# Failure & Debug Map: Identity Engine

Reconstruction of runtime failures, logical traps, and observability blind spots.

## 1. Known Failure Modes

| Failure Type | Source | Symptom | Classification |
| :--- | :--- | :--- | :--- |
| **SSRF Guard Rejection** | `worker-external` | Worker returns 400; "Internal or private nodes restricted" | Breaks Golden Path (Securely) |
| **Spoof Guard Rejection** | `worker-external` | `integrity_events` log created; Worker returns 400 | Degrades UX (User input error) |
| **Unconverged session** | `snapshot-builder` | 202 Accepted; "Aborting build to prevent phantom state" | Logical Safe-Abort |
| **Deno Import Error** | Local IDE / Deployment | Linting errors regarding `esm.sh` or `deno.land` | Build/Maintenance Issue |
| **OAuth Timeout** | Remote API | Command status remains `processing` indefinitely | Degrades UX (Timed out) |

## 2. Debugging Signals

### `public.integrity_events`
The primary forensic log.
- `INGESTION_REJECTED`: Captured when Spoof Guard or SSRF Guard blocks an anchor.
- `SYSTEM`: Logged by `snapshot-builder` on successful atomic rebuild.

### `public.ingestion_commands`
- `status`: 'pending' -> 'processing' -> 'completed'/'failed'.
- `error_reason`: Contains the exact string error from the worker.

## 3. Blind Spots (Current Observability Gaps)

1. **Orphaned Snapshots**: If a session fails before convergence, `raw_*_snapshots` and `evidence_ledger` records for that session are persisted but never "seen" by a successful snapshot.
2. **Infinite Processing**: If a worker crashes silently (Deno runtime error), the command status remains `processing` until the next idempotency epoch.
3. **Cross-Worker Race**: While `ingestion_sessions` handles the gate, there is no lock on individual `career_*` records; concurrent sessions for the same user could technically write overlapping data if idempotency keys fail.

## 4. Logical Invariants to Monitor
- **Session Finality**: A session should never stay `open` for more than 5 minutes.
- **Score Sanity**: `overall_score` should never magically jump from 0 to 100 without corresponding `evidence_ledger` growth.
- **Provenance Lock**: `extraction_method` must always match the source capability (e.g., LinkedIn = 'verified').
