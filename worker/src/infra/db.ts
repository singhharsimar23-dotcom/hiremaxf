import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Env } from '../config/env';

/**
 * Returns a fresh Supabase client using DB_POOLER_URL.
 * We do not cache the client across requests in Cloudflare Workers (isolate model).
 */
export function getClient(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' }
  });
}

/**
 * Runs .select().match(query). Throws on error.
 */
export async function select<T>(
  env: Env,
  table: string,
  query: Record<string, unknown>
): Promise<T[]> {
  const supabase = getClient(env);
  const { data, error } = await supabase.from(table).select().match(query);

  if (error) {
    throw new Error(`[db.select:${table}] ${error.message}`);
  }

  return data as T[];
}

/**
 * Runs .upsert(data, { onConflict }). Throws on error.
 */
export async function upsert<T>(
  env: Env,
  table: string,
  data: Record<string, unknown>,
  onConflict: string
): Promise<T> {
  const supabase = getClient(env);
  const { data: result, error } = await supabase
    .from(table)
    .upsert(data, { onConflict })
    .select()
    .single();

  if (error) {
    throw new Error(`[db.upsert:${table}] ${error.message}`);
  }

  return result as T;
}

/**
 * Runs .insert(data).select().single(). Throws on error.
 */
export async function insert<T>(
  env: Env,
  table: string,
  data: Record<string, unknown>
): Promise<T> {
  const supabase = getClient(env);
  const { data: result, error } = await supabase
    .from(table)
    .insert(data)
    .select()
    .single();

  if (error) {
    throw new Error(`[db.insert:${table}] ${error.message}`);
  }

  return result as T;
}

/**
 * Runs .update(data).match(match). Throws on error.
 */
export async function patch(
  env: Env,
  table: string,
  match: Record<string, unknown>,
  data: Record<string, unknown>
): Promise<void> {
  const supabase = getClient(env);
  const { error } = await supabase.from(table).update(data).match(match);

  if (error) {
    throw new Error(`[db.patch:${table}] ${error.message}`);
  }
}

/**
 * Runs .rpc(fn, params). Throws on error.
 */
export async function rpc<T>(
  env: Env,
  fn: string,
  params: Record<string, unknown>
): Promise<T> {
  const supabase = getClient(env);
  const { data, error } = await supabase.rpc(fn, params);

  if (error) {
    throw new Error(`[db.rpc:${fn}] ${error.message}`);
  }

  return data as T;
}

/**
 * Runs .delete().match(match). Throws on error.
 */
export async function remove(
  env: Env,
  table: string,
  match: Record<string, unknown>
): Promise<void> {
  const supabase = getClient(env);
  const { error } = await supabase.from(table).delete().match(match);

  if (error) {
    throw new Error(`[db.remove:${table}] ${error.message}`);
  }
}
