# HireMax Final Production Architecture (v1.0)

**Status:** APPROVED FOR PRODUCTION  
**Scale:** 0 to 1M+ Candidates  
**Constraints:** Sparse Data, High Adversarial Risk, Sub-50ms Latency

---

## 1. SYSTEM CORE ARCHITECTURE

The system is a **Retrieval-Augmented Ranking Pipeline** utilizing a Two-Tower (Dual Encoder) architecture with a lightweight Interaction MLP for scoring. This design decouples representation learning from interaction modeling, allowing $O(N)$ retrieval and $O(1)$ scoring.

### Pipeline Stages
1.  **Ingestion & Feature Normalization** (Async)
    *   *Input:* Raw Resume (PDF), GitHub User Profile, Job Description.
    *   *Output:* Normalized text chunks, structured metadata vectors.
    *   *Safeguard:* Strict schema validation; discard malformed/incomplete profiles.
2.  **Representation Learning** (Batch/Cached)
    *   *Process:* Project raw features into Latent Semantic Space ($\mathbb{R}^{64}$).
    *   *Model:* Frozen SBERT backbone + Trainable Projection Heads.
3.  **Candidate-Job Matching** (Real-time)
    *   *Process:* Retrieve candidates/jobs -> Compute Interaction Scores.
    *   *Model:* Interaction MLP (Non-linear).
4.  **Macro & Reliability Adjustment** (Post-Process)
    *   *Process:* Apply Label Smoothing correction + Market Beta shift.
5.  **Anti-Gaming & Bandit Logic** (Post-Process)
    *   *Process:* Apply Penalty checks + Experiment noise.

---

## 2. EMBEDDING STRATEGY (Final Form)

**Strategy:** Frozen Heterogeneous Backbone with Trainable Projections.
*Reasoning:* Small data cannot train a Transformer from scratch. We rely on zero-shot capabilities of Pretrained models (SBERT) and only learn the domain-specific alignment (Projection).

### Encoder Architecture
*   **Text Branch (Resume/JD):** 
    *   `all-MiniLM-L6-v2` (Frozen) $\rightarrow$ 384-dim.
    *   `Dense(64, Linear)` (Trainable Adapter).
*   **Code Branch (GitHub):** 
    *   `CodeBERT` (Frozen) or Structural Features (Language dist, Repo stats) normalized.
    *   `Dense(64, Linear)` (Trainable Adapter).
*   **Fusion:**
    *   Weighted Average or Concatenation $\rightarrow$ `LayerNorm` $\rightarrow$ Final Embedding $u \in \mathbb{R}^{64}$.

### Training Settings
*   **Loss:** Contrastive Loss (Margin Ranking).
    *   $L = \max(0, m - S_{pos} + S_{neg})$
*   **Negative Sampling:** 
    *   Batch Hard Negatives (candidates rejected in the same batch).
    *   Random Negatives (from different epochs).
*   **Regularization:** 
    *   L2 Normalization ($||u||_2=1$) enforced on output.
    *   Dropout (0.1) in Projection layer.
*   **Update Cadence:** Weekly full-batch retrain (projection weights only).

---

## 3. MATCH FUNCTION (Final Form)

**Model:** Interaction MLP (Lightweight).
*Reasoning:* Dot product misses non-linear synergies (e.g., "Senior role requires Senior dev" is an XOR-like interaction, not just similarity).

### Network Structure
*   **Input:** Concatenation $X = [u, v, u \odot v, |u - v|]$ (Dim: $64 \times 4 = 256$).
*   **Hidden Layer:** `Dense(32, ReLU)` + `BatchNorm`.
*   **Output:** `Dense(1, Linear)`.
*   **Total Params:** $\approx 8.5k$. Extremely small.
*   **Computation:** $<1ms$ on CPU/Postgres.

---

## 4. LABEL NOISE & CENSORING HANDLING

**Strategy:** Reliability-Weighted Binary Classification.
*Reasoning:* Survival models are unstable with >90% right-censoring. We treat "Ghosting" as a strictly unreliable signal, not a hard negative.

