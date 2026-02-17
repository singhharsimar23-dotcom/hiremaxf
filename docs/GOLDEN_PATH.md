# Golden Path: Identity Forensic Synthesis

The "Golden Path" represents the intended use case for the v2.5 Identity Engine: transforming fragmented network signals into a mathematically verifiable professional identity.

## 1. Trigger: Ingestion Intent
- **Source**: `ProfileView.tsx` (UI) calls `ingest-identity` (Edge Function).
- **Action**: User authorizes a node (OAuth) or provides a forensic anchor (URL/File).
- **Record**: An `ingestion_command` is created with a unique `idempotency_key`.

## 2. Orchestration: Session Initiation
- **Function**: `ingest-identity` registers a new `ingestion_session`.
- **Logic**: It calculates `expected_workers` based on the requested sources.
- **Dispatch**: It triggers specialized workers (`worker-linkedin`, `worker-github`, etc.) asynchronously.

## 3. Extraction: Forensic Evidence Collection
- **Function**: Specialized Workers (`worker-*`).
- **Activity**: 
    - Fetches raw data from remote APIs/HTML.
    - Persists payload to `raw_*_snapshots`.
    - Extracts atomic claims into `evidence_ledger`.
    - Populates `career_*` tables with `extraction_method` and `confidence_level`.
- **Termination**: Worker calls `increment_session_completion` RPC.

## 4. Convergence Gate: Signal Sync
- **Mechanism**: The last worker to complete checks if `completed_workers == expected_workers`.
- **Transition**: Session state moves from `open` to `converged`.
- **Trigger**: Upon convergence, the worker invokes `snapshot-builder`.

## 5. Synthesis: Snapshot Generation
- **Function**: `snapshot-builder`.
- **Action**:
    - Validates convergence.
    - Aggregates all `career_*` records.
    - Calculates `signal_health` (temporal decay + source authority).
    - Persists new immutable version to `profile_snapshots`.

## 6. Presentation: Truth-First UI
- **View**: `ProfileView.tsx` / `ProfileHealthDashboard.tsx`.
- **Data**: Reads the latest converged snapshot.
- **UX**: Displays "Evidence Density" and "Node Consensus" instead of broad marketing claims.
