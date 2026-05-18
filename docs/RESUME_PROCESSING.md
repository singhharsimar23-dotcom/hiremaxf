# Resume Processing
> Last Updated: 2026-03-11

---

## Upload

Resumes enter the system through two paths:

### Path 1: PDF Upload (Primary)
User uploads a PDF in `ProfileView.tsx`. File is stored in Supabase Storage under `resumes/{user_id}/`. The `resume_id` is stored on the `profiles` row.

### Path 2: Manual Text Entry
Users can type or paste resume text directly in the `ResumeBuilder.tsx` component. The structured `StructuredResume` object is persisted to `profiles.resume_profiles` as JSON.

---

## Parsing

### Text Extraction
- PDF → text extraction happens in the `generate-diagnostic` Edge Function using Gemini's document understanding
- HTML parsing for LinkedIn profiles via the OAuth ingestion path

### Structured Extraction
The LLM structures raw text into the `StructuredResume` TypeScript interface:

```typescript
interface StructuredResume {
  contact: { full_name, email, phone, location, links };
  summary: string;
  experience: { title, organization, dates, bullets[] }[];
  education: { institution, degree, dates, details }[];
  projects: { name, description, impact }[];
  skills: {
    languages: string[];
    frameworks: string[];
    tools: string[];
    specializations: string[];
  };
  leadership: { role, description }[];
}
```

Multiple `ResumeProfile` records can coexist per user (for different target roles).

---

## Embedding

**Model:** Gemini embedding API (text-embedding-004 or compatible)
**Dimension:** 1536 (stored as `VECTOR(1536)` via pgvector)
**Location:** `ml_candidate_embeddings.embedding`

The embedding encodes the full semantic meaning of the candidate's professional profile for vector similarity comparison against job postings.

Additional metadata stored with the embedding:
- `confidence_score`: 0–1 embedding reliability measure
- `is_anchored`: whether the embedding has been validated against verified profile data
- `verified_skills`: explicitly confirmed skills extracted from the resume
- `channel_coherence_score`: consistency of signals across resume, GitHub, LinkedIn

---

## Fields Extracted

| Field | Storage | Used By |
|-------|---------|---------|
| Skills | `career_skills`, `ml_candidate_embeddings.verified_skills` | Domain 3 (Recruiter Surface) |
| Experience roles/durations | `career_work_history` | Domain 1 (Candidate Strength) |
| Location | `profiles.metadata`, `profile_snapshots.snapshot_data` | Location normalization |
| Education | `career_education` | Resume rebuild, analysis |
| Projects | `career_projects` | `impact_density` signal |
| Seniority score | `candidate_feature_vectors.seniority_score` | Domain 1 (βMultiple sub-signals) |
| System design depth | `candidate_feature_vectors.system_design_depth` | Domain 1 `architecture_scope` |
| Project complexity | `candidate_feature_vectors.project_complexity` | Domain 1 `impact_density` |
| GitHub OSS contributions | `career_oss_contributions` | `profile_health` signal |
| Publications | `career_publications` | Evidence ledger |

---

## Feature Extraction

The `extract-candidate-features` Edge Function reads the structured resume and computes feature scores for the decision engine:

```typescript
{
  seniority_score: 0.0–1.0,        // Estimated years normalized
  technical_depth: 0.0–1.0,        // Stack complexity
  system_design_depth: 0.0–1.0,    // Architecture terminology density
  project_complexity: 0.0–1.0,     // Quantified impact in projects
  distributed_systems_experience: bool,
  machine_learning_experience: bool,
  domain_expertise: string[],
  capability_vector: VECTOR(5)     // Compact 5-dim embedding of capabilities
}
```

These features drive the `computeCandidateSignals()` function in `decision-engine.ts`.

---

## Profile Snapshot

After resume upload and analysis, a versioned `profile_snapshot` is created:
```sql
INSERT INTO profile_snapshots (
  user_id, version, snapshot_data, signal_health
)
```
`snapshot_data` contains the full structured profile. `signal_health.overall_score` (0–100) feeds into `profile_health` in the decision engine.