### Reliability Score ($R_c$)
For each company $c$:
$$ R_c = \frac{N_{replies} + \alpha}{N_{applications} + \beta} $$
*   $\alpha=1, \beta=5$ (Bayesian smoothing).
*   Companies that *never* reply have $R_c \approx 0.1$.
*   Companies that *always* reply have $R_c \approx 0.9$.

### Loss Weighting
Binary Cross Entropy with Sample Weights $w_i$:
$$ w_i = \begin{cases} 1.0 & \text{if } y_i \in \{ \text{Interview, Reject} \} \text{ (Explicit)} \\ R_c & \text{if } y_i = \text{Ghosted} \text{ (Implicit Negative)} \end{cases} $$
*Result:* We learn heavily from explicit outcomes. We ignore ghosting from "Black Hole" companies.

---

## 5. ANTI-GAMING STRATEGY (Proactive)

**Strategy:** Manifold Density Estimation.
*Reasoning:* Gamers create "unnatural" statistics (e.g., 10k commits in 1 year with uniform distribution). Their embedding vector $u$ will drift away from the manifold of "Real Verified Engineers".

### Anomaly Score ($A_u$)
*   **Algorithm:** Isolation Forest trained on the validation set of $u$ vectors.
*   **Metric:** Path length in tree (shorter = anomaly).
*   **Penalty:** 
    $$ S_{final} = S_{MLP} - \lambda \cdot \mathbb{I}(A_u > \text{Threshold}) $$
    *   $\lambda = 3.0$ (Significant rank demotion).

### Safeguards
*   **Raw Features:** Never expose raw counts (LOC/Commits) to the Embedding model. Use only log-normalized or relative features.

---

## 6. RESUME BANDIT (Stable Form)

**Strategy:** Decaying $\epsilon$-Greedy with Propensity Logging.
*Reasoning:* Thompson Sampling requires accurate posterior updates which can be noisy. Epsilon-greedy is robust and guaranteed to converge.

### Configuration
*   **Exploration:** $\epsilon(t) = \max(0.05, 0.4 \cdot e^{-N_{job}/500})$.
    *   Guarantees 5% perpetual exploration to catch market shifts.
*   **Priors:** Beta(2, 8). Expect 20% success rate baseline.
*   **Logging:** Record `propensity_score` $P(\text{variant selected})$ for every event.
*   **Evaluation:** Inverse Propensity Weighting (IPW) offline estimator.

---

## 7. MACRO MARKET MODEL

**Strategy:** Sector-Segmented Moving Averages.
*Reasoning:* A hiring freeze in "Crypto" shouldn't hurt "Healthcare" scores.

### Implementation
1.  **Segments:** Define clusters $S$ (SaaS, Fintech, Health, EdTech).
2.  **Signal:** $MA_{30d}(S)$ = Rolling average interview rate in sector $S$.
3.  **Bias Term:** $\beta_{t,s} = \text{logit}(MA_{30d}(S))$.
4.  **Integration:** Additive Bias in final Sigmoid. 
    *   $P = \sigma(MLP(u, v) + \beta_{t,s})$.

---

## 8. MONITORING & DRIFT CONTROL

**Dashboard Metrics:**
1.  **Global AUC:** Rolling 7-day. Alert if < 0.65.
2.  **Calibration:** Expected vs. Observed Interview Rate.
3.  **Embedding Norm Variance:** Sudden spikes indicate encoder collapse or data poisoning.
4.  **Anomaly Rate:** % of users flagged as gamers. If >10%, threshold is too tight.
5.  **Bandit Regret:** Cumulative reward difference (Best Arm - Chosen Arm).
6.  **Macro $\beta$ Trends:** Visualizes market health.

**Retraining Trigger:**
*   Automatic: Weekly.
*   Emergency: If Global AUC drops > 5% in 24h.

---

## 9. PERMANENT EXCLUSIONS

