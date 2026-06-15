// HireMax Convergence Detector Worker
// Cron: 0 */6 * * *

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CONTENT_FACTORY_URL: string;
  ADMIN_PASSWORD: string;
}

// Supabase query helpers
async function supabaseQuery(env: Env, path: string, opts: RequestInit = {}) {
  const url = env.SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(opts.headers as Record<string, string> || {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${path}: ${await res.text()}`);
  const ct = res.headers.get('content-type') || '';
  return ct.includes('json') ? res.json() : null;
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n === 0) return 0;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
  }
  const num = n * sumXY - sumX * sumY;
  const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  if (den === 0) return 0;
  return num / den;
}

async function runDetection(env: Env): Promise<Record<string, unknown>> {
  console.log('[Convergence] Running convergence detection...');

  const yesterday = new Date();
  yesterday.setHours(yesterday.getHours() - 24);

  // 1. Query domain_signals where capture_date > now()-24h AND absolute z_score >= 1.5 AND insight_extracted = false
  const signals = await supabaseQuery(
    env,
    `domain_signals?capture_date=gt.${yesterday.toISOString()}&or=(z_score.gte.1.5,z_score.lte.-1.5)&insight_extracted=eq.false`
  ) as any[];

  if (!signals || signals.length === 0) {
    console.log('[Convergence] No new unextracted signals found.');
    return { ok: true, count: 0 };
  }

  console.log(`[Convergence] Found ${signals.length} new signals. Grouping by vertical...`);

  // 2. Group by vertical
  const byVertical: Record<string, any[]> = {};
  for (const sig of signals) {
    const vert = sig.vertical || 'unknown';
    if (!byVertical[vert]) byVertical[vert] = [];
    byVertical[vert].push(sig);
  }

  const verticals = Object.keys(byVertical);
  if (verticals.length < 2) {
    console.log('[Convergence] Signals do not span across 2+ distinct verticals. Skipping.');
    return { ok: true, count: 0, reason: 'insufficient_verticals' };
  }

  let detectedCount = 0;

  // 3. Cross-vertical pairing
  for (let i = 0; i < verticals.length; i++) {
    for (let j = i + 1; j < verticals.length; j++) {
      const vertA = verticals[i];
      const vertB = verticals[j];
      const listA = byVertical[vertA];
      const listB = byVertical[vertB];

      for (const sigA of listA) {
        for (const sigB of listB) {
          const composite_z = (Math.abs(parseFloat(sigA.z_score)) + Math.abs(parseFloat(sigB.z_score))) / 2;
          console.log(`[Convergence] Comparing ${sigA.metric_name} (${vertA}) and ${sigB.metric_name} (${vertB}). Composite z: ${composite_z}`);

          if (composite_z >= 1.8) {
            console.log(`[Convergence] High composite z-score ${composite_z} >= 1.8 detected! Computing correlation...`);

            // Fetch historical 90-day data (limit to 100 observations to represent historical trend)
            let valsA: number[] = [];
            let valsB: number[] = [];
            try {
              const histA = await supabaseQuery(env, `domain_signals?select=current_value&metric_name=eq.${encodeURIComponent(sigA.metric_name)}&order=capture_date.asc&limit=100`) as any[];
              const histB = await supabaseQuery(env, `domain_signals?select=current_value&metric_name=eq.${encodeURIComponent(sigB.metric_name)}&order=capture_date.asc&limit=100`) as any[];

              valsA = histA?.map(r => parseFloat(r.current_value)) || [];
              valsB = histB?.map(r => parseFloat(r.current_value)) || [];
            } catch (histErr) {
              console.error('[Convergence] Failed to fetch historical series for correlation:', histErr);
            }

            // Align by taking the minimum length from the end
            const minLen = Math.min(valsA.length, valsB.length);
            const alignedA = valsA.slice(-minLen);
            const alignedB = valsB.slice(-minLen);

            const correlation = minLen > 0 ? pearsonCorrelation(alignedA, alignedB) : 0;
            console.log(`[Convergence] Computed Pearson correlation: ${correlation}`);

            // Insert into convergence_signals
            const inserted = await supabaseQuery(env, 'convergence_signals', {
              method: 'POST',
              body: JSON.stringify({
                signal_ids: [sigA.id, sigB.id],
                vertical_a: vertA,
                vertical_b: vertB,
                correlation_coefficient: correlation,
                z_score_composite: composite_z,
                historical_instances: [],
                historical_base_rate: 0.1, // baseline base rate
                detected_at: new Date().toISOString(),
                status: 'detected',
              }),
            }) as any[];

            const convergenceRecord = inserted?.[0];
            if (convergenceRecord) {
              detectedCount++;
              console.log(`[Convergence] Created convergence signal ${convergenceRecord.id}. Triggering content factory...`);

              // Trigger Content Factory Template B webhook
              const factoryUrl = env.CONTENT_FACTORY_URL?.trim();
              const adminPassword = env.ADMIN_PASSWORD?.trim();
              if (factoryUrl && adminPassword) {
                try {
                  const res = await fetch(`${factoryUrl}/generate`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${adminPassword}`,
                    },
                    body: JSON.stringify({
                      type: 'convergence_brief',
                      convergence_signal_id: convergenceRecord.id,
                      convergenceSignalId: convergenceRecord.id,
                    }),
                  });
                  console.log(`[Convergence] Content Factory trigger response status: ${res.status}`);
                } catch (triggerErr) {
                  console.error('[Convergence] Content Factory trigger failed:', triggerErr);
                }
              }

              // Mark involved domain_signals as insight_extracted = true
              await supabaseQuery(env, `domain_signals?id=eq.${sigA.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ insight_extracted: true }),
                headers: { Prefer: 'return=minimal' },
              });
              await supabaseQuery(env, `domain_signals?id=eq.${sigB.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ insight_extracted: true }),
                headers: { Prefer: 'return=minimal' },
              });
            }
          }
        }
      }
    }
  }

  return { ok: true, count: detectedCount };
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    console.log('[Convergence] Starting scheduled convergence detection...');
    ctx.waitUntil(
      runDetection(env)
        .then(res => console.log('[Convergence] Completed:', JSON.stringify(res)))
        .catch(err => console.error('[Convergence] Failed:', err))
    );
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    console.log('[Convergence] Manual trigger of convergence detection...');
    try {
      const results = await runDetection(env);
      return new Response(JSON.stringify({ ok: true, results }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message || e }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
