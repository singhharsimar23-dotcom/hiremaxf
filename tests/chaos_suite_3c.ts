import { runIngestionEngine } from "../core/ingestion-engine/group_processor.ts";
import { ALL_SOURCES } from "../infra/workers/config/sources.ts";
import { Env } from "../infra/workers/types/job.ts";
import { supabaseRpc, supabaseUpsert } from "../core/shared/db/client.ts";

/**
 * CHAOS SUITE 3C: Worst-Case Scenario Stress Test
 * 1. Concurrency: Multiple workers, same source.
 * 2. Trigger Resilience: Ingestion despite materialization failure.
 * 3. Filter Efficiency: Spam Gate under volume.
 */

export async function runChaos3C(env: Env) {
  console.log("%c\n🔥 STARTING CHAOS SUITE 3C", "color: orange; font-weight: bold;");

  // --- C1: CONCURRENCY STRESS ---
  console.log("\n[C1] Testing Lock Contention (3 Parallel Workers)...");
  const targetSource = ALL_SOURCES.find(s => s.slug === 'himalayas'); // Low risk, no API key
  if (!targetSource) throw new Error("Target source not found");
  
  targetSource.tier = 'ALPHA'; // Ensure it runs
  
  const workers = [
    runIngestionEngine(env, [targetSource]),
    runIngestionEngine(env, [targetSource]),
    runIngestionEngine(env, [targetSource])
  ];

  const results = await Promise.allSettled(workers);
  const successes = results.filter(r => r.status === 'fulfilled');
  console.log(`[C1] Results: ${successes.length} workers finished, ${results.length - successes.length} crashed.`);
  // We expect 1 to succeed in fetching, others to exit gracefully on lock contention.
  // Note: lock contention isn't a "crash" in group_processor, it returns gracefully.

  // --- C2: TRIGGER RESILIENCE ---
  console.log("\n[C2] Testing Trigger Resilience (Forcing Webhook Failures)...");
  // Break the materialization URL in DB
  await supabaseUpsert(env, 'system_settings', [{
    key: 'MATERIALIZE_JOB_URL',
    value: 'https://this-is-a-garbage-url-that-will-fail-123456789.com'
  }], 'key');

  try {
    const summary = await runIngestionEngine(env, [targetSource]);
    console.log(`[C2] Success: Ingested ${summary.total_inserted} jobs despite broken trigger.`);
    if (summary.total_inserted === 0 && summary.total_fetched > 0) {
        console.warn("[C2] WARNING: No jobs inserted. Check if duplicates or actual error.");
    }
  } finally {
    // Restore materialization URL
    await supabaseUpsert(env, 'system_settings', [{
      key: 'MATERIALIZE_JOB_URL',
      value: 'https://ssuknybhzcuusjardsve.supabase.co/functions/v1/materialize-job'
    }], 'key');
  }

  // --- C3: CAPACITY & FILTER GATE ---
  console.log("\n[C3] Testing Spam Gate Efficiency...");
  // We'll use a source that is currently enabled and check its metrics
  const summary3 = await runIngestionEngine(env, [targetSource]);
  console.log(`[C3] Spam Gate Summary: ${summary3.total_spam_skipped || 0} jobs filtered.`);
  
  console.log("%c\n✅ CHAOS SUITE 3C COMPLETE", "color: springgreen; font-weight: bold;");
}
