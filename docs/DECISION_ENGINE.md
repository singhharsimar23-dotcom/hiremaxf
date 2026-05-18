# Decision Engine
> File: `supabase/functions/_shared/decision-engine.ts`
> Last Updated: 2026-03-11

---

## Decision Philosophy

HireMax is not a job board. It is a **callback probability optimizer**.

The core premise: recruiters do not evaluate applications randomly. They follow predictable screening heuristics — pattern-matching for role fit, seniority signals, quantified achievements, and first-mover timing. HireMax models those heuristics mathematically and tells candidates exactly where they stand before they apply.

**Architecture principle:** The deterministic model computes P(interview) FIRST. The LLM then explains the result in natural language. The LLM NEVER re-derives or contradicts the numeric scores.

```
deterministic math → interview_probability
interview_probability → LLM prompt (marked AUTHORITATIVE — DO NOT OVERRIDE)
LLM → natural language explanation of computed scores
```

---

## Why Did This Job Get Recommended?

A job is recommended when the system evaluates all five signal domains and the composite probability exceeds the APPLY threshold (0.60), OR when timing is optimal (APPLY_NOW) and probability exceeds 0.45.

**Concrete Example:**
```
Resume: Senior Backend Engineer, 7y exp, Python + AWS + ML
Job: Staff Python Engineer @ Series B startup, Remote, posted 2 days ago
Salary: $250k - $380k (High signal)

Candidate Strength (C): 0.72  (strong AWS experience, quantified metrics)
Market Pressure (M):    0.65  (Python market tight, startup hiring velocity high)
Recruiter Surface (R):  0.71  (8 of 11 required skills matched + Vector Similarity 0.78)
Timing Advantage (T):   0.88  (posting age: 2 days — APPLY_NOW window)
Emerging Skills (E):    0.60  (ML listed as required — currently high momentum)

z = -1.6 + 2.3*0.72 + 1.5*0.65 + 0.9*0.71 + 1.3*0.88 + 0.8*0.60
z = -1.6 + 1.66 + 0.98 + 0.64 + 1.14 + 0.48 = 3.30
P(interview) = σ(3.30) = 0.964 → APPLY (HIGH confidence)
```

---

## Why Was This Job Ranked Above Another?

Jobs rank higher when their composite probability is higher. Ranking factors in descending weight order:

| Factor | Weight | What Makes It Higher |
|--------|--------|---------------------|
| Candidate Strength | **2.3** | Quantified metrics in resume, ownership language, system design depth |
| Timing Advantage | **1.3** | Job is ≤3 days old, active hiring pipeline, no repost friction |
| Market Pressure | **1.5** | Low supply of this skill set, high hiring velocity |
| Recruiter Surface | **0.9** | Many required skills present in resume |
| Emerging Skills | **0.8** | Candidate has emerging high-momentum skills the market needs |

---

## Why Was This Job Filtered Out?

Hard filters eliminating jobs from results:

| Filter | Threshold | Reason |
|--------|-----------|--------|
| Low quality score | `quality_score <= 0.5` | Missing title, company, location, or URL — unreliable data |
| Expired job | `expires_at IS NOT NULL AND expires_at < now()` | Job no longer active |
| Saturated timing + low probability | `SATURATED` && P < 0.50 | Competition too high relative to candidate strength |
| IMPROVE decision | P < 0.35 or (P < 0.30 && C < 0.40) | Candidate not ready for this role |

---

## Why Does This Increase Callback Probability?

### Recruiter Behavior Model

Recruiters evaluate resumes in under 7 seconds. Their scanning heuristics:

1. **Role match** — Does the resume title/summary match the job title? (maps to Recruiter Surface score)
2. **Seniority coherence** — Does the candidate's experience band match the role level? (maps to `ownership_markers`, `experience_years_norm`)
3. **Technical vocabulary** — Do the skills and tools in the resume match the job requirements? (maps to `skill_overlap_count`, `missing_critical`)
4. **Quantified impact** — Are there numbers in the bullets? "Reduced latency by 40%" > "Improved performance." (maps to `impact_density`)
5. **Company pedigree** — Are past employers recognizable? (maps to `profile_health`)
6. **Timing** — Is this one of the early applications? (maps to Timing Advantage)

HireMax scores each of these, weights them by statistical impact, and surfaces the jobs where the candidate is already in the top of the distribution.

---

## Job Ranking Logic (Full Formula)

```
Score = β₀ + β₁·C + β₂·M + β₃·R + β₄·T + β₅·E
P(interview) = 1 / (1 + e^(-Score))
```

### Weights (Default — ML-updated via `optimize-weights`)
```
β₀ = -1.6  # intercept — keeps low-signal profiles appropriately low
β₁ = 2.3   # candidate quality is the biggest lever
β₂ = 1.5   # market timing matters enormously
β₃ = 0.9   # recruiter surface (limited by missing job embeddings currently)
β₄ = 1.3   # temporal advantage — first 48h window is decisive
β₅ = 0.8   # emerging skills give premium positioning
```

---

## Application Timing Strategy

Callback probability decays rapidly after posting:

| Age | Response Rate Multiplier | System Label |
|-----|------------------------|-------------|
| 0–24h | **3x baseline** | APPLY NOW (age_score = 1.0) |
| 24–72h | 2x baseline | APPLY NOW (age_score = 0.88) |
| 3–7 days | 1.5x baseline | APPLY SOON (age_score = 0.70) |
| 7–14 days | Baseline | Competitive (age_score = 0.50) |
| 14–30 days | 0.5x | Low priority (age_score = 0.20) |
| 30+ days | 0.2x | STALE LISTING RISK — penalty applied |

**Why:** Most companies receive 80% of their applicant pool in the first 3 days. Being in the first 20% of applicants gives asymmetric first-impression advantage.

---

## Confidence Score

| Level | Definition |
|-------|----------|
| `HIGH` | 4+ signal domains have real data + market signals + embedding |
| `MEDIUM` | 2–3 signal domains populated, market signals available |
| `LOW` | Single domain or fallback defaults used |

**Current state:** Most users are `MEDIUM` because job embeddings are missing (domain 3 defaults to keyword overlap) and `candidate_feature_vectors` is often empty (domain 1 defaults to 0.4 for most sub-signals).

---

## Explainability Layer

The system generates explicit human-readable reasons for every recommendation:

```
Recommended because:
  🔥 Fresh postings detected — first-mover advantage window active
  📊 Skill scarcity at 72% — supply-demand gap in your favor
  💡 High-density quantified impact signals detected in resume
  ⚡ Market hiring velocity is elevated — companies are moving fast
  🚀 Candidate has emerging skill: LLM fine-tuning (high momentum)
```

These reasons are computed deterministically in `buildKeyReasons()` — they are not hallucinated by the LLM.

---

## Current Weaknesses

1. **`experience_years_norm` = `seniority_score`** — Two signals measured by the same number; Domains 1 and 3 partially overlap.
2. **`impact_density` defaults to `0.4`** — Most users fall back to `0.4` without deep profile enrichment.
3. **No continuous feedback loop** — `optimize-weights` is not running on a automated schedule; weights require manual triggers.
4. **No ATS submission success tracking** — Whether the extension successfully submitted the form is not looped back into `P(interview)` refinement.