The latest snapshot (highest `version`) is always used for scoring.

---

## Resume Analysis Pipeline

```
PDF Upload
    ↓
generate-diagnostic (Gemini)
    ↓
8-Point Scoring (overallScore)
    ├── Foundation: ATS Shield, Readability, Market Readiness
    ├── Atomic Changes (before/after for each weakness)
    ├── Persona Forecasts (FAANG / STARTUP / AI_TEAM)
    ├── Signal Chips (atsIntegrity, ownershipMarkers, architecturalScope, seniorityCoherence)
    ├── Application Window (GREEN / YELLOW / RED)
    └── DecisionOutput (matchScore, interviewProbability, applicationPriority)
    ↓
Results stored in analyses table + returned to UI
```

---

## Resume Optimization (Singularity Rebuild)

The `generate-rebuild` function orchestrates the transformation into a FAANG-ready document. This is now an **asynchronous, queue-backed 8-stage process**.

### The 8-Stage Lifecycle:
1. **Queue Injection**: Producer (`generate-rebuild`) validates the **5-D Idempotency Key** and enqueues to `pipeline_jobs`.
2. **Context Synthesis**: Worker fetches JD snapshot, previous violations, and match intelligence.
3. **Bandit Selection**: Selects a stylistic variant (BIG_TECH, STARTUP, FAANG_LEAN).
4. **Generation (Stage 5)**: Produces structured resume data.
5. **Validation (Stage 6)**: Parallelized Anti-Hallucination Gate (Skills, Experience, Metrics).
6. **Quality Gate (Stage 7)**: Scans for "AI Slop", Verb Density, and Metric Density.
7. **Auto-Repair Loop**: If Stage 7 score is 0.5–0.8, the worker re-generates (Max 2 attempts) with repair hints.
8. **Feature Export**: Successful resumes have structural features (e.g. metric density) extracted for pattern learning.

---

## Queue & Reliability

The system implements a hardware-grade state machine to ensure zero-loss processing.

### Job States:
- `PENDING`: Waiting for a worker.
- `PROCESSING`: Claimed by a worker (locked via `locked_at`).
- `COMPLETED`: Success.
- `FAILED`: Terminal failure (e.g., Hallucination detected).
- `RETRYING`: Transient failure (retry up to 3 times).
- `DEAD_LETTER`: Max retries exceeded.

### Reliability Controls:
- **Idempotency**: Hash components `(user_id, job_id, snapshot_id, violation_memory, model_version)`.
- **Backpressure**: Max 3 concurrent jobs per user.
- **Heartbeat**: Worker updates `locked_at` after every successful stage.
- **Atomic Claiming**: Uses `FOR UPDATE SKIP LOCKED` via RPC.

---

## Storage

| Data | Table | Format |
|------|-------|--------|
| Raw PDF | Supabase Storage (`resumes/`) | Binary |
| Structured resume | `profiles.resume_profiles` | JSONB array |
| Resume versions | `resume_versions` | JSONB |
| Analysis results | `analyses.results_json` | JSONB |
| Embedding | `ml_candidate_embeddings.embedding` | VECTOR(1536) |
| Feature vector | `candidate_feature_vectors.capability_vector` | VECTOR(5) |

---

## Current Weaknesses

1. **`candidate_feature_vectors` sparsity** — Most users don't have populated feature vectors because `extract-candidate-features` must be explicitly triggered. The decision engine defaults all feature scores to `0.4`.
2. **No PDF re-parsing on update** — When a user uploads a new resume version, re-embedding is not automatically triggered.
3. **GitHub integration is raw data only** — `career_oss_contributions` is populated but not computed into a structured `github_score` that feeds the decision engine.
4. **Single embedding per user** — One embedding represents all resume versions. Users targeting multiple roles should have separate embeddings per profile.
