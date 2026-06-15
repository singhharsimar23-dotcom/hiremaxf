// HireMax Domain Signal Processor Worker
// POST body: { vertical, source, metric_name, current_value, series_data: number[], capture_date }

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CONTENT_FACTORY: Fetcher;
  ADMIN_PASSWORD: string;
}

// SUPABASE HELPERS
async function supabaseSelect(env: Env, path: string): Promise<any[]> {
  const url = env.SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase select error: ${await res.text()}`);
  return res.json();
}

async function supabaseInsert(env: Env, table: string, row: Record<string, unknown>): Promise<any> {
  const url = env.SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase insert ${table} error: ${text}`);
  }
  const data = await res.json() as any[];
  return data?.[0] || null;
}

// STATISTICAL HELPERS
function computeMean(arr: number[], n: number): number {
  const slice = arr.slice(-n);
  if (slice.length === 0) return 0;
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

function computeStdDev(arr: number[], mean: number, n: number): number {
  const slice = arr.slice(-n);
  if (slice.length === 0) return 0;
  const variance = slice.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / slice.length;
  return Math.sqrt(variance);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      const body = await request.json() as {
        vertical: string;
        source: string;
        metric_name: string;
        current_value: number;
        series_data: number[];
        capture_date: string;
      };

      const { vertical, source, metric_name, current_value, series_data, capture_date } = body;

      if (!vertical || !source || !metric_name || current_value === undefined || !series_data) {
        return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Compute rolling means
      const mean_30d = computeMean(series_data, 30);
      const mean_90d = computeMean(series_data, 90);
      const mean_18m = computeMean(series_data, 548); // 18m = 548 days approx

      // Compute standard deviation & z-score vs 18m mean
      const stddev_18m = computeStdDev(series_data, mean_18m, 548);
      const z_score = stddev_18m === 0 ? 0 : (current_value - mean_18m) / stddev_18m;

      console.log(`[Processor] Metric ${metric_name}: current_value=${current_value}, mean_18m=${mean_18m}, stddev_18m=${stddev_18m}, z_score=${z_score}`);

      // If anomaly (Math.abs(z_score) >= 1.5), query historical instances and insert
      if (Math.abs(z_score) >= 1.5) {
        console.log(`[Processor] Anomaly detected for ${metric_name} with z_score: ${z_score}`);

        // DEDUP: check if we already have a signal for this metric + capture_date
        let existingSignal: any = null;
        try {
          const existingRows = await supabaseSelect(
            env,
            `domain_signals?metric_name=eq.${encodeURIComponent(metric_name)}&capture_date=eq.${encodeURIComponent(capture_date)}&limit=1`
          );
          existingSignal = existingRows?.[0] || null;
        } catch (err) {
          console.error('[Processor] Dedup check failed:', err);
        }

        if (existingSignal) {
          console.log(`[Processor] Dedup: signal for ${metric_name} on ${capture_date} already exists (id=${existingSignal.id}). Skipping.`);
          return new Response(
            JSON.stringify({ anomaly: true, signal_id: existingSignal.id, z_score, deduped: true }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // Query domain_signals for last 10 rows with same metric_name and absolute z_score >= 1.5, ordered by capture_date DESC
        let historicalInstances: any[] = [];
        try {
          const rows = await supabaseSelect(
            env,
            `domain_signals?metric_name=eq.${encodeURIComponent(metric_name)}&or=(z_score.gte.1.5,z_score.lte.-1.5)&order=capture_date.desc&limit=10`
          );
          historicalInstances = rows || [];
        } catch (err) {
          console.error('[Processor] Failed to query historical instances:', err);
        }

        // Insert new anomaly signal
        const inserted = await supabaseInsert(env, 'domain_signals', {
          vertical,
          source,
          metric_name,
          current_value,
          mean_30d,
          mean_90d,
          mean_18m,
          z_score,
          capture_date: capture_date || new Date().toISOString(),
          historical_instances: historicalInstances,
          consensus_interpretation: null,
          insight_extracted: false,
          content_generated: false,
        });

        // Trigger Content Factory Standard Brief
        const adminPassword = env.ADMIN_PASSWORD?.trim();

        if (env.CONTENT_FACTORY && adminPassword && inserted?.id) {
          console.log(`[Processor] Triggering Content Factory for signal ${inserted.id}...`);
          try {
            const triggerRes = await env.CONTENT_FACTORY.fetch("http://content-factory/generate", {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${adminPassword}`,
              },
              body: JSON.stringify({
                type: 'standard_intelligence',
                signal_id: inserted.id,
                signalId: inserted.id,
              }),
            });
            console.log(`[Processor] Content Factory response: status=${triggerRes.status}`);
          } catch (triggerErr) {
            console.error('[Processor] Content Factory trigger failed:', triggerErr);
          }
        }

        return new Response(
          JSON.stringify({
            anomaly: true,
            signal_id: inserted?.id,
            z_score,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      } else {
        console.log(`[Processor] No anomaly detected for ${metric_name}. z_score=${z_score} < 1.5`);
        return new Response(
          JSON.stringify({
            anomaly: false,
            z_score,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    } catch (e: any) {
      console.error('[Processor] Error processing signal:', e);
      return new Response(JSON.stringify({ error: e.message || 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
