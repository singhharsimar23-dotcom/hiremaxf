import { Env } from '../config/env';
import { select, patch, upsert } from './db';

export interface CompanyCursor {
  company_slug: string;
  source: string;
  cursor_offset: number;
  last_full_sweep_at: string | null;
  last_run_job_ids: string[] | null;
  is_paused: boolean;
  updated_at: string;
}

/**
 * Reads the cursor state for a company+source pair.
 * If no row exists, it upserts a default row (offset=0, isPaused=false).
 */
export async function readCompany(
  env: Env,
  companySlug: string,
  source: string
): Promise<{ offset: number; isPaused: boolean; lastFullSweepAt: string | null }> {
  const rows = await select<CompanyCursor>(env, 'company_cursors', {
    company_slug: companySlug,
    source: source,
  });

  if (rows.length === 0) {
    // Upsert default row on first access
    const row = await upsert<CompanyCursor>(
      env,
      'company_cursors',
      {
        company_slug: companySlug,
        source: source,
        cursor_offset: 0,
        is_paused: false,
        updated_at: new Date().toISOString(),
      },
      'company_slug, source'
    );

    return {
      offset: row.cursor_offset,
      isPaused: row.is_paused,
      lastFullSweepAt: row.last_full_sweep_at,
    };
  }

  const row = rows[0];
  return {
    offset: row.cursor_offset,
    isPaused: row.is_paused,
    lastFullSweepAt: row.last_full_sweep_at,
  };
}

/**
 * Sets the absolute cursor offset for a company+source pair.
 */
export async function advanceCompany(
  env: Env,
  companySlug: string,
  source: string,
  nextOffset: number
): Promise<void> {
  await patch(
    env,
    'company_cursors',
    { company_slug: companySlug, source: source },
    {
      cursor_offset: nextOffset,
      updated_at: new Date().toISOString(),
    }
  );
}

/**
 * Resets the cursor for a full sweep completion.
 * Resets offset to 0 and records the job IDs found in this sweep.
 */
export async function setFullSweep(
  env: Env,
  companySlug: string,
  source: string,
  jobIds: string[]
): Promise<void> {
  await patch(
    env,
    'company_cursors',
    { company_slug: companySlug, source: source },
    {
      cursor_offset: 0,
      last_full_sweep_at: new Date().toISOString(),
      last_run_job_ids: jobIds,
      updated_at: new Date().toISOString(),
    }
  );
}

/**
 * Returns the list of job IDs from the last successful full sweep.
 */
export async function getLastRunJobIds(
  env: Env,
  companySlug: string,
  source: string
): Promise<string[]> {
  const rows = await select<CompanyCursor>(env, 'company_cursors', {
    company_slug: companySlug,
    source: source,
  });

  if (rows.length === 0) {
    return [];
  }

  return rows[0].last_run_job_ids || [];
}
