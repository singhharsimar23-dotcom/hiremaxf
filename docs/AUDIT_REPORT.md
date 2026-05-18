# HIREMAX SCORING & RANKING INFRASTRUCTURE AUDIT

## STATUS: AUDIT COMPLETE
**Date:** 2026-03-04
**Auditor:** Antigravity AI
**Objective:** Comprehensive extraction of all scoring logic to consolidate into a single Opportunity Score model.

---

## STEP 1 — Identification of Scoring Systems

| Name | File Location | Function | Usage |
| :--- | :--- | :--- | :--- |
| **Job Quality Score** | `_shared/job-normalizer.ts` | `calculateQualityScore` | Sorting in Job Discovery |
| **Heuristic Match Score** | `_shared/match-scorer.ts` | `calculateScore` | High-level job/candidate fit |
| **Qualitative Match** | `match-analyst/index.ts` | LLM Proxy (Gemini) | Deep fit analysis for UI |
| **Inference Score (V1)** | `migrations/20260213_ml_core_architecture.sql` | `predict_match_score` | Vector dot product similarity |
| **Inference Score (V2)** | `migrations/20260213_ml_production_upgrade.sql` | `predict_match_score_v2` | Weighted vector similarity |
| **Calibrated Score** | `migrations/20260213_ai_leverage_upgrade.sql` | `predict_calibrated_score` | Temperature-scaled output |
| **Autonomous Prob.** | `migrations/20260213_behavioral_intelligence.sql` | `predict_autonomous_score` | Full funnel probability model |
| **Structured Match** | `migrations/20260213_multichannel_inference_update.sql` | `predict_match_score_structured` | Coherence-based matching |
| **Uncertainty Score** | `migrations/20260213_ml_production_sharpening.sql` | `compute_prediction_uncertainty` | Confidence bounds |
| **Signal Final Weight**| `_shared/signal-math.ts` | `calculateFinalWeight` | Individual signal weighting |

---

## STEP 2 — Mathematical Formulas

### 1. Job Quality Score
**Formula:**
`Score = (0.25 * title_ok) + (0.20 * company_ok) + (0.15 * location_ok) + (0.25 * url_ok) + (0.15 * desc_ok)`
*   **Normalized:** [0.0 - 1.0]
*   **Weights:** Hardcoded.
*   **Usage:** Primary sort for `job_pointers` in `hiring-engine`.

### 2. Heuristic Match Score
**Formula:**
`Total = (SkillScore * 0.4) + (AlignmentScore * 0.4) + (LocationScore * 0.2)`
*   **Heuristic Gates:**
    *   If `location_match` is FALSE → `Result = Min(Total, 0.4)` (Hard Cap)
    *   If `SkillScore < 0.3` → `Result = Total * 0.5` (Penalty)
*   **AlignmentScore:** `(role_alignment + seniority_alignment) / 2`

### 3. Inference Score (V2)
**Formula:**
`Logit = (-1 * (u · c)) + (0.2 * r_c) + beta_t - Penalty`
`Score = 1 / (1 + exp(-Logit))`
*   **u, c:** 5D Embeddings (Technical, Seniority, Comm, Domain, Anomaly)
*   **r_c:** Company Reliability Score
*   **beta_t:** Market Trend Logit
*   **Penalty:** `3.0 * anomaly_score` if `anomaly_score > 0.5`

### 4. Autonomous Probability Score (Funnel)
**Formula:**
`P(Success) = P(Seen) * P(Read | Seen) * P(Interview | Read)`
*   **P(Seen):** Time-decayed velocity of company responses in current window.
*   **P(Read | Seen):** `1 - RecruiterFatigueIndex`
*   **P(Interview | Read):** `Sigmoid(V2_Logit)`
*   **Adjustment:** Delta between Funnel and V2 is clamped to `±30%` of `ABS(V2_Logit)`.

### 5. Signal Final Weight
**Formula:**
`Weight = BaseWeight * TemporalDecay * SourceAuthority * VerificationStrength * CrossBoost`
*   **TemporalDecay:** `0.5 ^ (days_ago / half_life)`
*   **CrossBoost:** `1.0 + (unique_sources * 0.05)` (Max 1.3)

---

## STEP 3 — Signal Sources

