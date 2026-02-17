# System Overview: HireMax Forensic Reconstruction

## 1. Mission Statement
HireMax is a high-integrity professional identity and career automation engine. It focuses on "Truth-First" identity synthesis, forensic evidence collection, and automated job application execution.

## 2. Repository Structure
The repository is organized into a frontend (React/Vite) and a backend (Supabase Edge Functions & Postgres).

### Directory Tree
- `hiremax/` (Root)
  - `components/`: React UI components.
    - `profile/`: Sub-components for Identity Engine v2.5.
  - `supabase/`: Supabase configuration and logic.
    - `functions/`: Edge Functions (Deno). This is the primary backend logic layer.
    - `migrations/`: SQL migration files for database schema.
  - `backend/`: Potential legacy or auxiliary logic, containing original schema drafts and READMEs.
  - `lib/`: Shared frontend utilities (Supabase client, API wrappers).
  - `public/`: Static assets.
  - `docs/`: (New) Authoritative system documentation.

### Status Categorization
| Directory | Status | Purpose |
| :--- | :--- | :--- |
| `supabase/functions/` | **Active** | Core logic for ingestion, hardening, and building profiles. |
| `components/` | **Active** | Main UI layer, recently refactored for "Truth-First" UX. |
| `backend/` | **Experimental/Legacy** | Contains early drafts and some auxiliary scripts. |
| `lib/` | **Active** | Critical glue code for Supabase and API communication. |

## 3. Core Modules
1. **Identity Engine (v2.5 Hardened)**: Forensic extraction of professional signals from LinkedIn, GitHub, Gmail, and external anchors.
2. **Search & Apply Engine**: Automated discovery of job pointers and application execution.
3. **Resume Rebuild**: (Likely Legacy/Phase 1) Analysis and optimization of traditional resume documents.

## 5. File-Level Map (Exhaustive)

| Path | Type | Responsibility | Deps/Callers | Path Status |
| :--- | :--- | :--- | :--- | :--- |
| `App.tsx` | UI Shell | Global routing and job rehydration. | Entry point. | Golden Path |
| `components/ProfileView.tsx` | UI | Ingestion orchestration and identity view. | `App.tsx` router. | Golden Path |
| `supabase/functions/ingest-identity/` | Edge Function | API entry for ingestion; handles sessions. | `ProfileView.tsx`. | Golden Path |
| `supabase/functions/snapshot-builder/` | Edge Function | profile synthesis and scoring. | Ingestion Workers. | Golden Path |
| `supabase/functions/worker-external/` | Edge Function | Fetches and validates URL nodes. | `ingest-identity`. | Golden Path |
| `supabase/functions/worker-linkedin/` | Edge Function | Scrapes authenticated LinkedIn profiles. | `ingest-identity`. | Golden Path |
| `types.ts` | Config | Authoritative TypeScript interfaces. | Shared across app. | Golden Path |
| `lib/supabase.ts` | Utility | Shared Supabase client configuration. | All UI components. | Golden Path |
| `backend/supabase_schema.sql` | Schema | Consolidating SQL for manual deployment. | DB Setup. | Reference |

## 6. Source of Truth
- **Database**: Supabase Postgres (`public` schema).
- **Backend**: Supabase Edge Functions.
- **Frontend**: Vite + React + Tailwind (Standard components).
