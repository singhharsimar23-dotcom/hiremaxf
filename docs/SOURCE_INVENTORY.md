# HireMax Master Source Inventory
> Last Updated: 2026-04-10 | Authoritative Source: `infra/workers/config/sources.ts`

This document tracks the implementation and activation status of all 41 ingestion sources in the HireMax ecosystem.

---

## 🟢 ACTIVE PRODUCTION FLEET (10)
Highly stable, verified connectors currently contributing to the live database.

| Group | Slug | Label | Logic | Mapped? |
| :--- | :--- | :--- | :--- | :--- |
| ALPHA | `greenhouse` | Greenhouse | ✅ Found | ✅ Yes |
| ALPHA | `lever` | Lever | ✅ Found | ✅ Yes |
| ALPHA | `smartrecruiters` | SmartRecruiters | ✅ Found | ✅ Yes |
| ALPHA | `workable` | Workable | ✅ Found | ✅ Yes |
| ALPHA | `workday` | Workday | ✅ Found | ✅ Yes |
| BETA | `adzuna` | Adzuna | ✅ Found | ✅ Yes |
| GAMMA | `himalayas` | Himalayas | ✅ Found | ✅ Yes |
| GAMMA | `working-nomads` | Working Nomads | ✅ Found | ✅ Yes |
| GAMMA | `remote-ok` | Remote-OK | ✅ Found | ✅ Yes |
| GAMMA | `static-feed` | Aggregated Feeds | ✅ Found | ✅ Yes |

---

## 🔴 STANDBY / DISABLED (31)
Sources that are implemented but currently disabled for maintenance, repair, or stability audits.

| Group | Slug | Label | Logic | Mapped? | Note |
| :--- | :--- | :--- | :--- | :--- | :--- |
| ALPHA | `ashby` | Ashby | ✅ Found | ✅ Yes | Reliability Audit Fallback |
| ALPHA | `jobvite` | Jobvite | ✅ Found | ✅ Yes | - |
| ALPHA | `bamboohr` | BambooHR | ✅ Found | ✅ Yes | - |
| ALPHA | `recruitee` | Recruitee | ✅ Found | ✅ Yes | - |
| ALPHA | `personio` | Personio | ✅ Found | ✅ Yes | - |
| ALPHA | `teamtailor` | Teamtailor | ✅ Found | ✅ Yes | - |
| ALPHA | `comeet` | Comeet | ✅ Found | ✅ Yes | - |
| BETA | `jooble` | Jooble | ✅ Found | ✅ Yes | High Failure Rate |
| BETA | `careerjet` | Careerjet | ✅ Found | ✅ Yes | - |
| BETA | `reed` | Reed | ✅ Found | ✅ Yes | - |
| BETA | `usajobs` | USAJobs | ✅ Found | ✅ Yes | - |
| BETA | `dice` | Dice | ✅ Found | ✅ Yes | - |
| BETA | `builtin` | BuiltIn | ✅ Found | ✅ Yes | - |
| BETA | `findwork` | Findwork | ✅ Found | ✅ Yes | - |
| BETA | `indeed` | Indeed | ❌ Missing | ✅ Yes | Stub Only |
| BETA | `google-jobs` | Google Jobs | ❌ Missing | ✅ Yes | Stub Only |
| BETA | `linkedin-scout` | LinkedIn Scout | ✅ Found | ✅ Yes | - |
| BETA | `apify-bridge` | Apify Bridge | ✅ Found | ❌ No | - |
| GAMMA | `weworkremotely` | WWR | ✅ Found | ✅ Yes | - |
| GAMMA | `jobicy` | Jobicy Global | ✅ Found | ✅ Yes | - |
| GAMMA | `startup-board-custom` | Startup Board | ✅ Found | ❌ No | - |
| GAMMA | `yc-hn-feed-expansion` | YC/HN Feed | ✅ Found | ❌ No | - |
| DELTA | `otta` | Otta | ✅ Found | ✅ Yes | Scraper Sandbox |
| DELTA | `cord` | Cord | ✅ Found | ✅ Yes | Scraper Sandbox |
| DELTA | `hired` | Hired | ✅ Found | ✅ Yes | Scraper Sandbox |
| DELTA | `tech-board-scraper` | Tech Board | ❌ Missing | ❌ No | - |
| DELTA | `infra-scraper-html` | HTML Scraper | ✅ Found | ✅ Yes | - |
| DELTA | `company-custom-careers` | Custom Careers | ❌ Missing | ❌ No | - |

---

## Technical definitions

*   **Logic (Found/Missing):** Whether a corresponding `.ts` file exists in `infra/connectors/`.
*   **Mapped (Yes/No):** Whether an entry exists in `infra/adapters/registry.ts`.
*   **Status (Active/Standby):** Controlled by the `enabled` flag in `infra/workers/config/sources.ts`.

## Action Items
1.  **Repair `indeed` and `google-jobs`** — Registry entries exist but logic files are missing.
2.  **Consolidate Alpha Group** — Migrate remaining Alpha sources to the Elite Interface.
3.  **WIPE Legacy Connectors** — Delete duplicated files in `core/shared/shared-core/connectors/`.
