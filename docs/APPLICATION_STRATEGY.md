# Application Strategy Engine
> Last Updated: 2026-03-11

---

## Goal

Maximize interview rate per application submitted. Most job applications fail because candidates apply to wrong roles (wrong seniority, wrong skills, too competitive). HireMax eliminates that by computing an **Opportunity Score** for every job before the candidate sees it.

---

## Opportunity Score

Every job in the system gets an Opportunity Score before being shown to the user:

```
Opportunity Score = P(interview) = σ(β₀ + β₁·C + β₂·M + β₃·R + β₄·T + β₅·E)
```

See `RANKING_ENGINE.md` and `DECISION_ENGINE.md` for the full formula.

### Application Tier Classification

| Tier | Probability | Label | System Action |
|------|-------------|-------|--------------|
| **Tier A** | ≥ 0.60 | APPLY | Surfaced first; extension pre-loads autofill |
| **Tier B** | 0.40–0.60 | APPLY_SOON | Shown with improvement suggestions |
| **Tier C** | < 0.40 | IMPROVE or WAIT | Hidden unless user overrides; IMPROVE plan shown |

---

## Competition Estimation

The system estimates applicant competition for each job using available signals:

| Signal | Source | What It Indicates |
|--------|--------|-----------------|
| `competition_score` | `job_pointers` column | 0–100 competition index (enrichment-provided) |
| Timing `pool_score` | `market_signals.scarcity_index` | Inverse of applicant pool density |
| Source platform | `source_type` | WeWorkRemotely → high competition; Company direct post → low |
| `location_type` | `job_pointers` | Remote = 5–10x more competition than onsite |

**Competition Labels:**
- **Low** → `competition_score < 35` — niche role or brand-new posting
- **Medium** → `competition_score 35–65` — typical tech posting
- **High** → `competition_score > 65` — popular role or old posting (7+ days)

---

## Hiring Velocity

Companies actively hiring have fundamentally higher callback rates — they need bodies, not the perfect candidate.

| Velocity Label | Signal | Implication |
|---------------|--------|-------------|
| **High** | `market_signals.hiring_velocity > 1.5` | Apply fast — they're moving quickly |
| **Moderate** | `market_signals.hiring_velocity 0.5–1.5` | Normal process; timing still matters |
| **Low** | `market_signals.hiring_velocity < 0.5` | Slow process; may indicate budget uncertainty |

Hiring velocity is tracked in `market_signals` (computed by `compute-market-intelligence`).

---

## Application Timing

The system surfaces an optimal apply window for each job:

| Window | Age | Expected Response Rate | System Display |
|--------|-----|----------------------|---------------|
| **Apply Immediately** | 0–48h | **3x** | 🔥 APPLY NOW |
| **Apply Soon** | 48–72h | 2x | ⚡ APPLY SOON |
| **Apply Today** | 3–7 days | 1.5x | Apply Today |
| **Lower Priority** | 7–30 days | 1x | Low Priority |
| **Likely Stale** | 30+ days | 0.2x | ⚠️ May be Filled |

The system **actively penalizes** stale listings in scoring (timing score drops by 0.3 for jobs > 30 days old).

---

## Explainability Output

Every job card in the "Jobs For You" view shows:

```
Why this job is recommended:
  ✅ Strong match with backend engineering requirements
  🔥 Posted 14 hours ago — first-mover window active
  📊 Skill scarcity at 71% — your skills are in short supply
  ⚡ Company hiring velocity elevated this week
  💡 High quantified-impact density detected in resume
```

These are system-computed strings from `buildKeyReasons()` — not LLM-generated.

---

## Current Weaknesses

1. **Competition score sparsity** — `competition_score` is only populated by the `job-enrichment-agent`, which hasn't processed most job pointers. The system falls back to `0` for most jobs.
2. **No LinkedIn applicant count** — The most accurate competition signal (LinkedIn's "X applicants in first 24h") is not scraped due to LinkedIn's restrictions.
3. **No cluster-aware competition** — All users in `US-REMOTE` cluster compete for the same remote jobs. The system does not yet segment competition by geographic cluster.
4. **`WAIT` vs `IMPROVE` disambiguation too coarse** — The decision boundary between WAIT and IMPROVE is a single probability threshold, not a nuanced analysis of which specific improvements would cross the apply threshold.
