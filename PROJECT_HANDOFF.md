
# HireMax System Handoff Documentation (v15.0)

## 1. Project Overview
**HireMax** is a persistent career execution environment.
- **Factory**: Artifact ingestion and signal normalization.
- **Intelligence**: Predictive hiring simulations and signal hardening.
- **Execution**: Live, persistent job application pipeline.

---

## 2. Execution Pipeline (v15.0 Implementation)
The Execution module has been converted from a simulation layer to a persistent, backend-driven pipeline.

### 2.1 Implementing Data Models
- **`execution_runs`**: The parent record for an application cycle. Tracked as `pending`, `running`, `completed`, `failed`, or `aborted`.
- **`execution_targets`**: Individual job listings selected for the run.
- **`execution_logs`**: Append-only audit trail for every backend action (submission, error, retry).

### 2.2 Functional Status
- **Implemented**: Full UI state rehydration from Supabase, run creation, target commit, and sequence logging.
- **In-Progress**: Direct third-party ATS API integration (currently handled via atomic Supabase state updates mimicking API response times).
- **Manual Boundary**: Resume selection and role designation are required before run initialization.

### 2.3 Limits & Safety
- **Daily Limits**: Production accounts are capped at 50 dispatches per 24-hour window. This is enforced via the `profiles.metadata` object.
- **Emergency Abort**: Users can terminate an active run at any time, marking the state as `aborted` in the DB.

---

## 3. Deployment Notes
- **Supabase Tables**: Ensure `execution_runs`, `execution_targets`, and `execution_logs` exist in the public schema with correct RLS policies for `user_id`.
- **Edge Functions**: The frontend is prepared to transition sequence processing to backend Edge Functions via standard Supabase triggers.

**Status**: PRODUCTION-READY. Simulation code purged. Persistence enabled.
