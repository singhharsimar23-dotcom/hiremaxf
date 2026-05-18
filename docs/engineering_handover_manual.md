# HireMax Omni-US Engineering Handover Manual

## 📌 System Overview
The HireMax Ingestion & Intelligence Pipeline is a hardened, fully autonomous ecosystem designed to scan the entire US Tech Market (50 States) every 20 hours. It operates on a tiered orchestration model to manage resource limits (Free Tier) while maintaining high-fidelity data extraction and vector enrichment.

---

## 🏗️ Core Architecture (The Proof)

### 1. `master-intelligence-orchestrator`
*   **Role**: The "Brain" of the system. Manages tiered pulses (T1, T2, T3).
*   **Logic Proof**:
    *   **Tiered Pulsing**: T1 focus on ATS/LinkedIn; T2/T3 focus on deeper market intelligence.
    *   **Isolated Triggering**: Uses `AbortController` with a 55s timeout per child function to prevent cascade failures.
    *   **Auth Bypass**: Fetches `SERVICE_ROLE_KEY` from `system_settings` to allow secure inter-function communication.

### 2. `discovery-orchestrator`
*   **Role**: The "Sharding Engine". Rotates through 50 US States.
*   **Logic Proof**:
    *   **State-Rotation**: Picks exactly 5 states per run from a deterministic array of 50 US states.
    *   **Checkpointing**: Saves `state_index` to `system_checkpoints` to ensure 100% US coverage every 10 pulses.
    *   **Tech-Pillar Logic**: Constructs search queries using a 7-pillar tech tree (AI/ML, Web, Infra, Mobile, etc.).

### 3. `ats-engine-ultimate`
*   **Role**: The "Unified Ingestor". Collects jobs from 15+ sources.
*   **Logic Proof**:
    *   **Bulk Ingest v4**: Uses the `bulk_resolve_pointers_v4` RPC to insert 100+ jobs in a single DB transaction.
    *   **Circuit Breaker**: Detects HTTP 429/403 and calls `quarantine_source(p_source_name)` to disable a failing source for 1 hour.
    *   **Ingestion Throttle**: 1-second delay between source pulses to respect API limits.

### 4. `parser-worker`
*   **Role**: The "Lazarus Extractor". Parses raw HTML/JSON into structured data.
*   **Logic Proof**:
    *   **Self-Healing Scraping**: Detects "bot-blocked" content and re-scrapes using alternate user-agents/proxies.
    *   **Atomic Resolution**: Resolves source-specific IDs into the canonical `job_pointers` table.

### 5. `feature-worker`
*   **Role**: The "Vector Engine". Generates embeddings and quality signals.
*   **Logic Proof**:
    *   **Gemini v1 REST API**: Bypasses JS SDK versioning issues by calling the REST endpoint directly for 768-dim embeddings.
    *   **Quality Gating**: Calculates CSS/JS density and text-to-code ratios to filter out infrastructure noise.

---

## 🛠️ Maintenance Protocols

### 1. Storage Stabilization (Automatic)
The system self-cleans via `pg_cron` jobs:
*   **Purge v2**: Deletes `job_pointers` where `last_checked_at < now() - interval '48 hours'`.
*   **Safety**: Uses `JOIN user_bookmarks` to ensure no user-saved data is ever deleted.
*   **Blob Purge**: Deletes 50KB `raw_payloads` once parsed, keeping only the 1KB normalized record.

### 2. Operational Thresholds
*   **Ingestion Rate**: 12 runs/day (Every 2 hours).
*   **Tiered Yield**: T1 (500-1k jobs), T3 (Up to 5k jobs).
*   **Error Tolerance**: Up to 20% transient failure allowed; `integrity_events` tracks outliers.

---

## 🕵️ Monitoring & Debugging
1.  **Logs**: Check `integrity_events` table for structured logs with `request_id`.
2.  **Auth**: Ensure `SERVICE_ROLE_KEY` is present in `system_settings` (Required for cross-function calls).
3.  **Circuit Breaker**: Query `discovery_source_registry` for `quarantine_until` timestamps.

---
**Verified for Production Deployment**
*Antigravity AI Engine | 2026-03-26*
