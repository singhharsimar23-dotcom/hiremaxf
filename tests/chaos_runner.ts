import { runChaos3C } from "./chaos_suite_3c.ts";
import { Env } from "../infra/workers/types/job.ts";

async function main() {
  const env: Env = {
    SUPABASE_URL: process.env.SUPABASE_URL || "",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    GROQ_API_KEY: process.env.GROQ_API_KEY || "",
    WORKER_SECRET: process.env.WORKER_SECRET || "chaos-secret",
    ENVIRONMENT: "production",
    AI: null
  };

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing environment variables.");
    process.exit(1);
  }

  try {
    await runChaos3C(env);
  } catch (error) {
    console.error("Chaos Test Failed:", error);
    process.exit(1);
  }
}

main();
