# HireMax System Handoff Documentation (v16.0)

## 1. Project Overview
**HireMax** is a persistent career execution environment.
- **Factory**: Artifact ingestion and signal normalization.
- **Intelligence**: Job discovery ("God Mode") and signal hardening.
- **Execution Engine**: Persistent application pipeline with live telemetry.

---

## 2. Major Components (v16.0 Update)

### 2.1 "God Mode" Job Discovery
- **Status**: **DEPLOYED & AUTONOMOUS**.
- **Architecture**: Distributed cluster of 8 specialized workers managed by the `discovery-orchestrator`.
- **Coverage**: 35+ global sources including Greenhouse, Workable, Adzuna, and GitHub.
- **Infrastructure**: Running on Supabase Edge Functions with `pg_cron` scheduling every 6 hours.
- **Governor integration**: System supports `READ_ONLY`, `SAFE`, and `FULL` operation modes.

### 2.2 Application Execution Engine
- **Status**: **OPERATIONAL**.
- **`execution_runs`**: Tracks application cycles (pending, running, completed).
- **Persistence**: Rehydrates UI state from Supabase to ensure runs continue even if the browser is closed.
- **Limits**: Production cap of 50 dispatches per day enforced at the profile level.

### 2.3 Identity & Artifact Ingestion
- **Status**: **INTEGRATED**.
- **Platforms**: GitHub, LinkedIn, and Gmail (Stage-A extraction implemented).
- **Snapshot Logic**: All data is stored as versioned points-in-time for auditable history.

---

## 3. Maintenance & Operations

### 3.1 Monitoring Discovery
- **Tables**: Check `discovery_runs` for success/failure logs.
- **Telemetry**: Inspect `integrity_events` for runtime errors or governor blocks.

### 3.2 Emergency Procedures
- **Stop Ingestion**: Set `governor_state.current_mode` to `'READ_ONLY'`.
- **Manual Reset**: Use `discovery-orchestrator` via `/v1/` endpoint to force a full re-scrape.

---

## 4. Next Phase Roadmap
- **Deep Materialization**: Enhance the `materialize-job` function for 100% accurate parsing of non-structured job descriptions.
- **Signal Hardening**: Improve the `user-clustering` algorithm to match persona clusters with <10% margin of error.

**Final Status**: SYSTEM-STABLE. God Mode Active. Execution Verified.
