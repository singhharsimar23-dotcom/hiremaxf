# Ranking Engine
> File: `supabase/functions/_shared/decision-engine.ts`
> Called by: `hiring-engine`, `match-analyst`, `generate-diagnostic`
> Last Updated: 2026-03-11

---

## Goal

Estimate `P(interview)` — the probability that a recruiter will respond to an application — for a given candidate × job pair. This is the core intelligence layer of HireMax.

---

## Model

```
P(interview) = σ(β₀ + β₁·C + β₂·M + β₃·R + β₄·T + β₅·E)
```

Where `σ` is the sigmoid function `1 / (1 + e^-x)` and:

| Symbol | Domain | Default Weight |
|--------|--------|----------------|
| β₀ | Intercept | -1.6 (low baseline — signals must push the score up) |
| β₁ | Candidate Strength (C) | **2.3** (highest leverage — resume quality drives callbacks) |
| β₂ | Market Pressure (M) | 1.5 (FAANG hiring windows dramatically shift odds) |
| β₃ | Recruiter Surface (R) | 0.9 (important but hard to measure precisely) |
| β₄ | Timing Advantage (T) | 1.3 (fresh postings get 3x better response rate) |
| β₅ | Emerging Skills (E) | 0.8 |

Weights are loaded from `scoring_weight_sets` table (ML-updated by `optimize-weights`). Falls back to hardcoded defaults if no active weight set exists.

---

## Domain 1: Candidate Strength (β₁ = 2.3)

Measures the quality of the candidate's professional profile from their resume and feature vectors.

```
C = impact_density * 0.25
  + ownership_markers * 0.20  
  + architecture_scope * 0.20
  + experience_years_norm * 0.15
  + profile_health * 0.20
```

| Sub-Signal | Source | What It Measures |
|-----------|--------|-----------------|
| `impact_density` | `candidate_feature_vectors.project_complexity` | Density of quantified metrics in resume bullets |
| `ownership_markers` | `candidate_feature_vectors.seniority_score` | "I built/led/scaled" language ratio |
| `architecture_scope` | `candidate_feature_vectors.system_design_depth` | System design vocabulary depth |
| `experience_years_norm` | `candidate_feature_vectors.seniority_score` | Normalized years of experience (max at 15y) |
| `profile_health` | `profile_snapshots.signal_health.overall_score / 100` | Multi-channel identity health score |

**Implementation Note:** The `candidate_feature_vectors` table is populated by the `extract-candidate-features` Edge Function.

---

## Domain 2: Market Pressure (β₂ = 1.5)

Measures the supply/demand dynamics of the job market for this role.

```
M = 0.35 * job_freshness
  + 0.25 * repost_urgency
  + 0.25 * hiring_velocity_norm
  + 0.15 * skill_scarcity
```

| Sub-Signal | Source | What It Measures |
|-----------|--------|-----------------|
| `job_freshness` | `job_pointers.created_at` | Recency: 1.0 at day 0, decays linearly to 0 at day 45 |
| `hiring_velocity_norm` | `market_signals.hiring_velocity / 2.0` | Rate of new postings in this role category |
| `company_growth_signal` | `company_health_signals` | % of relevant companies without layoffs + positive growth |
| `skill_scarcity` | `market_signals.scarcity_index` | Supply-demand gap for required skills |
| `repost_urgency` | `market_signals.repost_factor` | Frequency of job reposting (signals urgency) |

---

## Domain 3: Recruiter Surface (β₃ = 0.9)

Measures how well the candidate's profile will surface in a recruiter's keyword/semantic search.

```
if vector_similarity is provided:
    R = vector_similarity  (embedding-based, most accurate)
elif candidate_embedding exists:
    R = confidence * 0.6 + keyword_overlap * 0.4
else:
    R = keyword_overlap_ratio  (fallback)
```

| Method | Trigger | Accuracy |
|--------|---------|---------|
| `embedding` | `vector_similarity` passed from RPC | Highest |
| `embedding` (legacy) | `ml_candidate_embeddings` embedding exists | High |
| `keyword_overlap` | No embedding available | Medium |

