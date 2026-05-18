import { Env, validateEnv } from './config/env';
import { SourceRegistry, SOURCE_IDS } from './config/sources';
import { acquire, release, startRefresh } from './infra/lock';
import { select } from './infra/db';
import { runCompany, runDiscovery } from './ingestion/runner';
import { runArchive } from './pipeline/archive';
import { greenhouseAdapter } from './ingestion/sources/greenhouse';
import { leverAdapter } from './ingestion/sources/lever';
import { ashbyAdapter } from './ingestion/sources/ashby';
import { greenhouseDiscovery } from './ingestion/discovery/greenhouse';
import { leverDiscovery } from './ingestion/discovery/lever';
import { ashbyDiscovery } from './ingestion/discovery/ashby';

interface CompanyRegistryRow {
  slug: string;
  company_slug: string;
  source: string;
  is_active: boolean;
  last_checked_at: string | null;
}

function buildRegistry(_env: Env): SourceRegistry {
  const preReg = Object.create(SourceRegistry.prototype) as SourceRegistry;
  preReg.registerAdapter(SOURCE_IDS.GREENHOUSE, greenhouseAdapter);
  preReg.registerAdapter(SOURCE_IDS.LEVER, leverAdapter);
  preReg.registerAdapter(SOURCE_IDS.ASHBY, ashbyAdapter);
  preReg.registerDiscovery(SOURCE_IDS.GREENHOUSE, greenhouseDiscovery);
  preReg.registerDiscovery(SOURCE_IDS.LEVER, leverDiscovery);
  preReg.registerDiscovery(SOURCE_IDS.ASHBY, ashbyDiscovery);
  return preReg;
}

function requireWorkerAuth(request: Request, env: Env): boolean {
  const auth = request.headers.get('Authorization') ?? '';
  const [scheme, token] = auth.split(' ');
  return scheme === 'Bearer' && token === env.WORKER_SECRET;
}

async function requireUserAuth(request: Request, env: Env): Promise<{ userId: string } | null> {
  const auth = request.headers.get('Authorization') ?? '';
  const [scheme, token] = auth.split(' ');
  if (scheme !== 'Bearer' || !token) return null;

  try {
    const signal = AbortSignal.timeout(5000);
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': env.SUPABASE_SERVICE_KEY
      },
      signal
    });
    if (!res.ok) return null;
    const data = await res.json() as { id: string };
    return { userId: data.id };
  } catch (err) {
    console.warn('[requireUserAuth] error:', err);
    return null;
  }
}

