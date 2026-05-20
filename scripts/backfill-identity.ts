/**
 * scripts/backfill-identity.ts
 * 
 * High-performance identity backfill for HireMax.
 * Recomputes SHA-256 fingerprints and canonical hashes for legacy records.
 * 
 * Usage: deno run -A scripts/backfill-identity.ts
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { PersistenceEngine } from "../infra/functions/infra-parser/core/persistence.ts";

// Attempt to load .env if available (Deno native or simple parse)
try {
  const envFile = await Deno.readTextFile(".env");
  for (const line of envFile.split("\n")) {
    const [key, ...value] = line.split("=");
    if (key && value) Deno.env.set(key.trim(), value.join("=").trim().replace(/^"(.*)"$/, '$1'));
  }
} catch {
  // .env not found, proceed with existing env
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ CRITICAL: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required.");
  console.log("   Please set them in your terminal or a .env file.");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function backfill() {
  console.log("🚀 Starting Identity Backfill (V2 SHA-256)...");

  let processed = 0;
  let matches = 0;

  // Process in batches of 100
  while (true) {
    const { data: jobs, error } = await supabase
      .from("job_pointers")
      .select("*")
      .or("fingerprint_version.is.null,fingerprint_version.eq.1")
      .limit(100);

    if (error) {
      console.error("❌ Batch Fetch Error:", error.message);
      break;
    }

    if (!jobs || jobs.length === 0) {
      console.log("✅ All records unified.");
      break;
    }

    for (const job of jobs) {
      try {
        // Reconstruct NormalizedJob for the engine
        const normalized = {
          title: job.title || "",
          company: job.company_name || "",
          location: job.location_name || "Remote",
          description: "", // Not needed for fingerprinting currently
          source: job.source_type || "UNKNOWN",
          source_job_id: job.external_id || "",
          apply_url: job.source_url || ""
        };

        const identity = await PersistenceEngine.generateIdentity(normalized);

        const { error: updateError } = await supabase
          .from("job_pointers")
          .update({
            fingerprint: identity.fingerprint,
            canonical_hash: identity.canonical_hash,
            fingerprint_version: 2,
            updated_at: new Date().toISOString()
          })
          .eq("id", job.id);

        if (updateError) {
          console.error(`❌ Update Error [${job.id}]:`, updateError.message);
        } else {
          processed++;
          if (processed % 100 === 0) console.log(`  - Processed ${processed} records...`);
        }
      } catch (e: any) {
        console.error(`❌ Conversion Failed [${job.id}]:`, e.message);
      }
    }
  }

  console.log(`🏁 Backfill Complete. Total: ${processed}`);
}

backfill();