The following are **forbidden**:
*   **IV Regression / Causal Inference:** (Requires untestable assumptions).
*   **Hamiltonian Monte Carlo (HMC):** (Too slow).
*   **Hierarchical Bayes per-Company:** (Too sparse).
*   **Inverse Hiring Optimization:** (Unreliable feedback loop).
*   **Recruiter Ground Truth Dependencies:** (Does not exist).

--------------------------------------------------------------------------------
PART 4: AUTONOMOUS TALENT INTELLIGENCE SYSTEM (2040-GRADE)
--------------------------------------------------------------------------------

## 1. The Dual-Brain Architecture
The system operates as a bicameral mind:
1.  **The Lizard Brain (Deterministic Core)**:
    -   High-speed (`<50ms`), vector-based, calibrated inference.
    -   Execution: `predict_match_score_v2`
    -   Authority: Final arbiter of "safety" and "baseline fit".
2.  **The Neocortex (probabilistic AI)**:
    -   Async, deep-reasoning, graph-based intelligence.
    -   Execution: `ingest-ai-layer`, `simulation-engine`
    -   Authority: Proposes "modifiers" and "strategies", vetted by the core.

## 2. New Intelligence Layers

### A. The Talent State Engine (`ml_talent_state`)
Instead of a static score, every candidate has a dynamic *State Vector*:
-   **Capability Index**: Verified technical depth (Skill Graph).
-   **Market Position**: Demand/Supply ratio for their specific skill mix.
-   **Attention Momentum**: First-derivative of recruiter views (is this candidate "heating up"?).
-   **Optionality Score**: How many diverse career paths are open to them?
-   **Credibility Index**: Cross-platform consistency score (Anti-Gaming).

### B. The Skill Graph Ontology (`ml_skill_graph`)
We moved beyond keyword matching to a temporal, evidence-based graph:
-   **Depth Score**: 0.0 (Novice) to 1.0 (Global Expert).
-   **Temporal Context**: `start_date` -> `end_date` per skill (e.g., "Used Rust 2018-2022").
-   **Evidence Source**: "GitHub" (High Trust) vs. "Resume" (Low Trust).

### C. The Simulation Engine (`ml_simulation_results`)
Background batch jobs run Monte Carlo simulations on candidate trajectories:
-   "If Candidate X learns `Rust`, their Offer Probability jumps +12%."
-   "If Candidate Y applies to `Series B Fintech`, their Optionality Index drops -5%."
-   Output: A `strategy_vector` recommending optimal career moves.

## 3. Governance & Control

### Dual-Brain Validation
-   If `Credibility Index < 0.3`, the deterministic core applies a **VETO** (`score = 0.1`), overriding any AI optimism.
-   AI influence is capped at **±30%** of the final logit. It cannot hallucinate a 99% match for an unqualified candidate.

### Bias Defense (`ml_recruiter_cognitive_model`)
-   We explicitly model recruiter bias (e.g., "Prestige Bias").
-   The Inference Engine *subtracts* this bias from the final display rank to ensure fair visibility.

## 4. Scalability Strategy
-   **Async Ingestion**: All AI heavy lifting happens in `ingest-ai-layer` (Edge Function), decoupling it from user-facing latency.
-   **Partitioning**: Tables like `ml_skill_graph` are designed for time-series partitioning.
-   **Vector Search**: `pgvector` remains the primary retrieval mechanism for the Lizard Brain.

--------------------------------------------------------------------------------
PART 5: AUTHORITY HIERARCHY & SAFETY (STRUCTURAL HARDENING)
--------------------------------------------------------------------------------

## 1. The Single Probability Authority Policy
> "There shall be only one source of truth for match probability."
> — System Directive 2026

The core probability function `predict_autonomous_score` allows **NO OVERRIDES**.
-   **Formula**: `P_final = σ( Base_Logit + Bounded_AI_Delta )`
-   **The Cap**: AI Influence is strictly clamped to **±30%** of the Base Logit's magnitude.
    -   `AI_Delta = Clamp(Raw_Delta, -0.3*|Base|, +0.3*|Base|)`
    -   This prevents the AI from "hallucinating" a high match when the core signal is weak.

