# Services Layer Architecture

## Purpose
HTTP API layer — routes user requests to core engines, manages auth, handles webhooks.

## Location: `services/`
```
services/
├── api/              ← Main REST API endpoints
├── analytics/        ← Analytics event processing  
├── auth/             ← Authentication/authorization
└── hiringProbabilityEngine.ts  ← Hiring probability model
```

## API Endpoints (Planned)

| Endpoint | Method | Handler | Engine |
|---|---|---|---|
| `/api/match` | POST | `services/api/match` | `core/matching-engine` |
| `/api/resume` | POST | `services/api/resume` | `core/resume-engine` |
| `/api/intelligence` | GET | `services/api/intelligence` | `core/intelligence-engine` |
| `/api/jobs` | GET | `services/api/jobs` | Supabase direct |
| `/api/profile` | GET/PUT | `services/api/profile` | Supabase direct |

## Dependency Rules
- ✅ Can call `core/*` engines
- ✅ Can use `shared/*` utilities
- ✅ Can read `data/` schema types
- ❌ Cannot import from `apps/*`
- ❌ Cannot import from `infra/*` directly

## Authentication
- Handled by `services/auth/`
- Supabase Auth (JWT-based)
- RLS enforced at DB level
