// HireMax Intelligence Extractor Module
// Anti-slop core

export interface DomainSignal {
  id: string;
  vertical: string;
  source: string;
  metric_name: string;
  current_value: number;
  mean_30d: number;
  mean_90d: number;
  mean_18m: number;
  z_score: number;
  capture_date: string;
}

export interface PredictionObject {
  prediction_statement: string;
  direction: string;
  magnitude_range: string;
  prediction_metric: string;
  prediction_source: string;
  prediction_timeframe: string;
  confidence_score: number;
  consensus_position?: string;
  consensus_deviation?: string;
  invalidation_conditions: string[];
}

export interface HistoricalContext {
  z_score: number;
  current_value: number;
  capture_date: string;
}

export interface ExtractedIntelligence {
  primary_thesis: string;
  consensus_interpretation: string;
  prediction: PredictionObject;
  historical_context: HistoricalContext[];
  previous_coverage_summary: string;
  vertical: string;
  confidence: number;
}

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  GEMINI_API_KEY: string;
}

// Helper to call Supabase
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

// Helper to call Gemini — uses gemini-2.5-flash directly (2.0-flash rate-limits on free tier)
async function callGemini(env: Env, prompt: string): Promise<string> {
  const model = 'gemini-flash-lite-latest';
  const apiKey = env.GEMINI_API_KEY?.trim();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
          }),
        }
      );
      if (res.status === 429) {
        console.warn(`[Extractor Gemini] 429 rate limit (attempt ${attempt}). Waiting 5s...`);
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
      const data = await res.json() as any;
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (e) {
      console.error(`[Extractor Gemini] Attempt ${attempt} failed:`, e);
      if (attempt === 1) throw e;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  throw new Error('Gemini exhausted retries in extractor');
}

export async function extractIntelligence(env: Env, signal: DomainSignal): Promise<ExtractedIntelligence> {
  console.log(`[Extractor] Starting intelligence extraction for signal ${signal.id} (${signal.metric_name})...`);

  // 1. Historical context: same metric_name, z_score > 1.5, capture_date < signal.capture_date
  let historicalContext: HistoricalContext[] = [];
  try {
    const signalRows = await supabaseQuery(
      env,
      `domain_signals?metric_name=eq.${encodeURIComponent(signal.metric_name)}&z_score=gt.1.5&capture_date=lt.${encodeURIComponent(signal.capture_date)}&order=z_score.desc&limit=5`
    ) as any[];
    historicalContext = (signalRows || []).map(r => ({
      z_score: parseFloat(r.z_score),
      current_value: parseFloat(r.current_value),
      capture_date: r.capture_date,
    }));
  } catch (err) {
    console.error('[Extractor] Historical signals query failed:', err);
  }

  // Pull predictions with outcome_recorded_at NOT NULL for this metric
  let resolvedPredictions: any[] = [];
  try {
    resolvedPredictions = await supabaseQuery(
      env,
      `predictions?prediction_metric=eq.${encodeURIComponent(signal.metric_name)}&outcome_recorded_at=not.is.null&limit=5`
    ) as any[];
  } catch (err) {
    console.error('[Extractor] Historical predictions query failed:', err);
  }

  const predictionsSummary = resolvedPredictions.map(p => 
    `- Prediction: "${p.prediction_text}". Correct: ${p.prediction_correct}. Actual Value: ${p.outcome_value}`
  ).join('\n');

  // 2. Previous coverage: query blog_posts where pillar = vertical and published_at > now - 90d
  let previousCoverageSummary = 'No previous coverage in the last 90 days.';
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  let summaryPrompt = '';
  let hasPreviousPosts = false;
  try {
    const posts = await supabaseQuery(
      env,
      `blog_posts?select=published_at,title,content_markdown&published_at=gt.${ninetyDaysAgo.toISOString()}&pillar=eq.${encodeURIComponent(signal.vertical)}&limit=3`
    ) as any[];

    if (posts && posts.length > 0) {
      console.log(`[Extractor] Found ${posts.length} previous posts for vertical ${signal.vertical}. Preparing summary prompt...`);
      const postSummaries = posts.map(p => 
        `Title: "${p.title}"\nPublished: ${p.published_at}\nSnippet: ${p.content_markdown.slice(0, 1000)}`
      ).join('\n---\n');

      summaryPrompt = `Summarize these previous HireMax blog posts about ${signal.vertical} in exactly 3 bullet points (each bullet containing: date, claim, numbers cited). Do not include any introductory text, titles, or other markdown. Keep it under 300 tokens.
      
      Previous Posts:
      ${postSummaries}`;
      hasPreviousPosts = true;
    }
  } catch (err) {
    console.error('[Extractor] Previous coverage query failed:', err);
  }

  // 3. Three parallel Gemini calls
  const promptA = `You are a labor market analyst. Analysis consensus reading.
  Signal details:
  Vertical: ${signal.vertical}
  Source: ${signal.source}
  Metric Name: ${signal.metric_name}
  Current Value: ${signal.current_value}
  z_score: ${signal.z_score}
  
  What is the obvious mainstream-press reading of this data? Output exactly one sentence. Specific, factual, no hedging. No introductory text.`;

  const promptB = `You are a contrarian economist. Analyze this anomaly signal and historical context.
  Signal details:
  Vertical: ${signal.vertical}
  Metric Name: ${signal.metric_name}
  Current Value: ${signal.current_value}
  z_score: ${signal.z_score}
  
  Historical Context of similar anomalies:
  ${JSON.stringify(historicalContext)}
  
  Resolved predictions:
  ${predictionsSummary}
  
  What does this data actually suggest that contradicts the consensus mainstream-press reading?
  Return a JSON object only. Do not include markdown code blocks.
  JSON structure:
  {
    "contrarian_thesis": "One specific sentence summarizing the contrarian reading",
    "non_obviousness_score": 1-10
  }`;

  const timeframe = new Date();
  timeframe.setDate(timeframe.getDate() + 90); // Default 90 days window
  const promptC = `You are a forecasting model. Formulate a specific falsifiable prediction for the next 90 days.
  Signal: ${signal.metric_name} = ${signal.current_value} (z-score: ${signal.z_score})
  Historical outcomes:
  ${predictionsSummary}
  
  Return a JSON object only. Do not include markdown code blocks.
  JSON structure:
  {
    "prediction_statement": "Specific, falsifiable prediction statement",
    "direction": "up|down|flat",
    "magnitude_range": "e.g., +2% to +5% or decline by 100bps",
    "confidence_score": 1-10,
    "invalidation_conditions": ["Condition 1", "Condition 2"]
  }`;

  console.log('[Extractor] Running LLM calls sequentially with 1s delays...');
  const resA = await callGemini(env, promptA);
  await new Promise(r => setTimeout(r, 1000));
  const resB = await callGemini(env, promptB);
  await new Promise(r => setTimeout(r, 1000));
  const resC = await callGemini(env, promptC);
  let resSummary = '';
  if (hasPreviousPosts) {
    await new Promise(r => setTimeout(r, 1000));
    resSummary = await callGemini(env, summaryPrompt);
  }

  const consensusInterpretation = resA.trim();
  if (hasPreviousPosts && resSummary) {
    previousCoverageSummary = resSummary.trim();
  }

  // Parse B
  let contrarianThesis = '';
  let nonObviousnessScore = 5;
  try {
    const jsonMatch = resB.match(/\{[\s\S]*\}/);
    const parsedB = JSON.parse(jsonMatch ? jsonMatch[0] : resB);
    contrarianThesis = parsedB.contrarian_thesis || '';
    nonObviousnessScore = parseInt(parsedB.non_obviousness_score || '5', 10);
  } catch (err) {
    console.error('[Extractor] Failed to parse contrarian thesis JSON:', resB, err);
    contrarianThesis = resB.trim().replace(/^"|"$/g, '');
  }

  // Parse C
  let predictionObj: PredictionObject = {
    prediction_statement: '',
    direction: 'flat',
    magnitude_range: 'none',
    prediction_metric: signal.metric_name,
    prediction_source: signal.source,
    prediction_timeframe: timeframe.toISOString(),
    confidence_score: 5,
    invalidation_conditions: []
  };
  try {
    const jsonMatch = resC.match(/\{[\s\S]*\}/);
    const parsedC = JSON.parse(jsonMatch ? jsonMatch[0] : resC);
    predictionObj = {
      prediction_statement: parsedC.prediction_statement || '',
      direction: parsedC.direction || 'flat',
      magnitude_range: parsedC.magnitude_range || 'none',
      prediction_metric: signal.metric_name,
      prediction_source: signal.source,
      prediction_timeframe: timeframe.toISOString(),
      confidence_score: parseInt(parsedC.confidence_score || '5', 10),
      invalidation_conditions: parsedC.invalidation_conditions || []
    };
  } catch (err) {
    console.error('[Extractor] Failed to parse prediction JSON:', resC, err);
  }

  // 4. Validation call: check B against raw data
  const valPrompt = `You are a fact-checking bot.
  Raw Data: ${signal.metric_name} = ${signal.current_value} (z-score: ${signal.z_score})
  Interpretation B (Contrarian Thesis): "${contrarianThesis}"
  
  Does Interpretation B contradict the raw data?
  Return a JSON object only. Do not include markdown code blocks.
  JSON structure:
  {
    "contradicts": true|false,
    "reason": "Short one-sentence reason"
  }`;

  let contradicts = false;
  try {
    const valRes = await callGemini(env, valPrompt);
    const jsonMatch = valRes.match(/\{[\s\S]*\}/);
    const parsedVal = JSON.parse(jsonMatch ? jsonMatch[0] : valRes);
    contradicts = parsedVal.contradicts === true;
    console.log(`[Extractor] Fact check contradicts=${contradicts}, reason="${parsedVal.reason}"`);
  } catch (err) {
    console.error('[Extractor] Fact check failed:', err);
  }

  // Decision logic: if non_obviousness_score >= 6 and not contradicts -> B is primary_thesis. Else fallback to C.
  const primaryThesis = (nonObviousnessScore >= 6 && !contradicts) ? contrarianThesis : predictionObj.prediction_statement;

  return {
    primary_thesis: primaryThesis,
    consensus_interpretation: consensusInterpretation,
    prediction: predictionObj,
    historical_context: historicalContext,
    previous_coverage_summary: previousCoverageSummary,
    vertical: signal.vertical,
    confidence: predictionObj.confidence_score
  };
}
