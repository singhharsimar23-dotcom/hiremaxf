/**
 * Environment variable validation for Cloudflare Workers.
 * This file ensures all required secrets and bindings are present at boot.
 */

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  GROQ_API_KEY: string;
  GEMINI_API_KEY: string;
  TOGETHER_API_KEY: string;
  RESEND_API_KEY: string;
  WORKER_SECRET: string;
  KV_JOBS: KVNamespace;
  DB_POOLER_URL?: string;
}

/**
 * Validates the environment object passed to the worker handler.
 * Throws an Error immediately if any required variable is missing or malformed.
 */
export function validateEnv(env: Env): void {
  const requiredStrings: (keyof Env)[] = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
    'GROQ_API_KEY',
    'GEMINI_API_KEY',
    'TOGETHER_API_KEY',
    'RESEND_API_KEY',
    'WORKER_SECRET',
  ];

  for (const key of requiredStrings) {
    const value = env[key];
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(`Missing env var: ${key}`);
    }
  }

  // Check KV binding exists
  if (!env.KV_JOBS) {
    throw new Error('Missing env var: KV_JOBS binding is not defined');
  }

}
