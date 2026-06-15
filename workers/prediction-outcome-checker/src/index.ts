// HireMax Prediction Outcome Checker Worker
// Cron: 0 6 * * *

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CONTENT_FACTORY_URL: string;
  ADMIN_PASSWORD: string;
  INTELLIGENCE_KV: KVNamespace;
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

async function runOutcomeCheck(env: Env): Promise<Record<string, unknown>> {
  console.log('[Prediction Outcome] Running outcome checks...');

  const now = new Date().toISOString();
  
  // Query predictions where timeframe <= now AND outcome is null
  const predictions = await supabaseQuery(
    env,
    `predictions?prediction_timeframe=lte.${now}&outcome_recorded_at=is.null`
  ) as any[];

  if (!predictions || predictions.length === 0) {
    console.log('[Prediction Outcome] No pending predictions found to check.');
    return { ok: true, count: 0 };
  }

  console.log(`[Prediction Outcome] Found ${predictions.length} predictions to check.`);

  for (const prediction of predictions) {
    console.log(`[Prediction Outcome] Checking prediction ${prediction.id} (metric: ${prediction.prediction_metric})...`);
    try {
      // 1. Fetch latest value of the metric from domain_signals
      const latestSignals = await supabaseQuery(
        env,
        `domain_signals?metric_name=eq.${encodeURIComponent(prediction.prediction_metric)}&order=capture_date.desc&limit=1`
      ) as any[];

      if (!latestSignals || latestSignals.length === 0) {
        console.warn(`[Prediction Outcome] No signal data found for metric ${prediction.prediction_metric}. Skipping.`);
        continue;
      }
      const latestSignal = latestSignals[0];
      const outcome_value = parseFloat(latestSignal.current_value);

      // 2. Fetch baseline value at the time the prediction was created
      const baselineSignals = await supabaseQuery(
        env,
        `domain_signals?metric_name=eq.${encodeURIComponent(prediction.prediction_metric)}&capture_date=lte.${encodeURIComponent(prediction.created_at)}&order=capture_date.desc&limit=1`
      ) as any[];
      
      const baselineValue = baselineSignals?.[0] ? parseFloat(baselineSignals[0].current_value) : outcome_value;

      // 3. Compute direction
      const diff = outcome_value - baselineValue;
      const outcome_direction = diff > 0 ? 'up' : (diff < 0 ? 'down' : 'flat');

      // 4. Compare with prediction direction
      const prediction_correct = (prediction.prediction_direction === outcome_direction);
      const accuracy_note = `Predicted ${prediction.prediction_direction} (magnitude: ${prediction.prediction_magnitude_range}) vs baseline ${baselineValue}. Actual outcome: ${outcome_value} (${outcome_direction}).`;

      console.log(`[Prediction Outcome] Prediction correct: ${prediction_correct}. Note: ${accuracy_note}`);

      // 5. Update predictions table
      await supabaseQuery(env, `predictions?id=eq.${prediction.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          outcome_value,
          outcome_direction,
          outcome_recorded_at: new Date().toISOString(),
          prediction_correct,
          accuracy_note,
        }),
        headers: { Prefer: 'return=minimal' },
      });

      // 6. Update KV counter
      let stats = { total: 0, correct: 0, partial: 0, accuracy_rate: 0 };
      const kvVal = await env.INTELLIGENCE_KV.get('prediction_accuracy');
      if (kvVal) {
        try {
          stats = JSON.parse(kvVal);
        } catch {}
      }
      stats.total += 1;
      if (prediction_correct) {
        stats.correct += 1;
      }
      stats.accuracy_rate = stats.total > 0 ? (stats.correct / stats.total) : 0;
      await env.INTELLIGENCE_KV.put('prediction_accuracy', JSON.stringify(stats));
      console.log(`[Prediction Outcome] Updated KV counter: ${JSON.stringify(stats)}`);

      // 7. Trigger content factory to generate a called-it / missed-it piece
      const factoryUrl = env.CONTENT_FACTORY_URL?.trim();
      const adminPassword = env.ADMIN_PASSWORD?.trim();
      if (factoryUrl && adminPassword) {
        console.log(`[Prediction Outcome] Triggering content factory update...`);
        try {
          const res = await fetch(`${factoryUrl}/generate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${adminPassword}`,
            },
            body: JSON.stringify({
              type: 'prediction_outcome',
              predictionId: prediction.id,
              prediction_id: prediction.id,
            }),
          });
          console.log(`[Prediction Outcome] Content Factory response: status=${res.status}`);
        } catch (triggerErr) {
          console.error('[Prediction Outcome] Content Factory trigger failed:', triggerErr);
        }
      }

    } catch (err) {
      console.error(`[Prediction Outcome] Error verifying prediction ${prediction.id}:`, err);
    }
  }

  return { ok: true, count: predictions.length };
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    console.log('[Prediction Outcome] Starting scheduled predictions outcome checker...');
    ctx.waitUntil(
      runOutcomeCheck(env)
        .then(res => console.log('[Prediction Outcome] Complete:', JSON.stringify(res)))
        .catch(err => console.error('[Prediction Outcome] Failed:', err))
    );
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    console.log('[Prediction Outcome] Manual trigger of prediction outcome checker...');
    try {
      const results = await runOutcomeCheck(env);
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