**Critical Weakness:** Job embeddings are not yet stored on `job_pointers`. The `vector_similarity` from `match_jobs_v3` is hardcoded to `0.5`. This means Domain 3 defaults to keyword overlap scoring in all current production flows.

**Missing_critical** — the top skills in the job that are absent from the resume. Shown in the UI and used for recommended actions.

---

## Domain 4: Temporal Opportunity (β₄ = 1.3)

The timing advantage of applying early — HireMax's highest-leverage differentiation over generic job boards.

```
age_score = 
  1.0 if age <= 1 day
  0.88 if age <= 3 days
  0.70 if age <= 7 days
  0.50 if age <= 14 days
  0.20 if age > 14 days

T = base_timing + (0.2 if EARLY_APPLICANT_ADVANTAGE) - (0.3 if age > 30 days)
```

| Label | Condition | Action |
|-------|-----------|--------|
| `APPLY_NOW` | T >= 0.8 | Apply immediately |
| `APPLY_SOON` | T >= 0.5 | Apply within 24h |
| `COMPETITIVE` | Mid-range | Monitor and apply |
| `SATURATED` | pool_score < 0.3 | Skip or wait |

---

## Domain 5: Emerging Skill Demand (β₅ = 0.8)

Detects if the candidate has high-momentum skills that are currently underrepresented in the market.

```
E = skill_momentum * 0.4 + candidate_match_ratio * 0.6
```

Source: `market_signals.emerging_skills` (from `compute-market-intelligence`).

---

## Decision Classification

After computing `P(interview)`:

| Probability | Timing | Candidate | Decision |
|-------------|--------|-----------|---------|
| ≥ 0.60 | not SATURATED | any | **APPLY** |
| ≥ 0.45 | APPLY_NOW | any | **APPLY** |
| < 0.30 | any | < 0.40 | **IMPROVE** |
| any | SATURATED | any | **WAIT** |
| < 0.35 | any | any | **IMPROVE** |

---

## Confidence Classification

| Level | Condition |
|-------|---------|
| `HIGH` | 4+ signals available + market + embedding |
| `MEDIUM` | 3+ signals + market, OR 2+ signals |
| `LOW` | < 2 signals |

---

## Retrieval: `match_jobs_v4` RPC

Before scoring, jobs are retrieved from `job_pointers`:

**Filters applied:**
- `quality_score > 0.5`
- `expires_at IS NULL OR expires_at > now()`
- Role match: `role_category ILIKE '%role%' OR full-text search on title`
- Location match: `location_name ILIKE '%location%' OR state_code ILIKE '%location%'`
- Remote preference: `location_type = 'remote'`

**Scoring within RPC:**
- `vector_similarity`: Cosine similarity between job embedding and candidate embedding.
- `skill_overlap_ratio`: `job_skills ∩ candidate_skills / job_skills`.
- `eligibility_score`: Hybrid score combining vector and skill mapping.

Returns top 200 ranked results with rich data (salary, posting age, work mode).

---

## Post-Processing Hard Filters

Applied in `hiring-engine` after retrieval:

| Filter | Condition | Action |
|--------|-----------|--------|
| Experience mismatch | `job.experience_max < candidate_years - 4` | Deprioritize |
| Stale listing | `posting_age_days > 30` | Penalty applied |
| Duplicate detection | `fingerprint` already in results | Skip |

---

## Weight Update Loop

The `optimize-weights` Edge Function reads `outcome_feedbacks` (did the user get an interview?) and updates `scoring_weight_sets` using gradient correction. This enables the model to improve over time as application outcomes are recorded.

---

## Current Weaknesses

1. **`experience_years_norm` = `seniority_score`** — Two signals measured by the same number; Domains 1 and 3 partially overlap.
3. **`impact_density` defaults to `0.4`** — The deprecated regex parser was removed but `project_complexity` from `candidate_feature_vectors` is often unpopulated. Most users fall back to `0.4`.
4. **Weight optimization is passive** — `optimize-weights` only runs when explicitly triggered; no continuous retraining scheduler exists.
5. **No experience gap hard filter** — The experience mismatch logic exists in comments but is not enforced as a hard exclusion in the RPC.
