# Current Codebase Structure (Auto-Generated)
> Generated: 2026-04-10 | Tool: HireMax Architect Agent

## Directory Tree

```
hiremax/                                    [498 source files]
├── apps/
│   ├── admin/
│   ├── extension/                          [Chrome extension]
│   └── web/
│       ├── components/                     [37 files — React UI layer]
│       │   ├── market/
│       │   ├── profile/
│       │   └── [35 standalone .tsx files]
│       ├── lib/                            [4 files]
│       │   ├── api-engine.ts              (12KB — Supabase API calls)
│       │   ├── career-synthesizer.ts
│       │   ├── store/
│       │   └── utils.ts
│       ├── App.tsx                         (35KB — main router)
│       ├── types.ts                        (12KB — frontend types)
│       └── index.tsx
│
├── core/
│   ├── ingestion-engine/                   [43 files — mixed parsers + services]
│   │   ├── group_processor.ts             (4.5KB — batch orchestration)
│   │   ├── normalize.ts                   (4.6KB — data normalization)
│   │   ├── dedup_service.ts
│   │   ├── lock_service.ts
│   │   ├── source_quarantine.ts
│   │   ├── throttling_guard.ts
│   │   ├── timeout_guard.ts
│   │   ├── static_feed.ts
│   │   ├── scraper_html.ts
│   │   └── [34 parser files — one per connector]
│   │
│   ├── matching-engine/
│   │   └── execution/                     [EMPTY — no implementation]
│   │
│   ├── scoring-engine/                    [EMPTY — no implementation]
│   │
│   └── shared/
│       ├── cursor/
│       ├── db/
│       ├── utils/                         [5 files]
│       └── shared-core/                   [30 files — primary logic dump]
│           ├── decision-engine.ts         (25KB — candidate for intelligence layer)
│           ├── tech-ontology.ts           (33KB — skill taxonomy)
│           ├── signal-math.ts             (11KB — market math)
│           ├── analysis-context.ts        (20KB)
│           ├── guardrails.ts              (11KB)
│           ├── job-normalizer.ts          (8.5KB)
│           ├── market-math.ts             (7KB)
│           ├── keyword-pool.ts            (8.7KB)
│           ├── ingestion-guard.ts         (9.2KB)
│           ├── storage-client.ts          (9.4KB)
│           └── connectors/               [25 files — LEGACY]
│
├── infra/
│   ├── adapters/                          [38 files — slim wrappers per connector]
│   │   ├── registry.ts                   (adapter registry)
│   │   ├── interface.ts                  (connector contract)
│   │   └── [36 adapter .ts files]
│   │
│   ├── connectors/                        [35 files — HTTP fetchers]
│   │   └── [35 fetcher .ts files]
│   │
│   ├── workers/                           [12 direct files + subdirs]
│   │   ├── index.ts                      (Cloudflare Worker entry)
│   │   ├── enrichment.ts
│   │   ├── cleaner.ts
│   │   ├── config/                       [3 files: constants, sources, worker_groups]
│   │   ├── types/
│   │   ├── scripts/                      [certification_suite.ts]
│   │   └── tests/
│   │
│   ├── functions/                         [Supabase Edge Functions]
│   │   ├── infra-gateway/
│   │   ├── infra-parser/
│   │   ├── infra-scraper/
│   │   └── worker-linkedin-v2/
│   │
│   ├── deployment/
│   └── docs/
│
├── services/
│   ├── api/
│   ├── analytics/
│   └── auth/
│
├── data/
│   ├── migrations/migrations/             [74 files — Supabase migrations]
│   ├── schemas/
│   └── seeds/
│
├── docs/                                  [32 files — fragmented docs]
│
├── archive/                               [legacy graveyard]
│
└── tests/
    └── diagnostics/
```

## Code Statistics

| Metric | Value |
|---|---|
| Total source files | 498 |
| Total root-level log/junk files | 13 |
| Languages detected | TypeScript, TSX, JavaScript, SQL, JSON, Markdown |
| Largest directory | `data/migrations/migrations/` — 74 files |
| Largest single file | `apps/web/components/ExecutionPreviewView.tsx` — 87KB |
| Busiest engine | `core/ingestion-engine/` — 43 files |
| Documentation files | 32 (in docs/) |

## Largest Directories (by file count)

| Rank | Directory | Files |
|---|---|---|
| 1 | data/migrations/migrations/ | 74 |
| 2 | core/ingestion-engine/ | 43 |
| 3 | infra/adapters/ | 38 |
| 4 | apps/web/components/ | 37 |
| 5 | infra/connectors/ | 35 |
| 6 | docs/ | 32 |
| 7 | core/shared/shared-core/ | 30 |
| 8 | core/shared/shared-core/connectors/ | 25 |
| 9 | infra/workers/ | 12 |
| 10 | core/shared/utils/ | 5 |

## Initial Observations

### Potential Duplicates Detected
- `infra/connectors/greenhouse.ts` AND `core/ingestion-engine/greenhouse.ts` AND `core/shared/shared-core/connectors/greenhouse.ts` — **3x greenhouse connector**
- Same triple-duplication for: adzuna, ashby, lever, smartrecruiters, workable, and 20+ more
- `apps/web/vite.config.js` AND `apps/web/vite.config.ts` — **duplicate build config**

### Naming Inconsistencies
- Adapters use `snake_case` (e.g. `remote_ok.ts`, `hacker_news.ts`)
- Shared-core connectors use `kebab-case` (e.g. `remote-ok.ts`, `hacker-news.ts`)
- No consistent standard enforced

### Orphaned Files (Root)
- `deploy.log`, `deploy_utf8.log`, `final_proof.log`, `final_proof_utf8.log`
- `probe_output.log`, `test_output.log`, `test_output_utf8.log`
- `multi_log.txt`, `visibility_output.log`
- `response.json`, `gh_no_content.json`, `gh_test.json`
- `test_alias.ts`

### Dead Code Candidates
- `core/shared/shared-core/connectors/` — legacy connector set, superseded by `infra/connectors/`
- `core/matching-engine/execution/` — empty directory, no files
- `core/scoring-engine/` — empty directory, no files
- `apps/web/vite.config.js` — superseded by `.ts` version
- Worker output logs: `infra/workers/out*.txt`, `output.log`
