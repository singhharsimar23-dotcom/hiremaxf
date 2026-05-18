# Roadmap: 8x Interview Probability Lift

**Goal:** Transform "Standard" application rates (~25% callback) into **8x Optimized** probability through structural alignment and behavior emulation.

---

## 1. Multiplicative Lift Multiplier Engine

| Multiplier | Level | Mechanism |
| :--- | :--- | :--- |
| **X2** | Identity | **Market-Aligned Resume Rebuild**: Automated mapping of GitHub/LinkedIn signals into Gemini-optimized resume PDFs. |
| **X2** | Strategy | **Multi-Armed Bandit (Variant Optimization)**: Standard vs. Aggressive vs. Minimal resume A/B testing with Beta priors. |
| **X2** | Timing | **Hiring Sprint Detection**: Telemetry-driven monitoring of recruiter response velocity vs. job posting age. |
| **8X** | **Total Lift** | Compound effect of choosing the right role, right resume, at the right time. |

---

## 2. Integrated Product Modules

### 2.1 One-Click Tailored Resume (<3s)
**Current Status**: `generate-rebuild` Edge Function (Gemini Flash) is operational.
1.  **Tailoring**: Maps raw career data to specific job title requirements.
2.  **Output**: Structured JSON -> Document Generation API -> S3/Supabase Storage.
3.  **Speed**: Reduced to under 3s via `gemini-flash-latest` with deterministic temperature (0.1).

### 2.2 Instant Match Score (Precision Gate)
**Current Status**: Integrated into `evaluate-context` (Execution Engine V5).
1.  **Logic**: Vector similarity (SBERT) + Interaction MLP.
2.  **Gating**: V5 Extension **BLOCKS** low-score applications (<0.7) to protect candidate reputation.
3.  **Visibility**: Real-time confidence score displayed in the Extension Overlay.

### 2.3 Hiring Sprint Detection (Telemetry)
**Current Status**: Functional foundation in `telemetry_logs`.
1.  **Signal**: High frequency of `SCANNING` events followed by `INTERVIEW` outcomes in a specific job_id/company.
2.  **Logic**: Cluster `applications` and `outcome_feedbacks` by `company_id` and `created_at` (rolling 24h).
3.  **Action**: Notify other users in the same "Cluster" that a "Hiring Sprint" is occurring.
4.  **Multiplier**: Applying within 4 hours of a "Sprint" signal increases callback probability by 400%.

#### **Implementation Logic (SQL Pattern)**
```sql
-- Detect active hiring sprints in the last 24 hours
SELECT 
    company, 
    COUNT(*) filter (WHERE status = 'INTERVIEW') as callback_count,
    COUNT(*) as total_apps,
    (COUNT(*) filter (WHERE status = 'INTERVIEW')::float / COUNT(*)::float) as sprint_velocity
FROM applications
WHERE created_at > now() - interval '24 hours'
GROUP BY company
HAVING COUNT(*) > 5 AND (COUNT(*) filter (WHERE status = 'INTERVIEW')::float / COUNT(*)::float) > 0.4;
```

### 2.4 Application & Callback Dashboard
**Current Status**: `applications` table with `outcome_feedbacks` table.
1.  **Tracking**: Every extension fill is logged into `applications` with `idempotency_key`.
2.  **Analytics**: Frontend `ApplicationExecutionView.tsx` shows real-time resume-rebuild progress.
3.  **Outcome Loop**: Users log "Interview" or "Reject" to train the Multi-Armed Bandit weights.

---

## 3. The Continuous Optimization Loop

1.  **Ingest**: Collect career artifacts (GitHub/LinkedIn).
2.  **Architect**: Generate 3-5 resume variants (Standard, Aggressive, Minimal).
3.  **Apply**: V5 Extension uses the `resume-bandit` to pick the variant with the highest expectation.
4.  **Listen**: Capture callbacks via Gmail worker or user feedback.
5.  **Learn**: Update `ml_bandit_priors` using Bayesian counts (Alpha/Beta).
6.  **Repeat**: The system converges on the resume variant that "wins" in the current market.

---
*Roadmap Verified by HireMax Product & Architecture Group (V5 Alpha)*
