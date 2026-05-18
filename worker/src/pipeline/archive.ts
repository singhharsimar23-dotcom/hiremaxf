import { Env } from '../config/env';
import { patch, insert, remove, getClient } from '../infra/db';

export type ArchiveResult = {
  jobsArchived: number;
  contentRowsDeleted: number;
  estimatedBytesSaved: number;
  errors: string[];
};

/**
 * Runs daily at 03:30 UTC. 
 * Nulls storage-heavy columns on old disappeared jobs to keep DB under 500MB.
 * Processes in batches of 100 to prevent timeouts.
 */
export async function runArchive(env: Env): Promise<ArchiveResult> {
  const result: ArchiveResult = {
    jobsArchived: 0,
    contentRowsDeleted: 0,
    estimatedBytesSaved: 0,
    errors: [],
  };

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const cutoff = ninetyDaysAgo.toISOString();

  const supabase = getClient(env);

  try {
    let hasMore = true;
    while (hasMore) {
      // 1. Query job_pointers WHERE:
      // job_state = 'disappeared'
      // AND disappeared_at < now() - interval '90 days'
      // AND archived_at IS NULL
      // Select: id, company_slug, external_id (batch in pages of 100)
      const { data: batch, error: queryError } = await supabase
        .from('job_pointers')
        .select('id, company_slug, external_id')
        .eq('job_state', 'disappeared')
        .lt('disappeared_at', cutoff)
        .is('archived_at', null)
        .limit(100);

      if (queryError) {
        result.errors.push(`Query failed: ${queryError.message}`);
        break;
      }

      if (!batch || batch.length === 0) {
        hasMore = false;
        break;
      }

      for (const job of batch) {
        try {
          // 2a. PATCH job_pointers SET storage-heavy columns to NULL
          // IMPORTANT: DO NOT touch first_seen_at, last_seen_at, disappeared_at, 
          // reposted_at, days_to_fill, repost_count, job_state, canonical_hash, fingerprint
          await patch(env, 'job_pointers', { id: job.id }, {
            tech_stack: null,
            requirements: null,
            benefits: null,
            skills: null,
            visa_types: null,
            quality_factors: null,
            archived_at: new Date().toISOString(),
          });

          // 2b. DELETE FROM job_content WHERE job_id = job.id
          await remove(env, 'job_content', { job_id: job.id });
          
          result.jobsArchived++;
          result.contentRowsDeleted++;
        } catch (err: any) {
          // c. On error for a single job: add to errors[], continue to next
          result.errors.push(`Failed to archive job ${job.id}: ${err.message}`);
        }
      }

      // If we got fewer than 100, we've exhausted the current criteria
      if (batch.length < 100) {
        hasMore = false;
      }
    }

    // 3. Estimate bytes saved: jobs_archived * 3500
    result.estimatedBytesSaved = result.jobsArchived * 3500;

    // 4. Insert into archival_log
    if (result.jobsArchived > 0) {
      try {
        await insert(env, 'archival_log', {
          jobs_archived: result.jobsArchived,
          bytes_freed_estimate: result.estimatedBytesSaved,
          ran_at: new Date().toISOString(),
        });
      } catch (err: any) {
        result.errors.push(`Failed to log archival: ${err.message}`);
      }
    }

  } catch (err: any) {
    // Never throw - log errors, continue.
    result.errors.push(`Global archive error: ${err.message}`);
  }

  return result;
}
