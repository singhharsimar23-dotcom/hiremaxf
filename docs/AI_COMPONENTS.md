# AI Components
> Last Updated: 2026-03-11

---

## Embedding Model

**Provider:** Google Gemini (via Gemini API)
**Model used for embeddings:** `text-embedding-004` (or compatible Gemini embedding endpoint)
**Vector dimension:** 1536
**Storage:** pgvector `VECTOR(1536)` column in `ml_candidate_embeddings`

---

## Use Cases

| Use Case | Function | Input → Output |
|----------|----------|---------------|
| Resume embedding | `generate-diagnostic` | Resume text → `VECTOR(1536)` stored in `ml_candidate_embeddings` |
| Resume analysis | `generate-diagnostic` | Structured resume → 8-point score, atomic changes, persona forecasts |
| Resume rebuild | `generate-rebuild` | Resume + analysis → optimized `StructuredResume` |
| Market command | `generate-outlook` | Candidate profile + market data → `MarketCommandSnapshot` |
| Job field classification | `execution-engine/evaluate-context` | DOM field inventory → field type mapping |
| Essay generation | `execution-engine/generate-rich-answers` | Custom question + resume context → essay answer |
| Match explanation | `hiring-engine` / `match-analyst` | Deterministic scores → natural language explanation & strategic advice |

---

## Prompt Systems

### 1. Resume Diagnostic Prompt (`generate-diagnostic`)

**Architecture:** Two-stage pipeline
1. **Stage 1:** Parse raw resume PDF/text into `StructuredResume` JSON
2. **Stage 2:** Score the structured resume with the 8-point framework

**Stage 2 Prompt Structure:**
```
SYSTEM: You are a senior technical recruiter at a top-tier tech company.
You evaluate resumes using 8 dimensions. You will receive:
  - Structured resume JSON
  - Target role
  - AUTHORITATIVE deterministic scores (DO NOT OVERRIDE)

Return a JSON with:
  - eightPoints[] (each with id, name, score 0-10, explanation, riskHint)
  - atomicChanges[] (dimension, before, after, logic)
  - personaForecasts: { FAANG, STARTUP, AI_TEAM } each with sentiment, observation, fix, delta
  - signalChips: { atsIntegrity, ownershipMarkers, architecturalScope, seniorityCoherence }
  - applicationWindow: { state, estimatedHoursToReadiness, blockers, accelerators }
  - decisionOutput: { matchScore, interviewProbability, applicationPriority, applicantCompetitiveness }
```

**Key prompt constraint:** The `interviewProbability` value in the LLM output MUST match the deterministic value computed by `decision-engine.ts`. The LLM is explicitly told "these values are AUTHORITATIVE — DO NOT MODIFY."

### 2. Resume Rebuild Prompt (`generate-rebuild`)

Takes the diagnostic analysis and produces a rewritten version of the resume:
- Rewrites experience bullets with quantified metrics
- Adds missing critical skills contextually
- Replaces soft/passive language with ownership language ("I built", "I led")
- Adjusts seniority framing to match target role level
- Maintains ATS-parseable structure (no tables, no columns, no graphics)

### 3. Market Command Prompt (`generate-outlook`)

Generates a 7-day tactical market intelligence report for the candidate's target role:
- Market status: Bullish / Bearish / Neutral for the role
- Execution targets: Top 3–5 companies to apply to this week with fit reasoning
- Do-not-apply zone: Companies to avoid (budget freeze, recent layoffs, over-hired)
- Action orders: Next 7 days, next 30 days, positioning directives
- Interview directives: Specific talking points for technical screens

**Input:** Latest `profile_snapshot`, `market_signals`, `company_health_signals`
**Output:** `MarketCommandSnapshot` stored in `market_snapshots`

### 4. Field Classification Prompt (`execution-engine/evaluate-context`)

Takes a list of DOM fields from an ATS form and maps them to field types:
```
{
  fields: [ { selector: "#field_12345", label: "Preferred Name", placeholder: "..." } ],
  resume_context: { first_name, last_name, email, ... }
}
→
{
  fills: [ { selector: "#field_12345", field_type: "first_name", value: "John" } ],
  ambiguous: [ ... ]
}
```

Results are cached in `dom_knowledge_base` to avoid repeated LLM calls for the same ATS form.

### 5. Rich Answer Generation (`execution-engine/generate-rich-answers`)

For custom essay questions on ATS forms:
```
Input: question text + resume context
Output: 200-400 word answer that:
  - Grounds claims in the actual resume
  - Mirrors the company's language from the job description
  - Does not hallucinate experiences
```

---

## Cost Control

| Mechanism | Implementation |
|-----------|---------------|
| **Diagnostic caching** | `analyses` table — if fresh analysis exists (< 7 days), returned without new LLM call |
| **DOM caching** | `dom_knowledge_base` — field classifications cached per URL+hash |
| **Market snapshot caching** | `market_snapshots` — snapshots valid for 7 days; no regeneration if fresh |
| **Batch embedding** | Profile snapshots are embedded once per ingestion, not per analysis |
| **Credit system** | Each LLM call costs credits from `profiles.credits`; `Starter` plan has hard limits |
| **Token limits** | Resume analysis prompts capped at ~8k tokens input; rebuild at ~12k |

---

## LLM Guardrails

1. **Deterministic-first principle** — All numerical scores computed before LLM. LLM explains, never re-computes.
2. **Schema-enforcement** — All LLM responses are expected as strict JSON. Invalid JSON causes retry (up to 2x).
3. **Hallucination guard in field classification** — Autofill values come from `profiles` data, not from LLM generation. LLM only classifies field types.
4. **No PII in training** — Prompt construction ensures resume data is sent per-request, not stored as training examples.

---

1. **Job embeddings density** — While job embeddings are being integrated via the enrichment pipeline, coverage is not yet 100% across the historical `job_pointers` set.
2. **No resumption on LLM timeout** — If Gemini times out mid-analysis, the entire diagnostic must be restarted. No partial result recovery.
3. **One embedding per user** — Users targeting multiple roles (e.g., backend and ML) share a single embedding. Separate embeddings per `ResumeProfile` would dramatically improve matching.
4. **DOM cache staleness** — `dom_knowledge_base` has no TTL. ATS form updates (common during Greenhouse/Lever version upgrades) will serve stale field classifications until manually cleared.
5. **Credit system not actively enforced** — The credit deduction logic is in multiple places but not centrally enforced via a single atomic transaction.
