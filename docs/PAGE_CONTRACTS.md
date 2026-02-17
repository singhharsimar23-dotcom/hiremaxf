# Page Contracts: UI Infrastructure

This document defines the behavior, data requirements, and side effects of the primary application views.

## 1. Landing Page (`LandingPage.tsx`)
- **Purpose**: Top-of-funnel conversion and feature overview.
- **Inputs**: None.
- **Side Effects**: Reads auth state to determine "Get Started" destination.
- **Invariants**: Must render without authentication.

## 2. Profile / Identity Ingestion (`ProfileView.tsx`)
- **Purpose**: Primary interface for forensic signal ingestion and identity state visualization.
- **State Sovereignty**: Owns the transition from "Raw Data" to "Forensic Snapshot".
- **Inputs**: `UserProfile`, `profile_snapshots` (latest), `ingestion_sessions` (active).
- **Side Effects**:
    - Triggers `ingest-identity` Edge Function.
    - Initiates OAuth flows (LinkedIn/GitHub).
    - Polling: Watches for session convergence.
- **Invariants**: 
    - Cannot initiate ingestion without active user session.
    - Displays "High Evidence Density" only if `overall_score > 75`.

## 3. Dashboard (`App.tsx` > Dashboard View)
- **Purpose**: System-wide status overview and quick actions.
- **Inputs**: `profiles`, `analyses`, `execution_runs`.
- **Side Effects**: 
    - Rehydrates active jobs from local storage and DB.
    - Polls `execution_runs` for background job status.
- **Invariants**: Always shows the latest `Foundation Score` from the most recent analysis.

## 4. Execution Engine (`ApplicationsView.tsx`)
- **Purpose**: Automated job application manager.
- **Inputs**: `applications`, `job_pointers`.
- **Side Effects**: Mutates `applications` state via background workers.
- **Status Invariants**: `IDENTIFIED` -> `SUBMITTED` | `REJECTED`.

## 5. Resume Builder (`ResumeBuilder.tsx`)
- **Purpose**: IDE for professional document optimization.
- **Inputs**: `resume_versions`, `resumes`.
- **Side Effects**: Generates new entries in `resume_versions`.
- **Legacy Note**: Overlaps with Identity Engine; Identity Engine is now the authoritative source for data, but Resume Builder remains a presentation layer.
