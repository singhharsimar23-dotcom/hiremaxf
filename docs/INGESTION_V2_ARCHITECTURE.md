# Ingestion V2 — AI-Controlled, Deterministic Core

## Objective

Build a scalable, reliable user intelligence system using:
* Cheap LLMs (e.g., LLaMA) for extraction
* Deterministic system for stability
* High-tier LLM (e.g., Gemini) for final reasoning

---

## Core Principle

**AI extracts → System stabilizes → Gemini decides**

---

## Pipeline

### 1. Input Layer
**Sources:**
* LinkedIn (PDF / text / URL)
* GitHub
* Kaggle
* Resume

All inputs converted to the following schema before proceeding:
```json
{
  "user_id": "uuid",
  "source": "string",
  "raw_blob": "binary/string"
}
```

### 2. Raw Storage (R2 / S3)
* Stored in R2 (batched writes).
* No processing before storage.
* Used purely for replay + audit.
* **Format:**
  ```json
  {
    "user_id": "uuid",
    "source": "linkedin | github | resume",
    "hash": "string",
    "timestamp": "iso-date"
  }
  ```
* **Rules:** Write once, never update, rarely read, always referenced by ID (not fetched blindly).

### 3. Extraction Layer (LLaMA)
LLaMA extracts structured JSON out of the Raw Storage blob.
* Strict JSON only.
* No scoring, no reasoning, no calculations.
* **Format:**
  ```json
  {
    "experience": [],
    "education": [],
    "skills": []
  }
  ```

### 4. Validation Layer
* **Schema validation:** Strictly required (e.g., Zod validator).
* **Retry:** Re-trigger LLaMA if JSON is invalid or malformed.
* **Reject:** Hard fail if the blob is corrupted or repeatedly invalid.

### 5. Normalization (Light Deterministic)
* Minimal cleaning only. No heavy logic or LLMs used here.
* Examples: trim text, lowercase fields, basic role/seniority mapping.

### 6. Evidence Ledger (Supabase)
All extracted signals are broken down and stored as atomic units.
* **Schema unit:**
  ```json
  {
    "type": "string",
    "value": "string/json",
    "source": "string",
    "confidence": "number",
    "timestamp": "iso-date"
  }
  ```

### 7. Cross-Source Engine
Compares signals across sources (e.g., LinkedIn vs. Resume vs. GitHub).
* **Detect:** Contradictions, weak claims, verified strengths.

### 8. Final Intelligence (Gemini)
Gemini is used strictly at the end of the pipeline.
* **Used only for:** Conflict resolution, complex profile interpretation.
* **Output:** Profile snapshot, signal coherence rating, top strengths / risks.

---

## The Two-Tier Storage Model

### 1. R2 / S3 (RAW — CHEAP, WRITE-ONCE)
**"The System Memory" (Raw Truth Archive)**

Store ONLY unprocessed, heavy, replayable data:
* Resume PDFs
* LinkedIn raw text / PDF dump
* GitHub raw JSON (repos, commits if large)
* Kaggle / ResearchGate raw HTML
* Full ingestion payload snapshots
* Debug logs (optional, batched)

### 2. SUPABASE (STRUCTURED — QUERY, DECISION)
**"The System Brain" (Structured Intelligence)**

Store ONLY processed, usable intelligence.

**Core Tables:**
* `evidence_ledger`
* `career_work_history`
* `career_skills`
* `career_education`
* `career_projects`
* `profile_snapshots`
* `ml_candidate_embeddings`
* `candidate_feature_vectors`

**Also Store:**
* Ingestion status (`ingestion_commands`)
* Error logs (`ingestion_logs`)
* Integrity events

---

## ⚔️ Crucial Link Between Both
Every structured record in Supabase MUST reference its raw origin in R2:
```json
{
  "raw_reference_id": "r2_object_key"
}
```
**Benefits:** Traceability, ability to reprocess entirely, and audit control.

---

## Cost Strategy

* **LLaMA = Default** (Used for all heavy text extraction).
* **Gemini = Fallback / Final Only** (Used exclusively for synthesis and decision making).
* **Cache all outputs:** Do not compute the same snapshot or validation twice.
* **No duplicate processing:** Deterministic hashing prevents re-running ingestion for the exact same input blob.

---

## Non-Negotiables & Rules ❌

* **NO** raw LLM output stored without strict schema validation.
* **NO** duplicate ingestion allowed.
* **NO** direct UI → worker calls. The flow must go through the orchestrator.
* **NO** storing raw PDFs or large text blobs in the DB.
* **NO** querying R2 in real-time user flows.
* **NO** running LLMs directly on raw DB data in realtime.

---

## System Access Pattern

* **Ingestion:** R2 Write → LLaMA Extraction → Supabase Insert
* **Runtime (Product Use):** ONLY Supabase (Read/Write)
* **Debug / Reprocess:** Supabase query → Fetch R2 blob via `raw_reference_id` → Re-run extraction pipeline

> **Goal:** The system must understand the user better than they understand themselves, instantly detect inconsistencies, and remain completely stable under massive scale.
