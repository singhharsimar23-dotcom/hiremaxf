# docs/ — LEGACY DOCUMENTS NOTICE
> ⚠️ **AI AGENT WARNING:** The files in this directory are from prior development phases and describe architectures that have been superseded, redesigned, or partially abandoned.
> **Do NOT treat these as the current system design.**

---

## Current Architecture Sources (Use These Instead)

| What you want | Where to look |
|---|---|
| System overview | [`/ARCHITECTURE.md`](../ARCHITECTURE.md) |
| Module map | [`/MODULE_REGISTRY.json`](../MODULE_REGISTRY.json) |
| Execution flows | [`/SYSTEM_MAP.md`](../SYSTEM_MAP.md) |
| Operations guide | [`/RUNBOOK.md`](../RUNBOOK.md) |
| Per-engine design | Each `core/[engine]/ARCHITECTURE.md` |
| Debt + known issues | [`/ARCHITECTURAL_DEBT.md`](../ARCHITECTURAL_DEBT.md) |

---

## Legacy Document Index

The following files exist for **historical reference only**. They document the thinking, experiments, and iterations that shaped the current system. They are preserved for context — not for guidance.

### ❌ Superseded Architecture Docs

| File | Date | Why Superseded |
|---|---|---|
| `ARCHITECTURE.md` | 2026-03-26 | Superseded by root `/ARCHITECTURE.md` (Apr 2026) |
| `FINAL_ARCHITECTURE.md` | 2026-03-28 | Was not final — replaced by current phase |
| `SYSTEM_OVERVIEW.md` | 2026-03-11 | Stale — predates ingestion-engine refactor |
| `INGESTION_V2_ARCHITECTURE.md` | 2026-04-07 | Interim doc — superseded by `core/ingestion-engine/ARCHITECTURE.md` |
| `DECISION_ENGINE.md` | 2026-03-21 | Describes intent, not current implementation |
| `RANKING_ENGINE.md` | 2026-03-21 | Matching engine design — now in `core/matching-engine/interface.ts` |
| `FRONTEND_SYSTEM.md` | 2026-03-21 | Stale component map — see `apps/web/ARCHITECTURE.md` |
| `AI_COMPONENTS.md` | 2026-03-21 | Intelligence design — now in `core/intelligence-engine/` |

### ❌ Stale Audit and Analysis Docs

| File | Date | Note |
|---|---|---|
| `SYSTEM_READINESS_AUDIT.md` | 2026-03-21 | Pre-refactor audit — architectural debt is now in `/ARCHITECTURAL_DEBT.md` |
| `FAILURE_MAP.md` | 2026-03-22 | Connector failure map — partially outdated, some connectors repaired |
| `ADVERSARIAL_STRESS_TEST_LOG.md` | 2026-03-22 | Performance test logs from prior ingestion pipeline |
| `MARKET_INTELLIGENCE_AUDIT.md` | 2026-03-22 | Pre-intelligence-engine audit |
| `ADVERSARIAL_MARKET_AUDIT.md` | 2026-03-22 | Same era |
| `AUDIT_REPORT.md` | 2026-03-04 | Very early codebase audit |
| `DOC_DRIFT_REPORT.md` | 2026-02-10 | Self-referential — docs about docs being wrong |

### ❌ Old Feature Specs (Intent Only)

| File | Date | Note |
|---|---|---|
| `APPLICATION_STRATEGY.md` | 2026-03-11 | Application execution strategy spec |
| `APPLICATION_AUTOMATION.md` | 2026-03-11 | Browser automation spec — see `apps/extension/` for actual code |
| `BROWSER_EXTENSION.md` | 2026-03-11 | Chrome extension spec |
| `OBSERVABILITY.md` | 2026-03-11 | Monitoring intent — not fully implemented |
| `WEAKNESSES.md` | 2026-03-11 | Known weaknesses at that time — see `/ARCHITECTURAL_DEBT.md` now |
| `ENGINEERING_RULES.md` | 2026-03-11 | Early engineering rules — see `/ARCHITECTURE.md` dependency section |
| `EXECUTION_ENGINE_V5.md` | 2026-03-02 | Execution engine iteration 5 spec |
| `ROADMAP_8X_CHANCE.md` | 2026-03-02 | Callback rate improvement roadmap |
| `RESUME_PROCESSING.md` | 2026-03-29 | Resume processing spec — see `core/resume-engine/ARCHITECTURE.md` |

### ❌ Database and Infrastructure Snapshots

| File | Date | Note |
|---|---|---|
| `DATABASE.md` | 2026-03-26 | DB schema snapshot — see `data/migrations/` for truth |
| `EDGE_FUNCTIONS.md` | 2026-03-24 | Edge function design — see `infra/functions/ARCHITECTURE.md` |
| `MARKET_COVERAGE.md` | 2026-03-26 | Connector coverage — see `infra/connectors/ARCHITECTURE.md` |
| `engineering_handover_manual.md` | 2026-03-26 | Handover document from an earlier phase |

### ❓ Ambiguous / Unknown

| File | Date | Note |
|---|---|---|
| `GOLDEN_PATH.md` | 2026-02-10 | Very early architecture path doc |
| `PAGE_CONTRACTS.md` | 2026-02-10 | Early UI page contracts |
| `migration_blueprint.md` | 2026-04-09 | Migration plan from yesterday — execution is complete |
| `aaaaa` | 2026-04-05 | Unknown scratch file — likely safe to ignore |

---

## Why These Files Are Not Deleted

These documents capture the **design evolution** of HireMax. Future engineers or AI agents may find historical context useful when:
- Understanding *why* a decision was made
- Reverting to an older approach
- Building on top of a prior design that was abandoned prematurely

They are kept in `docs/` as a read-only historical archive.

---

## The Single Source of Truth

```
For current system truth, always use:

  /ARCHITECTURE.md              ← system design
  /MODULE_REGISTRY.json         ← module inventory
  /SYSTEM_MAP.md                ← execution flows
  core/[engine]/ARCHITECTURE.md ← per-engine design
  core/[engine]/interface.ts    ← engine contracts
  infra/[layer]/ARCHITECTURE.md ← infra layer design
```
