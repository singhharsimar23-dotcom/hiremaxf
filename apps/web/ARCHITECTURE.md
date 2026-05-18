# Web Application Architecture

## Purpose
React-based frontend for HireMax. Provides resume upload, AI-powered job matching, market intelligence dashboard, and one-click application execution.

## Stack
- **Framework:** React 19 + Vite 6
- **Language:** TypeScript
- **UI:** Custom CSS + Lucide icons
- **Charts:** Recharts
- **PDF:** pdfjs-dist, Mammoth (DOCX)
- **Backend:** Supabase JS (auth, database, storage)
- **LLM:** Gemini API (direct from client for analysis)

## Entry Points
- `index.tsx` → `App.tsx` → Route-based component rendering

## Component Map

### Core Views (by size, descending)
| Component | Size | Purpose |
|---|---|---|
| `ExecutionPreviewView.tsx` | 87KB | Full application execution engine UI |
| `ProfileView.tsx` | 74KB | User profile + resume management |
| `TransformationFactory.tsx` | 40KB | Resume transformation workflow |
| `FullReviewView.tsx` | 39KB | AI-powered resume review |
| `CareerIntelligenceView.tsx` | 37KB | Market intelligence dashboard |
| `RebuildStandaloneView.tsx` | 34KB | Resume reconstruction |
| `MarketOutlookView.tsx` | 33KB | Market trend visualization |
| `ApplicationsView.tsx` | 20KB | Application tracking |
| `ResumeBuilder.tsx` | 27KB | Resume building + editing |
| `LandingPage.tsx` | 24KB | Marketing/conversion page |

### Supporting Components
- `AuthView.tsx` — Authentication flow
- `DashboardView.tsx` — Main dashboard
- `Header.tsx` — Navigation
- `JobCardComponents.tsx` — Job listing cards
- `Pricing.tsx` — Subscription plans
- `Billing.tsx` — Payment management

## Lib Layer (`lib/`)
| File | Purpose |
|---|---|
| `api-engine.ts` | All Supabase API calls — matching, job fetching |
| `career-synthesizer.ts` | Career data synthesis utilities |
| `supabase.ts` | Supabase client initialization |
| `utils.ts` | General utilities |
| `store/` | State management |

## Dependency Rules
- ✅ Can call `services/api` via HTTP
- ✅ Can import from `shared/types`
- ❌ Cannot import from `core/` directly
- ❌ Cannot import from `infra/`

## Known Issues
- Business logic entangled with UI components — `CareerIntelligenceView.tsx` and `ProfileView.tsx` contain intelligence and resume processing logic that should live in `core/`
- Two vite configs exist: `vite.config.ts` (canonical) and `vite.config.js` (delete)
- `constants.js` and `constants.tsx` both exist at root of `apps/web/` — consolidate

## Build
```bash
# Development
npm run dev

# Production build
npm run build

# Preview production
npm run preview
```
