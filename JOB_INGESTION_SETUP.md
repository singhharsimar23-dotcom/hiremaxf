# HireMax Job Discovery Engine - "God Mode" Architecture

## 🚀 Status: PRODUCTION-READY (Integrated)

**System Version:** v4.0 (Autonomous Orchestrator)
**Total Potential Sources:** 35+ (Clustered)
**Ingestion Cycle:** Every 6 Hours (Managed by `pg_cron`)
**Master Controller:** `discovery-orchestrator`

---

## 🏗️ Architectural Topology: Worker-Cluster Model

We have moved away from a monolithic scraper to a **Distributed Cluster Model**. This ensures that a failure in one scraper (e.g., a slow RSS feed) does not block the entire engine.

### 1. Orchestration Layer (`discovery-orchestrator`)
The central "Brain" that:
- **Checks Governor State**: Respects `READ_ONLY`, `SAFE`, or `FULL` modes.
- **Triggers Clusters**: Launches parallel requests to 8+ specialized workers with 120s timeout guardrails.
- **Post-Ingestion Hooks**: Automatically triggers `user-clustering` after successful discovery runs.
- **Analytics**: Logs performance metrics to `discovery_runs`.

### 2. Specialized Worker Clusters
| Worker | Scope | Strategy |
| :--- | :--- | :--- |
| `ats-engine` | Enterprise ATS | API-First (Greenhouse, Lever, Ashby, Workable) |
| `api-aggregator` | Remote Tech Hubs | Parallel JSON/RSS Fetch (RemoteOK, HN, Jobicy) |
| `job-board-scraper` | Traditional Boards | Direct DOM Parsing / RSS (WWR, WorkingNomads) |
| `tech-board-scraper` | Tech-Only | Specialized Scrapers (Otta, Cord, Hired) |
| `mobile-gateway` | High-Volume APIs | Adzuna & Geo-Specific Hubs |
| `github-watcher` | Hiring Signals | Repository Monitoring |
| `technographic-monitor`| Domain Signals | Career Path Log Monitoring |
| `ats-scraper` | Web-Based ATS | Dynamic HTML Parsing (Smartrecruiters, etc.) |

---

## 🔒 Security & Integrity

### 1. Robust Fingerprinting (SHA-256)
Every job is deduplicated before entry.
- **Formula**: `SHA256(company_id + role_category + location_type + source_url)`
- **Conflict Handling**: `ON CONFLICT (fingerprint) DO UPDATE` to refresh timestamps on existing jobs.

### 2. Governor State Control
Managed via the `governor_state` table.
- **FULL**: No limits (Production).
- **SAFE**: Ingestion allowed, but materialization restricted.
- **READ_ONLY**: All mutations blocked. Used during high-traffic or maintenance.

---

## 🔧 Operational Runbook

### Automatic Scheduling
The system is managed by Supabase Cron (`pg_cron`).
```sql
-- View active jobs
SELECT * FROM cron.job WHERE jobname = 'god-mode-orchestrator-6h';
```

### Manual Disaster Recovery
To manually trigger the entire pipeline from your local terminal:
```powershell
Invoke-RestMethod -Uri "https://ssuknybhzcuusjardsve.supabase.co/functions/v1/discovery-orchestrator" `
  -Method POST `
  -Headers @{ "Authorization" = "Bearer [SERVICE_ROLE_KEY]" }
```

### Adding a New Source
1. **Target the Category**: Decide if the source belongs in `api-aggregator` (RSS), `job-board-scraper` (DOM), or a new worker.
2. **Implement Adapter**: Add the source URL and mapping logic in the respective worker.
3. **Register (Optional)**: If creating a NEW worker function, add its slug to `discovery-orchestrator/index.ts`.

---

## 📈 Quality & Validation
Jobs are scored based on the presence of salary range, seniority clarity, and source reliability. 
- **Validation Status**: `UNVERIFIED` -> `VERIFIED` (via user interaction) -> `EXPIRED` (T+30 days).

---
*Verified by Core Engine Audit - Feb 9, 2026*