function jsonOk(data: unknown, durationMs?: number): Response {
  return new Response(JSON.stringify({ status: 'ok', data, duration_ms: durationMs }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function jsonError(message: string, status: number, durationMs?: number): Response {
  return new Response(JSON.stringify({ status: 'error', error: message, duration_ms: durationMs }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function decompressDescription(compressed: string): Promise<string | null> {
  try {
    const binaryStr = atob(compressed);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const stream = new Response(bytes).body;
    if (!stream) return null;
    const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'));
    const text = await new Response(decompressedStream).text();
    return text;
  } catch (err) {
    console.error('[decompressDescription] error:', err);
    return null;
  }
}

function matchRoute(path: string, pattern: string): Record<string, string> | null {
  const pathParts = path.split('/').filter(Boolean);
  const patternParts = pattern.split('/').filter(Boolean);
  if (pathParts.length !== patternParts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].substring(1)] = pathParts[i];
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

async function handleFetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const startTime = Date.now();
  try {
    let envValid = true;
    try { validateEnv(env); } catch { envValid = false; }
    if (!envValid) return jsonError('Service unavailable', 503, Date.now() - startTime);

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === 'GET' && path === '/health') {
      if (!requireWorkerAuth(request, env)) return jsonError('Unauthorized', 401);
      const { getClient } = await import('./infra/db');
      const supabase = getClient(env);
      const { data: sourceHealth } = await supabase.from('source_health').select('*');
      const { count: dlqDepth } = await supabase.from('ingestion_dlq').select('*', { count: 'exact', head: true }).eq('resolved', false);
      const kvList = await env.KV_JOBS.list({ prefix: 'dlq:fail:' });
      return jsonOk({
        status: 'ok',
        timestamp: new Date().toISOString(),
        source_health: sourceHealth || [],
        dlq_depth: dlqDepth || 0,
        kv_dlq_count: kvList.keys.length,
        note: 'DB size check not implemented natively in Supabase API via standard REST'
      }, Date.now() - startTime);
    }

    if (method === 'GET' && path === '/api/jobs') {
      const role = url.searchParams.get('role');
      const seniority = url.searchParams.get('seniority');
      const remote = url.searchParams.get('remote');
      const salary_min = url.searchParams.get('salary_min');
      const salary_max = url.searchParams.get('salary_max');
      const location = url.searchParams.get('location');
      const tech_stack = url.searchParams.get('tech_stack');
      const q = url.searchParams.get('q');
      const page = parseInt(url.searchParams.get('page') || '1', 10);
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
      const offset = (page - 1) * limit;

      const { getClient } = await import('./infra/db');
      let query = getClient(env).from('job_pointers').select('*', { count: 'exact' }).eq('job_state', 'active');

      if (role) query = query.eq('role_category', role);
      if (seniority) query = query.eq('seniority_band', seniority);
      if (remote === 'true') query = query.eq('is_remote', true);
      if (salary_min) query = query.gte('salary_min', parseInt(salary_min, 10));
      if (salary_max) query = query.lte('salary_max', parseInt(salary_max, 10));
      if (location) query = query.ilike('location_name', `%${location}%`);
      if (tech_stack) query = query.overlaps('tech_stack', tech_stack.split(','));
      if (q) query = query.textSearch('search_vec', q, { config: 'english' });

      const { data, count, error } = await query.order('first_seen_at', { ascending: false }).range(offset, offset + limit - 1);
      if (error) return jsonError('Failed to fetch jobs', 500, Date.now() - startTime);
      return jsonOk({ jobs: data, count, page, limit }, Date.now() - startTime);
    }

    let match = matchRoute(path, '/api/jobs/:id/apply-package');
    if (method === 'GET' && match) {
      const userAuth = await requireUserAuth(request, env);
      if (!userAuth) return jsonError('Unauthorized', 401, Date.now() - startTime);
      const { id } = match;
      const { get } = await import('./infra/kv');
      let cache = await get<{ job: any }>(env, `job:detail:${id}`);
      let jobData: any = cache?.job;

      if (!jobData) {
        const { getClient } = await import('./infra/db');
        const { data, error } = await getClient(env).from('job_pointers').select('*, job_content(description)').eq('id', id).single();
        if (error || !data) return jsonError('Not found', 404, Date.now() - startTime);
        jobData = data;
        if (jobData.job_content?.[0]?.description) {
          jobData.description = await decompressDescription(jobData.job_content[0].description);
          delete jobData.job_content;
        }
      }
      const applyPackage = {
        ...jobData,
        visa_detected: jobData.visa_types && jobData.visa_types.length > 0,
        exp_level: jobData.years_exp_max ? `${jobData.years_exp_min}-${jobData.years_exp_max}` : jobData.years_exp_min,
        authorized_only_flag: jobData.authorized_only
      };
      return jsonOk(applyPackage, Date.now() - startTime);
    }

    match = matchRoute(path, '/api/jobs/:id');
    if (method === 'GET' && match) {
      const { id } = match;
      const { get, set } = await import('./infra/kv');
      let cache = await get<{ job: any }>(env, `job:detail:${id}`);
      if (cache) return jsonOk(cache.job, Date.now() - startTime);

      const { getClient } = await import('./infra/db');
      const { data, error } = await getClient(env).from('job_pointers').select('*, job_content(description)').eq('id', id).single();
      if (error || !data) return jsonError('Not found', 404, Date.now() - startTime);

      const jobData = { ...data };
      if (jobData.job_content?.[0]?.description) {
        jobData.description = await decompressDescription(jobData.job_content[0].description);
        delete jobData.job_content;
      }

      if (jobData.quality_score >= 0.7) {
        await set(env, `job:detail:${id}`, { job: jobData }, 3600 * 24, jobData.quality_score);
      }
      return jsonOk(jobData, Date.now() - startTime);
    }

    if (method === 'GET' && path === '/api/companies') {
      const { getClient } = await import('./infra/db');
      const { data, error } = await getClient(env).from('job_pointers').select('company_name, salary_min, salary_max').eq('job_state', 'active');
      if (error) return jsonError('DB error', 500, Date.now() - startTime);

      const agg: Record<string, { role_count: number, min: number[], max: number[] }> = {};
      for (const row of data) {
        if (!agg[row.company_name]) agg[row.company_name] = { role_count: 0, min: [], max: [] };
        agg[row.company_name].role_count++;
        if (row.salary_min != null) agg[row.company_name].min.push(row.salary_min);
        if (row.salary_max != null) agg[row.company_name].max.push(row.salary_max);
      }

      const result = Object.entries(agg).map(([name, stats]) => ({
        company_name: name,
        role_count: stats.role_count,
        avg_salary_min: stats.min.length ? stats.min.reduce((a, b) => a + b, 0) / stats.min.length : null,
        avg_salary_max: stats.max.length ? stats.max.reduce((a, b) => a + b, 0) / stats.max.length : null,
      }));
      return jsonOk(result, Date.now() - startTime);
    }

    match = matchRoute(path, '/api/companies/:slug');
    if (method === 'GET' && match) {
      const { slug } = match;
      const { getClient } = await import('./infra/db');
      const { data, error } = await getClient(env).from('job_pointers').select('*').eq('company_slug', slug).in('job_state', ['active', 'cooling']);
      if (error) return jsonError('DB error', 500, Date.now() - startTime);
      return jsonOk(data, Date.now() - startTime);
    }

    if (method === 'GET' && path === '/api/salary-insights') {
      const role = url.searchParams.get('role') || 'all';
      const location = url.searchParams.get('location') || 'all';
      const cacheKey = `intel:salary:${role}:${location}`;

      const { get, set } = await import('./infra/kv');
      const cache = await get<any>(env, cacheKey);
      if (cache) return jsonOk(cache, Date.now() - startTime);

      const { getClient } = await import('./infra/db');
      let query = getClient(env).from('job_pointers').select('salary_min, salary_max').eq('job_state', 'active').not('salary_min', 'is', null);
      if (role !== 'all') query = query.eq('role_category', role);
      if (location !== 'all') query = query.ilike('location_name', `%${location}%`);

      const { data, error } = await query;
      if (error) return jsonError('DB error', 500, Date.now() - startTime);

      const result = {
        count: data.length,
        avg_min: data.length ? data.reduce((a, b) => a + (b.salary_min || 0), 0) / data.length : null,
        avg_max: data.length ? data.reduce((a, b) => a + (b.salary_max || 0), 0) / data.length : null,
      };
      await set(env, cacheKey, result, 3600 * 6);
      return jsonOk(result, Date.now() - startTime);
    }

    match = matchRoute(path, '/api/intelligence/role/:role');
    if (method === 'GET' && match) {
      const userAuth = await requireUserAuth(request, env);
      if (!userAuth) return jsonError('Unauthorized', 401, Date.now() - startTime);
      const { role } = match;
      const { get } = await import('./infra/kv');
      const cache = await get(env, `intel:timing:${role}`);
      return jsonOk(cache || { note: 'No intelligence found for role' }, Date.now() - startTime);
    }

    if (method === 'GET' && path === '/api/intelligence/hidden-opps') {
      const userAuth = await requireUserAuth(request, env);
      if (!userAuth) return jsonError('Unauthorized', 401, Date.now() - startTime);
      const { get } = await import('./infra/kv');
      const cache = await get(env, `intel:hidden-opps:feed`);
      return jsonOk(cache || { note: 'No hidden opportunities found' }, Date.now() - startTime);
    }

    if (method === 'POST' && path === '/api/alerts') {
      const userAuth = await requireUserAuth(request, env);
      if (!userAuth) return jsonError('Unauthorized', 401, Date.now() - startTime);
      return jsonError('tables do not exist until Phase 5', 501, Date.now() - startTime);
    }

    match = matchRoute(path, '/api/bookmarks/:id');
    if (method === 'POST' && match) {
      const userAuth = await requireUserAuth(request, env);
      if (!userAuth) return jsonError('Unauthorized', 401, Date.now() - startTime);
      return jsonError('tables do not exist until Phase 5', 501, Date.now() - startTime);
    }

    match = matchRoute(path, '/api/outcomes/:id');
    if (method === 'POST' && match) {
      const userAuth = await requireUserAuth(request, env);
      if (!userAuth) return jsonError('Unauthorized', 401, Date.now() - startTime);
      const { id } = match;
      const body = await request.json() as any;
      const validOutcomes = ['ghosted', 'callback', 'phone_screen', 'interview', 'offer', 'rejected'];
      if (!validOutcomes.includes(body.outcome)) return jsonError('Invalid outcome', 400, Date.now() - startTime);

      const { getClient } = await import('./infra/db');
      const db = getClient(env);
      const { data: jobData } = await db.from('job_pointers').select('first_seen_at').eq('id', id).single();
      if (!jobData) return jsonError('Job not found', 404, Date.now() - startTime);

      const appliedAt = body.applied_at ? new Date(body.applied_at) : new Date();
      let daysAfterPosting = null;
      if (jobData.first_seen_at) {
        daysAfterPosting = Math.floor((appliedAt.getTime() - new Date(jobData.first_seen_at).getTime()) / (1000 * 3600 * 24));
      }

      const payload = {
        job_id: id,
        user_id: userAuth.userId,
        applied_at: appliedAt.toISOString(),
        days_after_posting: daysAfterPosting,
        got_callback: ['callback', 'phone_screen', 'interview', 'offer'].includes(body.outcome),
        outcome: body.outcome,
        reported_at: new Date().toISOString()
      };
      const { error } = await db.from('application_outcomes').insert(payload);
      if (error) return jsonError('Failed to insert outcome', 500, Date.now() - startTime);
      return jsonOk({ inserted: true }, Date.now() - startTime);
    }

    if (method === 'POST' && path === '/run') {
      if (!requireWorkerAuth(request, env)) return jsonError('Unauthorized', 401, Date.now() - startTime);
      const registry = buildRegistry(env);
      const sourceParam = url.searchParams.get('source') ?? '';
      const companyParam = url.searchParams.get('company');
      const signal = AbortSignal.timeout(55000);

      const forceUnlockFlag = url.searchParams.get('force_unlock') === 'true';
      if (forceUnlockFlag) {
        const { forceUnlock } = await import('./infra/lock');
        await Promise.all([
          forceUnlock(env, 'lock:ingestion:sequential:ALPHA'),
          forceUnlock(env, 'lock:ingestion:sequential:GAMMA')
        ]);
      }

      let targetSlug = companyParam;
      if (!targetSlug) {
        const { getClient } = await import('./infra/db');
        const { data } = await getClient(env).from('company_registry').select('company_slug')
          .eq('source', sourceParam).eq('is_active', true)
          .order('last_checked_at', { ascending: true, nullsFirst: true }).limit(1).single();
        targetSlug = data?.company_slug ?? null;
      }
      if (!targetSlug || !sourceParam) return jsonError('Missing source or company param', 400, Date.now() - startTime);
      const result = await runCompany(env, registry, sourceParam, targetSlug, signal, 'MANUAL');
      return jsonOk(result, Date.now() - startTime);
    }

    if (method === 'POST' && path === '/dlq/replay-kv') {
      if (!requireWorkerAuth(request, env)) return jsonError('Unauthorized', 401, Date.now() - startTime);
      const list = await env.KV_JOBS.list({ prefix: 'dlq:fail:', limit: 50 });
      const { getClient } = await import('./infra/db');
      const db = getClient(env);
      const errors = [];
      let replayed = 0;
      for (const key of list.keys) {
        const val = await env.KV_JOBS.get(key.name);
        if (!val) continue;
        try {
          const payload = JSON.parse(val as string);
          const { error } = await db.from('ingestion_dlq').insert({
            source: payload.source,
            company_slug: payload.companySlug,
            raw_payload: payload.payload,
            error_message: `[KV replay] ${payload.error}`,
            kv_fallback_key: key.name,
            retry_count: 0,
            resolved: false
          });
          if (error) throw error;
          await env.KV_JOBS.delete(key.name);
          replayed++;
        } catch (e: any) {
          errors.push({ key: key.name, error: e.message });
        }
      }
      return jsonOk({ replayed, errors, total_found: list.keys.length }, Date.now() - startTime);
    }

    if (method === 'POST' && path === '/dlq/replay') {
      if (!requireWorkerAuth(request, env)) return jsonError('Unauthorized', 401, Date.now() - startTime);
      return jsonOk({ message: 'not implemented' }, Date.now() - startTime);
    }

    return jsonError(`Not found: ${method} ${path}`, 404, Date.now() - startTime);
  } catch (err) {
    console.error('[handleFetch] Unhandled error:', err);
    return jsonError('Internal server error', 500, Date.now() - startTime);
  }
}

async function handleScheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
  try { validateEnv(env); } catch (err) { console.error('[scheduled] Env validation failed:', err); return; }
  const registry = buildRegistry(env);
  const scheduledDate = new Date(event.scheduledTime);
  const m = scheduledDate.getUTCMinutes();
  const h = scheduledDate.getUTCHours();

  if (m === 40) console.log('[scheduled] Running Enrichment stub');
  if (m === 0 && h % 2 === 0) console.log('[scheduled] Running Embedding stub');

  if (m === 0 && h % 6 === 0) {
    console.log('[scheduled] Running signal detector...');
    ctx.waitUntil((async () => {
      try {
        const { runSignalDetector } = await import('./intelligence/signal-detector');
        await runSignalDetector(env);
      } catch (e) {
        console.warn('[scheduled] signal-detector not implemented or failed:', e);
      }
    })());
  }

  if (m === 0 && h === 4) {
    console.log('[scheduled] Running daily discovery...');
    const sources = [SOURCE_IDS.GREENHOUSE, SOURCE_IDS.LEVER, SOURCE_IDS.ASHBY];
    for (const sourceId of sources) {
      try {
        const result = await runDiscovery(env, registry, sourceId);
        console.log(`[scheduled] Discovery source=${sourceId} newSlugs=${result.newSlugs}`);
      } catch (err) {
        console.error(`[scheduled] Discovery error source=${sourceId}:`, err);
      }
    }
  }

  if (m === 0 && h === 2) {
    console.log('[scheduled] Running pattern engine...');
    ctx.waitUntil((async () => {
      try {
        const { runPatternEngineJob } = await import('./intelligence/pattern-engine');
        await runPatternEngineJob(env);
      } catch (e) {
        console.warn('[scheduled] pattern-engine not implemented or failed:', e);
      }
    })());
  }

  if (m === 0 && h === 3) {
    console.log('[scheduled] Running graveyard audit...');
    ctx.waitUntil((async () => {
      try {
        const { getClient } = await import('./infra/db');
        const db = getClient(env);
        const twoDaysAgo = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
        const { data } = await db.from('company_cursors').select('company_slug').or(`last_full_sweep_at.is.null,last_full_sweep_at.lt.${twoDaysAgo}`);
        if (data && data.length > 0) {
          console.warn('[scheduled] Graveyard audit found overdue companies:', data.map((d: any) => d.company_slug));
        }
      } catch (e) {
        console.error('[scheduled] Graveyard audit failed:', e);
      }
    })());
  }

  if (m === 30 && h === 3) {
    console.log('[scheduled] Running daily archive...');
    try {
      const archiveResult = await runArchive(env);
      console.log('[scheduled] Archive complete:', archiveResult);
    } catch (err) {
      console.error('[scheduled] Archive error:', err);
    }
  }

  if (m === 45 && h === 3) {
    console.log('[scheduled] Running content purge...');
    ctx.waitUntil((async () => {
      try {
        const { getClient } = await import('./infra/db');
        const db = getClient(env);
        const { data: archived } = await db.from('job_pointers').select('id').not('archived_at', 'is', null).limit(1000);
        if (archived && archived.length > 0) {
          const ids = archived.map((a: any) => a.id);
          await db.from('job_content').delete().in('job_id', ids);
          console.log(`[scheduled] Purged ${ids.length} orphaned content records`);
        }
      } catch (e) {
        console.error('[scheduled] Content purge failed:', e);
      }
    })());
  }

  if (m % 10 === 0) {
    console.log('[scheduled] Running 10-min ingestion...');
    const abortController = new AbortController();
    const guardSignal = AbortSignal.timeout(55000);

    const runIngestion = async (tier: 'ALPHA' | 'GAMMA') => {
      if (tier === 'GAMMA') {
        const gammaSources = registry.getAllGamma();
        if (gammaSources.length === 0) return;
      }

      const lockKey = `lock:ingestion:sequential:${tier}`;
      const owner = await acquire(env, lockKey);
      if (owner === null) {
        console.log(`[scheduled] Lock held by another worker — skipping ${tier} tick.`);
        try {
          const { getClient } = await import('./infra/db');
          await getClient(env).from('integrity_events').insert({
            event_type: 'lock_acquisition_failed',
            source: tier,
            message: `Failed to acquire ingestion lock for ${tier}`,
            timestamp: new Date().toISOString()
          });
        } catch (e) { }
        return;
      }
      ctx.waitUntil(startRefresh(env, lockKey, owner, abortController.signal));

      try {
        const { getClient } = await import('./infra/db');
        const db = getClient(env);
        let degradedSources = new Set<string>();

        if (tier === 'GAMMA') {
          const { data: health } = await db.from('source_health').select('source, status');
          if (health) {
            for (const h of health) {
              if (h.status === 'degraded') degradedSources.add(h.source);
            }
          }
        }

        const { data: companies } = await db.from('company_registry')
          .select('slug, company_slug, source, is_active, last_checked_at')
          .eq('is_active', true)
          .order('last_checked_at', { ascending: true, nullsFirst: true })
          .limit(5);

        if (!companies) return;
        const alphaSourceIds = new Set([SOURCE_IDS.GREENHOUSE, SOURCE_IDS.LEVER, SOURCE_IDS.ASHBY]);

        for (const company of companies) {
          if (tier === 'ALPHA' && !alphaSourceIds.has(company.source)) continue;
          if (tier === 'GAMMA' && alphaSourceIds.has(company.source)) continue;

          if (tier === 'GAMMA' && degradedSources.has(company.source)) {
            console.log(`[scheduled] Skipping degraded GAMMA source=${company.source}`);
            continue;
          }

          if (guardSignal.aborted) break;

          const result = await runCompany(env, registry, company.source, company.company_slug, guardSignal, tier);
          console.log(`[scheduled] runCompany tier=${tier} slug=${company.company_slug} inserted=${result.jobsInserted} updated=${result.jobsUpdated}`);

          try {
            await db.from('company_registry').update({ last_checked_at: new Date().toISOString() })
              .eq('company_slug', company.company_slug)
              .eq('source', company.source);
          } catch (e) { }
        }
      } finally {
        await release(env, lockKey, owner);
      }
    };

    await Promise.all([runIngestion('ALPHA'), runIngestion('GAMMA')]);
    abortController.abort();
  }
}

export default {
  fetch: handleFetch,
  scheduled: handleScheduled,
};
