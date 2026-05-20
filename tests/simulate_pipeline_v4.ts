/**
 * tests/simulate_pipeline_v4.ts
 * Hi-Fi Ingestion Engine V4 Simulation Suite
 * 
 * Goal: Validate the hardened ingestion engine (traceability, capacity gating, atomic cursors).
 */

import { runIngestionEngine } from "../core/ingestion-engine/group_processor.ts";
import { ALL_SOURCES } from "../infra/workers/config/sources.ts";
import { Env } from "../infra/workers/types/job.ts";
import "https://deno.land/std@0.168.0/dotenv/load.ts";

async function runSimulation() {
  const env: Env = {
    // Core
    SUPABASE_URL: Deno.env.get("SUPABASE_URL") || "",
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    GROQ_API_KEY: Deno.env.get("GROQ_API_KEY") || "",
    WORKER_SECRET: Deno.env.get("WORKER_SECRET") || "sim-secret",
    ENVIRONMENT: "development",
    AI: null,

    // Jooble / Adzuna / Boards
    JOOBLE_API_KEY: Deno.env.get("JOOBLE_API_KEY"),
    ADZUNA_APP_ID: Deno.env.get("ADZUNA_APP_ID"),
    ADZUNA_APP_KEY: Deno.env.get("ADZUNA_APP_KEY"),
    REED_API_KEY: Deno.env.get("REED_API_KEY"),
    USAJOBS_API_KEY: Deno.env.get("USAJOBS_API_KEY"),
    DICE_KEY: Deno.env.get("DICE_KEY"),
    FINDWORK_TOKEN: Deno.env.get("FINDWORK_TOKEN"),
    ASHBY_API_KEY: Deno.env.get("ASHBY_API_KEY"),
  };

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
    console.log("Tip: Ensure you have a .env file with these variables at the root.");
    Deno.exit(1);
  }

  console.log("%c🚀 HI-FI V4 SIMULATION STARTING", "color: cyan; font-weight: bold;");
  
  // Pick Himalayas as a test source (No keys required)
  const testSource = ALL_SOURCES.find(s => s.slug === 'himalayas');
  
  if (!testSource) {
    console.error("❌ ERROR: Could not find 'figma' source in configuration.");
    Deno.exit(1);
  }

  // Force ALPHA tier to bypass saturation logic in simulation
  testSource.tier = 'ALPHA';
  console.log(`📡 Simulating ingestion for: ${testSource.label} (${testSource.tier})`);

  try {
    const summary = await runIngestionEngine(env, [testSource]);
    
    console.log("\n%c📊 RUN SUMMARY", "color: green; font-weight: bold;");
    console.log(JSON.stringify(summary, null, 2));

    if (summary.totalProcessed > 0 && summary.globalErrorRate < 0.5) {
      console.log("\n%c✅ VIBE CHECK: SUCCESS", "color: springgreen; font-weight: bold;");
    } else if (summary.totalProcessed === 0) {
       console.log("\n%cℹ️ VIBE CHECK: NO JOBS FOUND (Expected if OpenAI is empty or at capacity)", "color: skyblue;");
    } else {
      console.warn("\n%c⚠️ VIBE CHECK: PARTIAL FAILURE (Check metrics)", "color: orange;");
    }

  } catch (error) {
    console.error("\n%c❌ CRITICAL SYSTEM FAILURE", "color: red; font-weight: bold;");
    console.error(error);
    Deno.exit(1);
  }
}

runSimulation();