| Variable | Data Source | Processing Pipeline |
| :--- | :--- | :--- |
| **Skill Overlap** | Job Description / Profile Skills | LLM Extraction → Set Intersection |
| **Alignment** | Profile Role / Seniority | `LocationNormalizer` & `JobNormalizer` (Regex) |
| **Company Reliability** | `ml_company_embeddings` | Laplace Smoothing on Reply/Response Counts |
| **Market Temperature** | `ml_global_parameters` | Rolling Average of Interview Status |
| **Recruiter Fatigue** | `ml_recruiter_cognitive_model` | Volume-based cognitive load estimation |
| **Source Authority** | `signal-math.ts` | Hardcoded authority table (API=1.0, PDF=0.8, Form=0.7) |

---

## STEP 4 — Conflicting Scores

*   **Sorting vs Analysis:** `hiring-engine` sorts primarily by `quality_score`, but the UI shows jobs selected by `predict_match_score` (Vector).
*   **Weight Drift:** `predict_autonomous_score` and `predict_calibrated_score` compete for "final probability" status.
*   **Redundancy:** Structured Match (64D) and V2 Match (5D) operate on similar embedding spaces but different dimensions, creating potential ranking flip-flops if both are used in same session.

---

## STEP 5 — Hidden Heuristics

1.  **Tech Filter:** `isTechJob` uses a hardcoded regex whitelist. Jobs outside this are invisible to the scoring engine.
2.  **Location Veto:** `MatchScorer` imposes a 0.4 ceiling on any job where the location (remote/onsite) doesn't perfectly match, regardless of skills.
3.  **Anomaly Veto:** `predict_match_score_v2` imposes a 3.0 logit penalty on "anomalous" profiles (potential bots).
4.  **Credibility Veto:** `predict_autonomous_score` caps probability at 0.1 if `timeline_consistency < 0.3`.
5.  **Market Bias:** `beta_t` can shift the entire platform's probability floor up or down based on aggregate hiring volume.

---

## STEP 6 — Full Ranking Pipeline

1.  **Ingestion:** `discovery-scout` scrapes jobs.
2.  **Normalization:** `job-normalizer` computes **Quality Score** and extracts role/seniority.
3.  **Filtering:** `isTechJob` removes non-technical roles.
4.  **Clustering:** `hiring-engine` assigns jobs to location buckets.
5.  **Vector Inference:** `predict_match_score_v2` computes base similarity.
6.  **Behavioral Layer:** `predict_autonomous_score` applies funnel probability (fatigue/attention).
7.  **Final Sort:** UI receives list sorted by `quality_score` but displays it as "Top Matches" based on probability.

---

## STEP 7 — Architectural Weaknesses

*   **Competing Engines:** We have a deterministic heuristic engine (`match-scorer.ts`), a vector engine (SQL), and an LLM engine (`match-analyst`). They do not share weights.
*   **Hardcoded Constants:** Weights for Quality Score and Signal Authority are hardcoded and do not adapt to user behavior.
*   **Normalization Divergence:** Some scores are [0, 1] (Probability), some are Logits, and some are simple Weighted Sums. UI inconsistent mapping.
*   **Duplicate Logic:** `job-normalizer` logic exists both in shared TypeScript and in various edge functions.

---

## STEP 8 — Current Scoring Architecture Map

1.  **Core Match Probability (Autonomous Score)**
    *   *Purpose:* Final decision on whether to show/prioritize a job.
    *   *Formula:* Funnel-scaled V2 logit.
    *   *Inputs:* User Vector, Company Vector, Market Beta, Fatigue Index.
    *   *Where used:* Main Ranking.

2.  **Evidence Reliability (Signal Weight)**
    *   *Purpose:* Determines how much to trust a user's skill.
    *   *Formula:* Temporal Decay * Source Authority * Verification.
    *   *Inputs:* Timestamps, Proof URLs, Source Type.
    *   *Where used:* Profile Health & Skill Scoring.

3.  **Structural Quality (Job Score)**
    *   *Purpose:* Filters out "trash" data from scrapers.
    *   *Formula:* Field completeness sum.
    *   *Inputs:* Title, URL, Desc, Company.
    *   *Where used:* Search & Discovery sorting.

---
**NEXT STEPS RECOMMENDED:**
Consolidate all weight constants into `ml_global_parameters` and implement a single `predict_opportunity_score` function that merges Vector Similarity, Heuristic Gates, and Behavioral Funnel components into a single scalar value.
