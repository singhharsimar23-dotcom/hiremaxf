# HireMax Operations Runbook
> Authoritative guide for all execution entrypoints and operational procedures

---

## System Startup

### Development Environment
```bash
# 1. Install dependencies
npm install

# 2. Set environment variables
cp .env.example .env
# Required vars: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
# Optional: GROQ_API_KEY, GEMINI_API_KEY, ADZUNA_APP_ID, ADZUNA_APP_KEY, REED_API_KEY

# 3. Start web app
npm run dev
# → http://localhost:3000

# 4. Run ingestion worker locally (dry-run)
npx tsx infra/workers/index.ts
```

### Production Environment
```bash
# Deploy Supabase Edge Functions
supabase functions deploy infra-gateway --project-ref [PROJECT_REF]
supabase functions deploy infra-parser --project-ref [PROJECT_REF]
supabase functions deploy infra-scraper --project-ref [PROJECT_REF]

# Workers (infra/workers/) are deployed as Supabase Cron jobs.
# Configure cron schedules in the Supabase Dashboard → Cron Jobs.
# See: https://supabase.com/docs/guides/functions/schedule-functions

# Verify health
npm run health:check
```

---

## Execution Entrypoints

### 🔵 Job Ingestion
**Entry:** `infra/workers/index.ts`
**Trigger:** Supabase Cron (`pg_cron`) — every 2 minutes
**Local Run:**
```bash
# Run with env vars
JOOBLE_API_KEY=xxx ADZUNA_APP_ID=xxx ADZUNA_APP_KEY=xxx \
  npx tsx infra/workers/index.ts

# Certification test (checks all connectors)
npx tsx infra/workers/scripts/certification_suite.ts
```
**Worker Groups:**
- ALPHA: Core ATS (Greenhouse, Ashby, Lever, SmartRecruiters)
- BETA: API Aggregators (Adzuna, Reed, Jooble)
- GAMMA: Remote Boards (Remote OK, WeWorkRemotely, Himalayas, Working Nomads)
- DELTA: Niche Sources (USAJobs, Hacker News, Builtin, etc.)

---

### 🔵 Job Enrichment
**Entry:** `infra/workers/enrichment.ts`
**Trigger:** Supabase Cron (`pg_cron`) — every 5 minutes
**What it does:** Fetches jobs with `enriched=false`, calls Groq API for skill extraction, patches records with `enriched=true`
**Local Run:**
```bash
GROQ_API_KEY=xxx npx tsx infra/workers/enrichment.ts
```

---

### 🔵 Database Cleaning
**Entry:** `infra/workers/cleaner.ts`
**Trigger:** Supabase Cron (`pg_cron`) — daily
**What it does:** Deletes job records older than 30 days

---

### 🔵 Reprocess Failed Jobs
**Entry:** `infra/workers/reprocess_failed.ts`
```bash
npx tsx infra/workers/reprocess_failed.ts
```

---

### 🔵 Supabase Edge Functions
**Entry:** `infra/functions/`
| Function | Purpose | Trigger |
|---|---|---|
| `infra-gateway` | API routing + orchestration | HTTP |
| `infra-parser` | Job parsing pipeline | HTTP or queue |
| `infra-scraper` | Web scraping | HTTP |
| `worker-linkedin-v2` | LinkedIn intelligence | HTTP/Cron |

---

## Common Operations

### Check Connector Health
```bash
# Run full certification suite
npx tsx infra/workers/scripts/certification_suite.ts

# View latest certification report
cat infra/workers/certification_report.json
```

### Ingest from Specific Source
```bash
# Force specific connector
SOURCE=greenhouse npx tsx infra/workers/index.ts
```

### Reset Source Quarantine
```bash
# Clear quarantine for a failing source (if it's actually fixed)
# Quarantine state is stored in Supabase (table or KV equivalent)
# Check the quarantine storage mechanism in: core/ingestion-engine/source_quarantine.ts
npx tsx infra/workers/scripts/release_quarantine.ts --source=greenhouse --slug=stripe
```

### View Ingestion Cursor
```bash
# Check where ingestion left off for a source
# Cursor state stored in Supabase — check core/shared/cursor/ for the storage key format
npx tsx infra/workers/scripts/check_cursor.ts --source=greenhouse --slug=stripe
```

### Debug With Live Trace
```bash
npx tsx infra/workers/live_trace.ts
```

---

## Environment Variables Reference

| Variable | Required | Used By | Description |
|---|---|---|---|
| `SUPABASE_URL` | ✅ | Everything | Supabase project URL |
| `SUPABASE_ANON_KEY` | ✅ | Web app, Edge Functions | Public API key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Workers | Bypasses RLS |
| `SUPABASE_DB_URL` | ✅ | Migrations | Direct DB connection |
| `GROQ_API_KEY` | ✅ | Enrichment worker | LLM enrichment |
| `GEMINI_API_KEY` | ✅ | Intelligence engine | Analysis tasks |
| `ADZUNA_APP_ID` | Optional | Adzuna connector | Job aggregator |
| `ADZUNA_APP_KEY` | Optional | Adzuna connector | Job aggregator |
| `JOOBLE_API_KEY` | Optional | Jooble connector | Job aggregator |
| `REED_API_KEY` | Optional | Reed connector | UK job board |
| `ASHBY_API_KEY` | Optional | Ashby connector | ATS connector |

---

## Debugging

### Ingestion Pipeline Stopped
1. Check `infra/workers/certification_report.json` for failing sources
2. Run: `npx tsx infra/workers/scripts/certification_suite.ts`
3. Check quarantine state in source_quarantine storage (see `core/ingestion-engine/source_quarantine.ts`)
4. Check Supabase logs in the dashboard → Logs → Edge Functions

### Match Quality Degraded
1. Review `core/scoring-engine/` implementation
2. Check `core/shared/shared-core/signal-math.ts` for recent changes
3. Inspect `data/match_results` table for score distributions

### Intelligence Stale (>2 hours)
1. Check cron schedule in the Supabase Dashboard → Cron Jobs
2. Inspect `core/intelligence-engine/` logs
3. Verify `data/market_intelligence` last_updated timestamp

### Database Near Storage Limit
1. Run cleaner: `npx tsx infra/workers/cleaner.ts`
2. Check `data/migrations/` for purge scripts
3. Archive old `raw_job_documents` records

---

## Key Metrics to Monitor

| Metric | Target | Where to Check |
|---|---|---|
| Ingestion Rate | >100 jobs/run | Certification report |
| Connector Health | All PASS | `certification_report.json` |
| Enrichment Queue | <500 pending | `SELECT COUNT(*) FROM jobs WHERE enriched=false` |
| Match Score Accuracy | ~33% callback | Match results analysis |
| DB Storage | <400MB | Supabase dashboard |
| Worker Execution Time | <30s/run | Supabase dashboard → Logs |

---

## Architecture Reference
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — System overview and dependency rules
- [`MODULE_REGISTRY.json`](./MODULE_REGISTRY.json) — Machine-readable module map
- [`SYSTEM_MAP.md`](./SYSTEM_MAP.md) — All execution flow diagrams
- [`SUBSYSTEM_INVENTORY.md`](./SUBSYSTEM_INVENTORY.md) — Per-subsystem breakdowns
- [`ARCHITECTURAL_DEBT.md`](./ARCHITECTURAL_DEBT.md) — Known issues and tech debt
