# HireMax System Handoff Documentation (v8.0)

## 1. Project Overview
**HireMax** is a decoupled career execution environment:
- **The Factory**: Ingestion, signal normalization, and profile architecture (Building Truth).
- **Applications Engine**: Job consumption, deterministic ranking, profile-aware matching, and throttled market execution.

---

## 2. Transformation Factory (Profile Truth)
The Factory handles data processing and profile construction.
- **Signal Normalization**: Technical artifacts (GitHub/LinkedIn) converted to immutable Signals.
- **5-Profile System**: 5 distinct resume variants (e.g., Staff SWE, Product Engineer, Infra Specialist).
- **Achievements**: Structured achievements linked to signals, not specific documents.

---

## 3. Applications / Execution Engine (DEEP DIVE)

The Execution Engine is a stateless environment responsible for translating profile truth into market impact.

### 3.1 Ranking & Prioritization Engine
Every discovered job is scored (0-100) before action is considered.

| Component | Weight | Logic |
|-----------|--------|-------|
| **Recency** | 30 | <24h (Max), 24-48h (High), >96h (Aggressive Decay). |
| **Fit Score**| 30 | Skill overlap + seniority alignment with Profile Signals. |
| **Intent** | 20 | Repost detection, hiring momentum, funding indicators. |
| **Competition**| 10 | Favoring new postings/low-saturation sources. |
| **Reliability**| 10 | Source Tiers (ATS > Aggregator > Social). |

*Note: Jobs failing the minimum "Fit Score" threshold are automatically purged from the deployment loop.*

### 3.2 Resume ↔ Job Matching Engine
HireMax utilizes the **5-Profile System** for every deployment run.
1. **Selection**: Scores all 5 profiles against job requirements; selects highest scoring variant.
2. **Gap Analysis**: Identifies missing keywords and under-emphasized technical signals.
3. **Customization**: Generates atomic instructions (bullet reordering, keyword injection) for the selected variant *without* mutating the original profile.

### 3.3 Apply-Rate Throttling & Safety Engine
Ensures execution remains safe, non-human-detectable, and compliant.
- **Global Limits**: Caps on daily/hourly submissions (default 50/day).
- **Source Constraints**: ATS handlers have higher tolerance; LinkedIn handlers have strict session-bound caps.
- **Kill Switch**: Immediate termination on CAPTCHA detection, account warnings, or auth volatility.
- **Burst Control**: Mandatory randomized delays (avg. 420s) between sequential submissions.

### 3.4 Execution Orchestrator
Stateless coordinator for the lifecycle of an application run.
1. Assigns a unique `execution_id`.
2. Sequentially processes ranked targets.
3. Requests permission from **Guard** (Throttling).
4. Executes **Matcher** for job-specific variant.
5. Records immutable audit log of the submission outcome.

---

## 4. Signal Architecture & Database Schema
- **`signals`**: Hot-table of technical markers (0-100).
- **`execution_runs`**: Stateless logs of discovery and deployment sessions.
- **`resume_profiles`**: The 5 persistent variants managed by the Factory.

---

## 5. Intelligence Layer (Gemini Logic)
- **Engine Logic**: `gemini-3-flash-preview` handles high-volume ranking and matching.
- **Synthesis Logic**: `gemini-3-pro-preview` handles complex market command outlooks and high-fidelity customization instructions.

---

## 6. Implementation Notes for Engineers
- **Statelessness**: Never store execution state in the user profile. Use `execution_runs`.
- **Throttling**: The Throttling engine is the final gate. No application can proceed without its `PASS` bit set.
- **Customization**: Custom resumes are session-scoped. Always store the specific instruction set used for a submission to allow for "Reconstructive Proof" if needed.

**Status**: ARCHITECTURALLY FINALIZED. Subsystems 1-4 are wired for production deployment.
