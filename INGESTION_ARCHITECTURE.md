# HireMax: Unified Ingestion Architecture

## 1. Executive Summary
The Ingestion Pipeline is the system's "Sensory Array," divided into two primary disciplines:
1. **Market Intelligence**: Continuous monitoring of 35+ job sources to identify professional "Kill Zones" (high-probability opportunities).
2. **Artifact Ingestion**: Authenticated extraction of career evidence from GitHub, LinkedIn, and Gmail to build the "Professional Truth."

## 2. Ingestion Disciplines

### 2.1 Market Intelligence (The Job Engine)
- **Topology**: Orchestrator-Worker cluster.
- **Master**: `discovery-orchestrator` (Triggered every 6h via `pg_cron`).
- **Isolation**: Each source category (ATS, Job Boards, APIs) has a dedicated Edge Function to prevent cascading failures.
- **Discovery Cycle**: Identify -> Fetch -> Normalize -> Fingerprint -> Upsert.
- **Intelligence Hook**: Post-run, the system triggers `user-clustering` to map newly ingested jobs to specific user personas.

### 2.2 Artifact Ingestion (The Identity Engine)
- **Role Selection**: User defines their primary track (SWE, Product, etc.) to calibrate ingestion scope.
- **Provider Connection**: Specific "Connect [Platform]" actions triggered for authenticated data access.
- **Non-Intelligent Extraction**: Ingestion is purely for retrieval and schema mapping. Analysis happens in the "Factory" later.
- **Snapshot Logic**: All data is ingested as a static snapshot. Automatic syncing is disabled for cost predictability; users "Resync" manually.

## 3. The Governor System
Ingestion behavior is governed by a central state machine (`governor_state`):
- **FULL**: Unrestricted ingestion and materialization.
- **CONTROLLED/SAFE**: Global scraping allowed; individual job materialization (deep parsing) restricted to preserve resources.
- **READ_ONLY**: All mutations blocked. The system enters a "Consumer-Only" state during maintenance.

## 4. Compliance & Ethics

### 4.1 Anti-Scraping Posture
HireMax **DOES NOT** scrape gated platforms or violate robots.txt. We use:
- **Public APIs**: Greenhouse/Lever/Workable public endpoints.
- **RSS/XML Feeds**: Standardized syndication from job boards.
- **Authorized OAuth**: User-granted access for private artifacts (GitHub/LinkedIn).

### 4.2 Deduplication (Fingerprinting)
To prevent "Job Spam," every entry is hashed using SHA-256 based on stable identifiers (Company + Position + Location + Source UID). Collisions are handled gracefully via `upsert`.

## 5. Deployment Scaling
In production:
- **Detached Workers**: Background workers handle the heavy lifting.
- **Audit Chain**: Every record in `job_pointers` and `discovery_runs` provides a trace for debugging.
- **Lifecycle Management**: Profile snapshots are versioned; old data is archived after 30 days to keep the "Heat Map" fresh.

---
*Architecture Verified by System Audit v4.0*
