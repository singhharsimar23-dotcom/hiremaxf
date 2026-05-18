# SYSTEM: HireMax
> Last Updated: 2026-03-11 | Status: **Production-Active**

---

## Mission

HireMax is a career intelligence platform that maximizes interview callback probability for job seekers. It ingests job postings from across the internet, runs a deterministic 5-domain scoring model to estimate interview probability for each role, and automates the application process through a Chrome extension.

**The core bet:** Recruiters follow predictable screening heuristics. If you model those heuristics mathematically, you can tell users exactly where to apply and why — before wasting time on bad-fit applications.

---

## Core Principle

**Callback Probability Optimization.**

Every feature exists to answer one question:
> *"Given this resume and this job, what is the probability the recruiter calls this person back?"*

This probability is computed deterministically (not by LLM) using five signal domains, then the LLM explains the result in natural language. The numbers come first. The explanation comes second.

---

## System Flow

```
User Resume
    │
    ▼
[Resume Processing] ──→ profile_snapshots, ml_candidate_embeddings
    │
    │                        [Job Ingestion Pipeline]
    │                               │
    │              tech-board-scraper ──┐
    │              job-board-scraper ───┤──→ job_pointers (76k+ rows)
    │              discovery-scout ─────┤
    │              mega-scraper ────────┘
    │
    ▼
[Ranking Engine] ── match_jobs_v3() RPC ──→ Scored job list
    │                decision-engine.ts
    │
    ▼
[Browser Extension] ── Overlay UI ──→ Autofill ATS forms
    │
    ▼
[Application Automation] ── execution-engine ──→ Submission + Telemetry
    │
    ▼
[Telemetry] ── ingestion_logs, integrity_events, discovery_runs
```

---

## Subsystems

| # | Subsystem | Purpose | Primary Code |
|---|-----------|---------|-------------|
| 1 | **Job Ingestion** | Scrape job boards, ATS APIs, and direct company sites | `tech-board-scraper`, `job-board-scraper`, `mega-scraper`, `discovery-scout` |
| 2 | **Job Database** | Store, deduplicate, and index all job postings | `job_pointers` table, `match_jobs_v3` RPC |
| 3 | **Ranking Engine** | Score jobs by interview probability using 5 signal domains | `decision-engine.ts`, `hiring-engine`, `match-analyst` |
| 4 | **Resume Processing** | Parse, embed, and store candidate resume data | `generate-diagnostic`, `snapshot-builder`, `extract-candidate-features` |
| 5 | **Browser Extension** | Detect ATS forms, show overlay, autofill fields | `chrome-extension/` (content.js, background.js, overlay) |
| 6 | **Application Automation** | Submit job applications through ATS systems | `execution-engine`, `ats-engine`, `auto-apply` |
| 7 | **Telemetry** | Record all actions, errors, and application outcomes | `ingestion_logs`, `integrity_events`, `ingest-friction-telemetry` |
| 8 | **Infrastructure** | Orchestration, governance, scheduling | `governor-reporter`, `discovery-orchestrator`, `job-governor`, `pg_cron` |

---

## External Dependencies

| Dependency | Purpose |
|-----------|---------|
| **Supabase** | PostgreSQL database, Auth, Edge Functions, Realtime, Storage |
| **pgvector** | HNSW vector similarity search for job-resume matching |
| **Gemini (Google)** | LLM for resume analysis, market outlook, rich answer generation |
| **Chrome Extension APIs** | `activeTab`, `scripting`, `storage`, `webNavigation`, `contextMenus` |
| **Jooble API** | External job board API (requires `JOOBLE_API_KEY`) |
| **Careerjet API** | External job board API (requires `CAREERJET_AFFID`) |
| **Deno Runtime** | Edge Function execution environment |

---

## Service Tier Map

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React/Vite)                │
│  DashboardView │ CareerIntelligenceView │ ProfileView   │
│  ExecutionPreviewView │ ApplicationExecutionView        │
└──────────────────────┬──────────────────────────────────┘
                       │ supabase.functions.invoke()
┌──────────────────────▼──────────────────────────────────┐
│              EDGE FUNCTIONS (Deno / Supabase)           │
│  hiring-engine │ generate-diagnostic │ generate-outlook │
│  execution-engine │ match-analyst │ resume-bandit        │
└──────────────────────┬──────────────────────────────────┘
                       │ postgres client
┌──────────────────────▼──────────────────────────────────┐
│            DATABASE (Supabase PostgreSQL + pgvector)    │
│  job_pointers │ profiles │ analyses │ market_snapshots  │
│  execution_runs │ profile_snapshots │ governor_state     │
└─────────────────────────────────────────────────────────┘
```

---

## User Plans

| Plan | Access Level |
|------|-------------|
| `Starter` | Resume analysis, basic job browsing |
| `Market Verdict` | Market intelligence view |
| `Career Pro` | Enhanced analysis |
| `Career Elite` | Full platform: career intelligence, market command, execution engine |
| `Automation` | Career Elite + automated application runs |

---

*This document answers: "What is this system?"*
