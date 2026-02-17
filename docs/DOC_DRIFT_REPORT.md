# Documentation Drift Report: Identity Engine

This report identifies contradictions between legacy documentation and the current v2.5 production reality.

## 1. Major Contradictions

| Topic | Doc Claim (Stale) | Reality (Authoritative v2.5) | Drift Level |
| :--- | :--- | :--- | :--- |
| **Ingestion Workers** | "Stage-A extraction implemented" (`PROJECT_HANDOFF.md`) | Full Forensic Ingestion (v2.5) with Convergence Gate and Temporal Decay. | **HIGH** |
| **Snapshot Builder** | "Non-Intelligent Extraction" (`INGESTION_ARCHITECTURE.md`) | Mathematical synthesis with `signal-math.ts` weighing signals by provenance. | **MEDIUM** |
| **Data Integrity** | Manual Resync only (`INGESTION_ARCHITECTURE.md`) | Automatic `snapshot-builder` trigger upon session convergence. | **MEDIUM** |
| **Provenance** | Not mentioned; broad "truth" claims. | Strict `extraction_method` invariants (`verified`, `parsed`, `synthetic`). | **HIGH** |
| **Security** | Not explicitly documented in legacy. | Active SSRF Guard and Spoof Guard at the network boundary. | **LOW** (Gap) |

## 2. Terminology Evolution

The system has moved from marketing-led terms to forensic-led terms. Old docs should be read with the following translation key:

- **"Verified Identity"** → **"High Evidence Density"**
- **"God Mode"** → **"Market Intelligence Engine"**
- **"Artifact Ingestion"** → **"Forensic Signal Ingestion"**
- **"Snapshot Logic"** → **"Convergent Identity State"**

## 3. Superseded Files
The following files are considered **LEGACY** and should not be used for operational debugging:
- `backend/ingestion/README.md`
- `INGESTION_ARCHITECTURE.md` (Sections 1 & 2 only)
- `PROJECT_HANDOFF.md` (Status sections are outdated)

## 4. Current Blind Spots in NEW Documentation
- Detailed internal logic of `worker-gmail` regarding ATS parsing remains partially inferred from code; the exact regex list is not documented.
- The lifecycle of `profile_outcomes` is still experimental and not yet integrated into the `snapshot-builder` weightings.
