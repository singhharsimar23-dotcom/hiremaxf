# Greenhouse & Multi-ATS Ingestion Pipeline: Standard Operating Procedure (SOP)

This document outlines the standard configuration, debugging patterns, and high-velocity architecture for the HireMax ingestion engine using the **Trusted Core** model.

---

## 1. SYSTEM OVERVIEW (TRUSTED CORE)

The ingestion pipeline follows a high-density, autonomous architecture where **Ingress Workers** serve as thin clients to a centralized **Trusted Core Engine**.

1.  **Orchestration (Worker)**: A Cloudflare Worker (`infra/workers/index.ts`) triggers specific ingestion groups (ALPHA, BETA, GAMMA) via cron or HTTP.
2.  **Extraction (Connector)**: The worker uses stateless connectors (`infra/connectors/`) to fetch raw job listings from ATS APIs or scrapers.
3.  **Normalization & Identity (Trusted Core)**: Data is piped through the Core (`core/ingestion-engine/`). 
    - **Normalization**: Maps raw fields to the HireMax schema.
    - **Identity**: Generates a deterministic SHA-256 fingerprint for deduplication.
4.  **Persistence**: The Core upserts directly into the `job_pointers` table. No intermediate payload queues or S3 archival are required.

---

## 2. COMPONENT BREAKDOWN

| Component | Responsibility | Path |
| :--- | :--- | :--- |
| **Ingestion Worker** | Orchestration & Triggers | `infra/workers/index.ts` |
| **Enrichment Worker**| Groq-powered AI metadata | `infra/workers/enrichment.ts` |
| **Connectors** | ATS-specific fetching | `infra/connectors/` |
| **Trusted Core** | Normalization, Scoring, Identity | `core/ingestion-engine/` |
| **Shared DB** | Canonical DB interaction | `core/shared/db/jobs.ts` |

---

## 3. BEST PRACTICES (ADDING A NEW SOURCE)

To activate a new board (e.g., a new Greenhouse company):

1.  **Target Discovery**: 
    - For Greenhouse: Add the subdomain slug to `infra/workers/config/sources.ts`.
    - For Ashby/Lever: Ensure the company ID is registered in the appropriate connector config.
2.  **Validation**:
    - Trigger a manual run via `POST /` with `{"group": "alpha"}`.
    - Check `job_pointers` for new entries with the corresponding `source`.
3.  **Enrichment**:
    - The enrichment worker automatically picks up any `unenriched` jobs every 30 minutes.

---

## 4. TROUBLESHOOTING

| Issue | Detection | Remedy |
| :--- | :--- | :--- |
| **Rate Limiting** | 429 errors in logs | Workers automatically stop batches on 429. Monitor for persistent blocks. |
| **Invalid JSON** | `UNPARSEABLE_PAYLOAD` | Check if the ATS API changed or if the connector mapping is stale. |
| **Drift** | Duplicate jobs in DB | Verify identity generation in `core/ingestion-engine/core/persistence.ts` (`generateIdentity`). |

---

## 5. DEPLOYMENT

Workers are deployed via Wrangler:
```bash
npx wrangler deploy
```

Deployment configuration is managed in `wrangler.toml` at the project root.