## 2. The 7-Layer Authority Model
Strict hierarchy of control (Lower layers cannot override Upper layers).

1.  **Likelihood Layer** (Probability Output) - *Top Authority*
2.  **Deterministic Core** (Lizard Brain) - *The Arbiter*
3.  **Governance Layer** (Meta-Control) - *Can Trigger Reset*
4.  **Talent State Layer** (Derived) - *Read-Only Input*
5.  **AI Semantic Layer** (Neocortex) - *Advisory Signals*
6.  **Simulation Layer** (Futures) - *Hypothetical Only*
7.  **Ingestion Layer** (Raw Data) - *No Authority*

## 3. Firewalls & Isolation
-   **Simulation Firewall**: The Simulation Engine is **Read-Only** on the Talent State. It cannot effectively "imagine" a candidate into a better reality.
-   **Derived State**: `Talent State` is no longer learned; it is mathematically **derived** from `Skill Graph` + `Credibility`. This ensures reproducibility.
-   **Reputation Decay**: All reputation signals (Genome Stars, Offer Letters) have a **180-day half-life**. Past glory fades.

--------------------------------------------------------------------------------
PART 6: BEHAVIORAL INTELLIGENCE (PHASE 15)
--------------------------------------------------------------------------------

## 1. Funnel-Separated Probability
Probability is no longer a monolith. It is composed of distinct behavioral gates:
-   `P_seen` (Attention): Governed by **Company Activity Hours** & Response Velocity.
-   `P_read` (Fatigue): Governed by **Recruiter Cognitive Load** (Screening Fatigue Index).
-   `P_interview` (Fit): Governed by the **Deterministic Core** (Lizard Brain).

## 2. Friction Modeling
-   **Telemetry**: The Chrome Extension captures field count, CAPTCHAs, and time-to-fill.
-   **Impact**: High friction sites (`friction_index > 0.7`) are deprioritized by the **Simulation Engine** unless match potential is extreme (>90%).

## 3. Strict Calibration
-   **Z-Score Audit**: The Governance Engine performs a statistical test on the "70% Confidence Bucket".
-   **Trigger**: If observed interview rate deviates > 2σ from expected, a "Trust Collapse" alert is fired.

---

## 11. AUTHORITY HIERARCHY (REVISED)
1.  **Likelihood Layer** (Probability Output) - *Top Authority*
2.  **Deterministic Core** (Lizard Brain) - *The Arbiter*
3.  **Governance Layer** (Meta-Control) - *Can Trigger Reset*
4.  **Behavioral Layer** (Attention/Fatigue/Friction) - *Contextual Modifiers*
5.  **Talent State Layer** (Derived) - *Read-Only Input*
6.  **AI Semantic Layer** (Neocortex) - *Advisory Signals*
7.  **Simulation Layer** (Futures) - *Hypothetical Only*
8.  **Ingestion Layer** (Raw Data) - *No Authority*

---

## 10. ARCHITECTURE DIAGRAM (Logic Flow)

```text
[Candidate]       [Job/Company]
    |                  |
[Ingestion]       [Ingestion] --> [Sector Classifier] -> S
    |                  |
[Norm & Clean]    [Norm & Clean]
    |                  |
    +------------------+
    | Shared Backbone  | (Frozen SBERT/CodeBERT)
    +------------------+
    |                  |
[Proj Head A]     [Proj Head B] (Trainable 384->64)
    |                  |
    u (64-dim)         v (64-dim) <-- [Company Reliability R_c]
    |                  |
    +--------+         |
    | Anomaly|         |
    | Check  |         |
    +--------+         |
    | Flag A_u         |
    v                  v
[Interaction Generator] -> [u, v, u*v, |u-v|]
          |
    [Scoring MLP] (32 hidden -> 1 out)
          |
    Raw Logit Score
          |
          + <-- [Macro Bias beta_{t,S}]
          |
          + <-- [Anomaly Penalty lambda * A_u]
          |
    Final Sigmoid Score
          |
[Resume Bandit] --> Select Variant
          |
       [OUTPUT]
```
