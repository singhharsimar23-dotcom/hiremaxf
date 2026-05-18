# Engineering Rules
> Status: Mandatory — apply to all changes
> Last Updated: 2026-03-11

---

## 1. Deterministic-First Principle

**The LLM explains. It never computes.**

All numerical scores (`interview_probability`, `candidate_strength`, `market_pressure_score`, etc.) are computed by `decision-engine.ts` before any LLM call. The LLM receives these numbers and explains them in natural language. The LLM is explicitly told in the prompt: `"DO NOT OVERRIDE THESE VALUES."` 

**Violation:** Any LLM prompt that asks the LLM to compute `P(interview)` from resume text.
**Rule:** The LLM receives pre-computed scores as input. It generates explanations as output.

---

## 2. Do Not Break Existing Functionality

**All changes must be additive unless explicitly removing a deprecated system.**

Before any schema change, ask:
- Does any Edge Function SELECT from this table?
- Does any migration reference this column?
- Does the frontend type system reference this field?

Before any function signature change in `_shared/`:
- All Edge Functions that import the shared module will redeploy automatically. Verify the change compiles across all callers.

**Violation:** Renaming an RPC return column that the frontend destructures.

---

## 3. Job Deduplication Is Always Via SHA-256 Fingerprint

```typescript
fingerprint = SHA-256(
  normalize(company) + '|' + normalize(title) + '|' + normalize(location)
)
```

Where `normalize = lowercase, strip non-alphanumeric characters`.

**Never** insert a job without checking for fingerprint collision first. **Always** use `maybeSingle()` before insert, not `single()` (which throws on null).

**Violation:** Inserting jobs directly without fingerprint deduplication.

---

## 4. Governor Gate on All Write Operations

Any Edge Function that writes to the database must check the governor state first:

```typescript
const { data: governor } = await supabase.from('governor_state').select('current_mode').single();
const isReadOnly = governor?.current_mode === 'READ_ONLY';
if (isReadOnly) return errorResponse('SYSTEM_READ_ONLY');
```

Or use the shared utility:
```typescript
import { Guardrails } from "../_shared/guardrails.ts";
await Guardrails.checkGovernor(supabase);  // throws if restricted
```

**Exception:** Read-only queries and telemetry logging may bypass the governor check.

---

## 5. Every Edge Function Must Handle CORS

All Edge Functions must respond to `OPTIONS` with CORS headers before any other logic:

```typescript
if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
}
```

Use `Guardrails.getCorsHeaders()` for the standard header set. Never return a response without including CORS headers.

---

## 6. Authentication via Guardrails Only

Never manually parse JWT tokens. Always use:

```typescript
const user_id = await Guardrails.verifyAuth(req, supabaseClient);
```

This function validates the JWT, extracts the user, and throws `UNAUTHORIZED` if invalid. All authenticated endpoints must call this.

**Exception:** Internal scheduler endpoints may use `x-internal-scheduler` header instead of Bearer JWT. Validate the scheduler header before skipping JWT auth.

---

## 7. Scraper Insert Pattern

All job scrapers must:
1. Check `if (!job.title || !job.company) continue;` — skip invalid jobs
2. Compute SHA-256 fingerprint before any DB operation
3. `SELECT` existing fingerprint with `maybeSingle()`
4. If exists: `UPDATE last_verified_at` only
5. If new: `INSERT` with all normalized fields including `company_name` and `location_name`
6. Log to `discovery_runs` at the end of the run

**Never** use `upsert` on `job_pointers` — it creates silent race conditions and bypasses the fingerprint deduplication logic.

---

## 8. Supabase Client Usage

**In Edge Functions:** Always use `SUPABASE_SERVICE_ROLE_KEY` (never anon key) so service operations bypass RLS.

```typescript
const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);
```

**In frontend:** Use the anon key client with the user's JWT in the Authorization header. RLS policies enforce row-level access.

**In extension:** Use the anon key + user Bearer token for `execution-engine` calls. The extension never uses the service role key.

---

## 9. Quality Score Minimum for Job Matching

The `match_jobs_v3` RPC enforces `quality_score > 0.5`. Do **not** lower this threshold. Any changes to quality scoring logic must maintain this minimum to prevent garbage data from contaminating user-facing results.

---

## 10. Error Handling Pattern

**Never let ingestion errors crash the entire run.** Wrap per-job operations:

```typescript
for (const job of allJobs) {
    try {
        // process job
    } catch (e: any) {
        console.error('[SCRAPER] Job error:', e.message);
        // continue to next job
    }
}
```

Log all errors to `integrity_events` via `Guardrails.handleError()` for fatal function-level errors.

---

## 11. Database Schema Changes

All schema changes must be applied via `mcp_supabase-mcp-server_apply_migration`, not via `execute_sql`.

Migration naming convention:
```
{YYYYMMDDHHMMSS}_{descriptive_name}.sql
```

Example: `20260311000001_add_company_name_to_job_pointers.sql`

**Never** alter production tables directly via `execute_sql`. Use `apply_migration` so changes are tracked.

---

## 12. No Embedded Secrets in Source Code

The only acceptable hardcoded key in source code is the **Supabase anon key** in `background.js` (which is publicly designed to be visible). All other secrets must be in Supabase Edge Function secrets (environment variables):

```
SUPABASE_URL            → auto-injected
SUPABASE_SERVICE_ROLE_KEY → auto-injected
JOOBLE_API_KEY          → set via Supabase secrets
CAREERJET_AFFID         → set via Supabase secrets
GEMINI_API_KEY          → set via Supabase secrets
```

---

## 13. Frontend Type System

All data shapes exchanged between the frontend and Edge Functions must have TypeScript interfaces in `types.ts`. If a new field is added to an Edge Function response, add it to the corresponding interface in `types.ts` first.

**Violation:** Using `any` to bypass TypeScript checking on API responses.

---

## 14. Decision Engine Weights

Default weights in `decision-engine.ts` are:
```
β₀ = -1.6, β₁ = 2.3, β₂ = 1.5, β₃ = 0.9, β₄ = 1.3, β₅ = 0.8
```

Do **not** modify these without empirical evidence from `outcome_feedbacks`. Weight changes must go through `scoring_weight_sets` table, not hardcoded edits. The `optimize-weights` function is the only authorized mechanism for weight updates.

---

## 15. Extension Manifest Rules

Before any Chrome Web Store submission:
1. Add production domain to `externally_connectable.matches`
2. Remove `localhost` from `externally_connectable.matches`  
3. Verify `manifest_version: 3`
4. All content scripts must have `run_at: "document_idle"` (not `document_start`)
5. Set correct `version` field — must increment on every submission
