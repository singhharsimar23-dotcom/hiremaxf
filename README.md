# HireMax | Next-Gen Job Intelligence & Execution

HireMax is a persistent career execution environment designed to automate the gap between "Finding" a job and "Winning" it.

## 🚀 Core Features
- **"God Mode" Discovery**: 35+ global job sources monitored autonomously via a distributed Edge Function cluster.
- **Artifact Factory**: Deep extraction of professional evidence from GitHub, LinkedIn, and Gmail.
- **Execution Engine**: Persistent background pipeline for managing high-volume job applications with live telemetry.

## 🛠️ Tech Stack
- **Frontend**: Vite + React + Tailwind + Lucide
- **Backend**: Supabase Edge Functions (Deno)
- **Database**: PostgreSQL (Supabase) with `pg_cron` scheduling.
- **Auth**: Supabase Auth (OAuth integrations for GitHub/LinkedIn).

## 🏃 Run Locally

1. **Install dependencies**: `npm install`
2. **Setup Env**: Copy `.env.local` and set your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. **Run**: `npm run dev`

---
*For technical details on the ingestion pipeline, see [INGESTION_ARCHITECTURE.md](./INGESTION_ARCHITECTURE.md).*
