import { Env } from '../config/env';
import { select, patch, getClient } from '../infra/db';
import { getLastRunJobIds } from '../infra/cursor';
import { JobState } from '../types/job';

export type GraveyardResult = {
  count: number;
  disappeared: number;
  reposted: number;
  zombified: number;
  reason?: string;
};

interface JobPointer {
  id: string;
  external_id: string;
  job_state: JobState;
  run_absent_count: number;
  repost_count: number;
  first_seen_at: string;
}

interface CompanyCursorRow {
  last_full_sweep_at: string | null;
}

export async function runGraveyard(
  env: Env,
  companySlug: string,
  source: string
): Promise<GraveyardResult> {
  try {
    // 1. Pre-condition check: last_full_sweep_at must be set
    const cursorRows = await select<CompanyCursorRow>(env, 'company_cursors', {
      company_slug: companySlug,
      source: source,
    });

    if (cursorRows.length === 0 || !cursorRows[0].last_full_sweep_at) {
      return { count: 0, disappeared: 0, reposted: 0, zombified: 0, reason: 'no_full_sweep' };
    }

    // 2. Read last_run_job_ids
    const lastRunJobIds = await getLastRunJobIds(env, companySlug, source);
    if (lastRunJobIds.length === 0) {
      return { count: 0, disappeared: 0, reposted: 0, zombified: 0, reason: 'no_job_ids' };
    }

    const lastRunSet = new Set(lastRunJobIds);

    // 3. Query existing jobs that are NOT zombies
    // Using getClient directly to handle the NOT IN condition if possible, 
    // but the prompt says use infra signatures. select() only does .match().
    // We'll filter in memory to stay strictly within infra patterns if select() is too limited,
    // but the prompt explicitly mentions WHERE job_state NOT IN ('zombie').
    // Since select() only takes a match object, we'll fetch all for this company/source and filter.
    const allJobs = await select<JobPointer>(env, 'job_pointers', {
      company_slug: companySlug,
      source: source,
    });

    const jobsToProcess = allJobs.filter(j => j.job_state !== 'zombie');

    const result: GraveyardResult = {
      count: 0,
      disappeared: 0,
      reposted: 0,
      zombified: 0,
    };

    const updates: any[] = [];
    const now = new Date();

    for (const job of jobsToProcess) {
      const seen = lastRunSet.has(job.external_id);
      let newState: JobState = job.job_state;
      let newAbsentCount = job.run_absent_count;
      let newRepostCount = job.repost_count;
      let extraData: Record<string, any> = {};

      if (seen) {
        // Job was seen in latest sweep
        if (job.job_state === 'disappeared') {
          newRepostCount++;
          if (newRepostCount >= 3) {
            newState = 'zombie';
            result.zombified++;
          } else {
            newState = 'reposted';
            result.reposted++;
            extraData.reposted_at = now.toISOString();
          }
        } else {
          newState = 'active';
        }
        newAbsentCount = 0;
      } else {
        // Job was NOT seen in latest sweep
        newAbsentCount++;
        if (newAbsentCount >= 3) {
          newState = 'disappeared';
          result.disappeared++;
          extraData.disappeared_at = now.toISOString();
          
          if (job.first_seen_at) {
            const firstSeen = new Date(job.first_seen_at);
            const daysToFill = Math.floor((now.getTime() - firstSeen.getTime()) / (1000 * 60 * 60 * 24));
            extraData.days_to_fill = daysToFill;
          }
        } else {
          newState = 'cooling';
        }
      }

      // Only queue update if state or absent count changed
      if (newState !== job.job_state || newAbsentCount !== job.run_absent_count) {
        updates.push({
          id: job.id,
          job_state: newState,
          run_absent_count: newAbsentCount,
          repost_count: newRepostCount,
          updated_at: now.toISOString(),
          ...extraData,
        });
      }
    }

    // 4. Batch updates using getClient to minimize DB round trips
    if (updates.length > 0) {
      const supabase = getClient(env);
      // We use upsert for batch updates by ID
      const { error } = await supabase
        .from('job_pointers')
        .upsert(updates);

      if (error) {
        throw new Error(`Batch update failed: ${error.message}`);
      }
      result.count = updates.length;
    }

    return result;
  } catch (err) {
    console.error('[runGraveyard] Error:', err);
    return { count: 0, disappeared: 0, reposted: 0, zombified: 0, reason: 'db_error' };
  }
}
