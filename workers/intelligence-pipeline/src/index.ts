// HireMax Intelligence Pipeline Worker
// Cron: 0 6 * * * (6am UTC daily)
// Stage 1: Fetch → Stage 2: Detect anomalies → Stage 3: Generate brief → Stage 4: Notify Sam

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  GEMINI_API_KEY: string;
  BLS_API_KEY: string;
  FRED_API_KEY: string;
  RESEND_API_KEY: string;
  SAM_EMAIL: string;
  ADMIN_BASE_URL: string;
  CONTENT_FACTORY_URL: string;
  ADMIN_PASSWORD: string;
}

// ============================================================
// CONTENT PILLARS
// ============================================================
const CONTENT_PILLARS: Record<string, { name: string; contrarian_frame: string }> = {
  entry_level_collapse: {
    name: 'The Entry-Level Collapse',
    contrarian_frame: "The career ladder isn't broken — it was removed",
  },
  compensation_reality: {
    name: 'Compensation Reality Index',
    contrarian_frame: "The career advice your parents gave you is costing you money",
  },
  ai_hiring_impact: {
    name: "AI's Impact on Hiring",
    contrarian_frame: "AI didn't take your job. It made 10,000 applicants apply for it.",
  },
  remote_work_divide: {
    name: 'The Remote Work Labor Split',
    contrarian_frame: "Remote work didn't democratize opportunity — it concentrated it",
  },
  skills_velocity: {
    name: 'Skills Value Velocity',
    contrarian_frame: "The skills everyone is rushing to learn are the ones becoming worthless",
  },
};

// ============================================================
// SUPABASE HELPERS
// ============================================================
async function supabaseInsert(env: Env, table: string, row: Record<string, unknown> | Record<string, unknown>[]) {
  const url = env.SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase insert ${table} error: ${text}`);
  }
}

async function supabaseSelect<T>(env: Env, path: string): Promise<T[]> {
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

async function supabasePatch(env: Env, table: string, filter: string, data: Record<string, unknown>) {
  const url = env.SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const res = await fetch(`${url}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Supabase patch error: ${await res.text()}`);
}

// ============================================================
// GEMINI HELPER
// ============================================================
async function callGemini(env: Env, prompt: string, retries = 2, forceFlash15 = false): Promise<string> {
  const model = forceFlash15 ? 'gemini-2.5-flash' : 'gemini-2.0-flash';
  const apiKey = env.GEMINI_API_KEY?.trim();
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
          }),
        }
      );
      if (res.status === 429) {
        if (!forceFlash15) {
          console.warn(`[Gemini] 429 Rate limited on ${model}. Falling back to gemini-2.5-flash...`);
          return callGemini(env, prompt, retries, true);
        }
        console.warn(`[Gemini] Attempt ${attempt}: 429 Rate limited on ${model}. Retrying in 2s...`);
        await sleep(2000);
        continue;
      }
      if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
      const data = await res.json() as any;
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (e) {
      console.error(`[Gemini] Attempt ${attempt} failed on ${model}:`, e);
      if (!forceFlash15 && attempt === retries) {
        console.warn(`[Gemini] Failed with ${model}. Falling back to gemini-2.5-flash...`);
        return callGemini(env, prompt, retries, true);
      }
      if (attempt === retries) throw e;
      await sleep(1000);
    }
  }
  return '';
}

async function generateSamsAngle(env: Env, briefTitle: string, coreFinding: string, contrarianAngle: string): Promise<string> {
  const prompt = `You are Sam, the founder of HireMax. Write a 1-3 sentence personal perspective/angle on this labor market finding.
Style: Extremely direct, contrarian, zero corporate fluff, sounding like Paul Graham. 
Speak in the first person ("I think...", "We're seeing..."). Highlight what this means for job seekers right now.

Brief Title: ${briefTitle}
Core Finding: ${coreFinding}
Contrarian Angle: ${contrarianAngle}

Return only the 1-3 sentences of your perspective. No tags, no explanations.`;
  const result = await callGemini(env, prompt);
  return result.trim().replace(/^"|"$/g, '');
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ============================================================
// STAGE 1: DATA FETCHERS
// ============================================================

async function insertDataPoint(env: Env, point: Record<string, unknown>) {
  await supabaseInsert(env, 'raw_data_points', point);
}

// BLS: Job openings, hires, separations
async function fetchBLS(env: Env): Promise<void> {
  if (!env.BLS_API_KEY || env.BLS_API_KEY === 'placeholder') {
    console.log('[BLS] No API key — skipping');
    return;
  }
  const body = {
    seriesid: ['JTS000000000000000JOR', 'JTS000000000000000HIR', 'JTS000000000000000TSR'],
    startyear: '2024',
    endyear: new Date().getFullYear().toString(),
    registrationkey: env.BLS_API_KEY,
  };
  const res = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json() as any;
  if (data.status !== 'REQUEST_SUCCEEDED') {
    console.error('[BLS] API error:', data.message);
    return;
  }
  const points = [];
  for (const series of data.Results.series) {
    for (const item of series.data.slice(0, 6)) {
      const monthStr = item.period.replace('M', '').padStart(2, '0');
      points.push({
        source_name: 'bls_jolt',
        data_type: 'job_openings',
        geography: 'US',
        sector: 'All',
        metric_name: series.seriesID,
        metric_value: parseFloat(item.value),
        metric_unit: 'percent',
        period_date: `${item.year}-${monthStr}-01`,
        period_label: `${item.periodName} ${item.year}`,
        raw_payload: item,
      });
    }
  }
  if (points.length > 0) {
    await supabaseInsert(env, 'raw_data_points', points as any);
  }
  await supabasePatch(env, 'data_sources', 'source_name=eq.bls_jolt', {
    last_fetched_at: new Date().toISOString(),
  });
  console.log('[BLS] Fetched successfully');
}

// FRED: Unemployment rates, job openings level
async function fetchFRED(env: Env): Promise<void> {
  if (!env.FRED_API_KEY || env.FRED_API_KEY === 'placeholder') {
    console.log('[FRED] No API key — skipping');
    return;
  }
  const series = ['UNRATE', 'LNS14000024', 'LNS14000036', 'JTSJOL'];
  const allPoints: any[] = [];
  
  const promises = series.map(async (seriesId) => {
    try {
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${env.FRED_API_KEY}&file_type=json&sort_order=desc&limit=12`;
      const res = await fetch(url);
      if (!res.ok) { console.error(`[FRED] ${seriesId} failed: ${res.status}`); return; }
      const data = await res.json() as any;
      for (const obs of (data.observations || []).slice(0, 12)) {
        if (obs.value === '.') continue;
        allPoints.push({
          source_name: 'fred_labor',
          data_type: 'unemployment',
          geography: 'US',
          sector: 'All',
          metric_name: seriesId,
          metric_value: parseFloat(obs.value),
          metric_unit: 'percent',
          period_date: obs.date,
          period_label: obs.date,
          raw_payload: obs,
        });
      }
    } catch (e) {
      console.error(`[FRED] ${seriesId} failed:`, e);
    }
  });
  await Promise.all(promises);

  if (allPoints.length > 0) {
    await supabaseInsert(env, 'raw_data_points', allPoints);
  }

  await supabasePatch(env, 'data_sources', 'source_name=eq.fred_labor', {
    last_fetched_at: new Date().toISOString(),
  });
  console.log('[FRED] Fetched successfully');
}

// Eurostat: EU unemployment rate
async function fetchEurostat(env: Env): Promise<void> {
  const url = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/une_rt_m?geo=EU27_2020&sex=T&age=Y15-74&s_adj=SA&unit=PC_ACT&sinceTimePeriod=2023-01&format=JSON';
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) { console.error('[Eurostat] fetch failed:', res.status); return; }
  const data = await res.json() as any;
  const values = data.value || {};
  const times = Object.values(data.dimension?.time?.category?.index || {}) as number[];
  const timeIds = Object.keys(data.dimension?.time?.category?.index || {});
  const points = [];
  const entries = Object.entries(values).slice(-12);
  for (const [idx, val] of entries) {
    const timeIdx = parseInt(idx);
    const period = timeIds[timeIdx];
    if (!period || !val) continue;
    points.push({
      source_name: 'eurostat_unemployment',
      data_type: 'unemployment',
      geography: 'EU',
      sector: 'All',
      metric_name: 'eu_unemployment_rate',
      metric_value: val as number,
      metric_unit: 'percent',
      period_date: `${period}-01`,
      period_label: period,
      raw_payload: { period, value: val },
    });
  }
  if (points.length > 0) {
    await supabaseInsert(env, 'raw_data_points', points as any);
  }
  await supabasePatch(env, 'data_sources', 'source_name=eq.eurostat_unemployment', {
    last_fetched_at: new Date().toISOString(),
  });
  console.log('[Eurostat] Fetched successfully');
}

// ILO: Global youth unemployment
async function fetchILO(env: Env): Promise<void> {
  const url = 'https://rplumber.ilo.org/data/indicator/?id=UNE_TUNE_SEX_AGE_NB_A&timefrom=2020&sex=SEX_T&age=AGE_YTHADULT_YGE15&type=label&lang=en&format=json';
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) { console.error('[ILO] fetch failed:', res.status); return; }
  const text = await res.text();
  const cleanedText = text.replace(/^\uFEFF/, '').trim();
  const data = JSON.parse(cleanedText) as any[];
  
  const worldRows = data.filter((item: any) => 
    item['ref_area.label'] === 'World' && 
    item['classif1.label'] === 'Age (Youth, adults): 15-24' &&
    item['sex.label'] === 'Total'
  );
  const sorted = worldRows.sort((a: any, b: any) => a.time.localeCompare(b.time));
  const obs = sorted.slice(-8);

  const points = [];
  for (const row of obs) {
    points.push({
      source_name: 'ilo_global',
      data_type: 'unemployment',
      geography: 'Global',
      sector: 'All',
      metric_name: 'global_unemployment_total',
      metric_value: parseFloat(row.obs_value),
      metric_unit: 'thousands',
      period_date: `${row.time}-01-01`,
      period_label: row.time,
      raw_payload: row,
    });
  }
  if (points.length > 0) {
    await supabaseInsert(env, 'raw_data_points', points as any);
  }
  await supabasePatch(env, 'data_sources', 'source_name=eq.ilo_global', {
    last_fetched_at: new Date().toISOString(),
  });
  console.log('[ILO] Fetched successfully');
}

// Reddit: Sentiment from job-seeker subreddits
async function fetchRedditSentiment(env: Env): Promise<void> {
  const subreddits = ['jobs', 'cscareerquestions', 'recruitinghell', 'ExperiencedDevs'];
  const topicResults: Record<string, { sentiments: number[]; count: number }> = {};

  try {
    // 1. Fetch posts from all subreddits in parallel
    const subRedditData = await Promise.all(
      subreddits.map(async (sub) => {
        try {
          const res = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=25`, {
            headers: { 'User-Agent': 'HireMaxIntelligence/1.0' },
          });
          if (!res.ok) return { sub, posts: [] };
          const data = await res.json() as any;
          return { sub, posts: (data.data?.children || []).slice(0, 15) };
        } catch {
          return { sub, posts: [] };
        }
      })
    );

    // 2. Batch all posts from all subreddits into one list
    const allPostsToClassify: Array<{ sub: string; index: number; title: string; score: number }> = [];
    let globalIndex = 0;
    for (const item of subRedditData) {
      for (const p of item.posts) {
        allPostsToClassify.push({
          sub: item.sub,
          index: globalIndex++,
          title: p.data.title,
          score: p.data.score || 0
        });
      }
    }

    if (allPostsToClassify.length > 0) {
      // 3. Classify all posts in a single Gemini call
      const titlesText = allPostsToClassify.map(p =>
        `${p.index} [r/${p.sub}]: "${p.title}" (score: ${p.score})`
      ).join('\n');

      const classifyPrompt = `Classify these Reddit job-related post titles. Return JSON array only.
Each item: {"index": N, "topic": "entry_level|salary|ghosting|remote|ai_hiring|layoffs|other", "sentiment": -2|-1|0|1|2}
No explanation. Pure JSON array.

Posts:
${titlesText}`;

      const result = await callGemini(env, classifyPrompt);
      let classifications: Array<{ index: number; topic: string; sentiment: number }> = [];
      try {
        const jsonMatch = result.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          classifications = JSON.parse(jsonMatch[0].trim());
        } else {
          console.error('[Reddit] No JSON array found in Gemini response:', result);
        }
      } catch (e) {
        console.error('[Reddit] Failed to parse classifications JSON:', e);
      }

      for (const cls of classifications) {
        const post = allPostsToClassify.find(p => p.index === cls.index);
        if (post) {
          const key = `${post.sub}_${cls.topic}`;
          if (!topicResults[key]) topicResults[key] = { sentiments: [], count: 0 };
          topicResults[key].sentiments.push(cls.sentiment);
          topicResults[key].count++;
        }
      }
    }
  } catch (e) {
    console.error(`[Reddit] Fetch sentiment failed:`, e);
  }

  const points = [];
  const today = new Date().toISOString().split('T')[0];
  for (const [key, agg] of Object.entries(topicResults)) {
    const avgSentiment = agg.sentiments.reduce((a, b) => a + b, 0) / agg.sentiments.length;
    points.push({
      source_name: 'reddit_sentiment',
      data_type: 'sentiment',
      geography: 'Global',
      sector: 'All',
      metric_name: `reddit_${key}_sentiment`,
      metric_value: avgSentiment,
      metric_unit: 'sentiment_score',
      period_date: today,
      period_label: today,
      raw_payload: { count: agg.count, avg_sentiment: avgSentiment },
    });
  }
  if (points.length > 0) {
    await supabaseInsert(env, 'raw_data_points', points as any);
  }
  await supabasePatch(env, 'data_sources', 'source_name=eq.reddit_sentiment', {
    last_fetched_at: new Date().toISOString(),
  });
  console.log('[Reddit] Fetched sentiment data');
}

// HN: Who Is Hiring thread analysis
async function fetchHN(env: Env): Promise<void> {
  try {
    const submittedRes = await fetch('https://hacker-news.firebaseio.com/v0/user/whoishiring/submitted.json');
    if (!submittedRes.ok) { console.error('[HN] Failed to fetch whoishiring submissions'); return; }
    const itemIds = await submittedRes.json() as number[];

    // Parallel fetch recent item headers to find "Who Is Hiring" thread
    const recentItems = await Promise.all(
      itemIds.slice(0, 15).map(async (id) => {
        try {
          const res = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
          if (!res.ok) return null;
          return await res.json() as any;
        } catch {
          return null;
        }
      })
    );

    let hiringItemId: number | null = null;
    let threadTitle = '';
    for (const item of recentItems) {
      if (item && item.title && item.title.includes('Who is Hiring')) {
        hiringItemId = item.id;
        threadTitle = item.title;
        break;
      }
    }
    if (!hiringItemId) { console.log('[HN] No current hiring thread found'); return; }

    // Fetch the thread
    const threadRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${hiringItemId}.json`);
    const thread = await threadRes.json() as any;
    const commentIds = (thread.kids || []).slice(0, 100);
    const commentTexts: string[] = [];

    // Parallel fetch comments
    const comments = await Promise.all(
      commentIds.slice(0, 10).map(async (cid: number) => {
        try {
          const res = await fetch(`https://hacker-news.firebaseio.com/v0/item/${cid}.json`);
          if (!res.ok) return null;
          return await res.json() as any;
        } catch {
          return null;
        }
      })
    );

    for (const c of comments) {
      if (c && c.text && c.text.length > 10) {
        const stripped = c.text.replace(/<[^>]+>/g, '').slice(0, 200);
        commentTexts.push(stripped);
      }
    }

    if (commentTexts.length === 0) {
      console.log('[HN] No comments fetched');
      return;
    }

    // Extract top mentioned skills via Gemini
    const skillPrompt = `Extract the top 10 most mentioned tech skills from these HN job listings. Return JSON only: {"skills": [{"skill": "name", "mentions": N}]}. No explanation.

Listings sample:
${commentTexts.join('\n\n').slice(0, 3000)}`;

    const skillResult = await callGemini(env, skillPrompt);
    let skills: Array<{ skill: string; mentions: number }> = [];
    try {
      const jsonMatch = skillResult.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        skills = JSON.parse(jsonMatch[0].trim()).skills || [];
      } else {
        console.error('[HN] No JSON object found in Gemini response:', skillResult);
      }
    } catch (e) { console.error('[HN] Failed to parse skills JSON:', e); }

    const today = new Date().toISOString().split('T')[0];
    const points = [];

    for (const s of skills.slice(0, 10)) {
      points.push({
        source_name: 'hn_jobs',
        data_type: 'skill_demand',
        geography: 'Global',
        sector: 'Tech',
        metric_name: `hn_hiring_skill_${s.skill.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        metric_value: s.mentions,
        metric_unit: 'mention_count',
        period_date: today,
        period_label: today,
        raw_payload: { skill: s.skill, thread_id: hiringItemId, total_comments: commentIds.length },
      });
    }

    // Store total job count
    points.push({
      source_name: 'hn_jobs',
      data_type: 'job_volume',
      geography: 'Global',
      sector: 'Tech',
      metric_name: 'hn_hiring_thread_total_jobs',
      metric_value: commentIds.length,
      metric_unit: 'job_posts',
      period_date: today,
      period_label: today,
      raw_payload: { thread_id: hiringItemId, thread_title: threadTitle || thread.title },
    });

    if (points.length > 0) {
      await supabaseInsert(env, 'raw_data_points', points as any);
    }

    await supabasePatch(env, 'data_sources', 'source_name=eq.hn_jobs', {
      last_fetched_at: new Date().toISOString(),
    });
    console.log(`[HN] Fetched ${skills.length} skills from thread ${hiringItemId}`);
  } catch (e) {
    console.error('[HN] Fetch failed:', e);
  }
}

// ============================================================
// STAGE 2: ANOMALY DETECTION
// ============================================================
interface RawDataPoint {
  metric_name: string;
  metric_value: number;
  period_date: string;
  source_name: string;
  geography: string;
}

function calcStats(values: number[]): { mean: number; stddev: number } {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return { mean, stddev: Math.sqrt(variance) };
}

function assignPillar(metricName: string, source: string): string {
  if (metricName.includes('entry_level') || metricName.includes('LNS14000024') || metricName.includes('youth')) {
    return 'entry_level_collapse';
  }
  if (metricName.includes('salary') || metricName.includes('wage') || metricName.includes('UNRATE')) {
    return 'compensation_reality';
  }
  if (metricName.includes('ai_hiring') || metricName.includes('hn_hiring_skill')) {
    return 'ai_hiring_impact';
  }
  if (metricName.includes('remote')) {
    return 'remote_work_divide';
  }
  if (metricName.includes('skill') || source === 'hn_jobs') {
    return 'skills_velocity';
  }
  if (source === 'reddit_sentiment') {
    if (metricName.includes('entry_level')) return 'entry_level_collapse';
    if (metricName.includes('remote')) return 'remote_work_divide';
    if (metricName.includes('salary')) return 'compensation_reality';
    return 'ai_hiring_impact';
  }
  return 'entry_level_collapse';
}

async function detectAnomalies(env: Env): Promise<void> {
  // Get all distinct metrics with enough history
  const allData = await supabaseSelect<RawDataPoint>(
    env,
    'raw_data_points?select=metric_name,metric_value,period_date,source_name,geography&order=period_date.desc&limit=5000'
  );

  // Group by metric_name
  const byMetric: Record<string, RawDataPoint[]> = {};
  for (const dp of allData) {
    if (!byMetric[dp.metric_name]) byMetric[dp.metric_name] = [];
    byMetric[dp.metric_name].push(dp);
  }

  // Read pillar performance to weight signals
  const pillarPerf = await supabaseSelect<any>(
    env,
    'pillar_performance?order=week_start.desc&limit=20'
  );
  const pillarBoost: Record<string, number> = {};
  if (pillarPerf.length > 0) {
    const topPillar = pillarPerf.reduce((best: any, curr: any) =>
      (curr.ai_citation_sessions > (best.ai_citation_sessions || 0)) ? curr : best, {});
    if (topPillar.pillar) pillarBoost[topPillar.pillar] = 0.15;
  }

  const signals: Array<{ pillar: string; headline: string; significanceScore: number; supportingData: unknown[]; contrarianAngle: string }> = [];

  for (const [metricName, dataPoints] of Object.entries(byMetric)) {
    if (dataPoints.length < 4) continue; // Need min 4 data points

    const sorted = [...dataPoints].sort((a, b) => b.period_date.localeCompare(a.period_date));
    const values = sorted.map(d => d.metric_value).filter(v => v !== null && !isNaN(v));
    if (values.length < 4) continue;

    const current = values[0];
    const historical = values.slice(1);
    const { mean, stddev } = calcStats(historical);
    if (stddev === 0) continue;

    const zScore = (current - mean) / stddev;
    if (Math.abs(zScore) < 1.5) continue;

    const pillar = assignPillar(metricName, dataPoints[0].source_name);
    const direction = zScore > 0 ? 'surge' : 'decline';
    const pctChange = ((current - mean) / mean * 100).toFixed(1);

    const boost = pillarBoost[pillar] || 0;
    let significance = Math.min(0.95, 0.5 + Math.abs(zScore) * 0.1 + boost);

    signals.push({
      pillar,
      headline: `${metricName.replace(/_/g, ' ')} shows ${direction} of ${Math.abs(parseFloat(pctChange))}% vs historical average`,
      significanceScore: significance,
      supportingData: [
        { stat: `${current}`, source: dataPoints[0].source_name.toUpperCase(), context: `Current value vs mean of ${mean.toFixed(2)}` },
        { stat: `${pctChange}%`, source: 'Statistical Analysis', context: `${Math.abs(zScore).toFixed(2)} standard deviations from norm` },
      ],
      contrarianAngle: CONTENT_PILLARS[pillar]?.contrarian_frame || 'The data contradicts conventional wisdom',
    });
  }

  // Cross-signal amplification: BLS down + Reddit entry-level negative
  const blsDown = signals.find(s => s.pillar === 'entry_level_collapse' && s.headline.includes('decline'));
  const redditNeg = allData.find(d => d.metric_name.includes('entry_level') && d.source_name === 'reddit_sentiment' && d.metric_value < -1);
  if (blsDown && redditNeg) {
    blsDown.significanceScore = Math.min(0.95, blsDown.significanceScore + 0.15);
    blsDown.headline = `[AMPLIFIED] ${blsDown.headline} — corroborated by job-seeker sentiment`;
  }

  // Insert signals above threshold
  const newSignals = signals.filter(s => s.significanceScore > 0.6);
  for (const sig of newSignals.slice(0, 5)) { // max 5 signals per day
    await supabaseInsert(env, 'trend_signals', {
      pillar: sig.pillar,
      headline: sig.headline,
      supporting_data: sig.supportingData,
      contrarian_angle: sig.contrarianAngle,
      significance_score: sig.significanceScore,
      used_in_content: false,
    });
  }

  console.log(`[Anomaly] Detected ${newSignals.length} significant signals`);
}

// ============================================================
// STAGE 3: BRIEF GENERATOR
// ============================================================
async function generateBrief(env: Env, requireManualApproval: boolean): Promise<{ id: string; title: string; core_finding: string; citation_potential: string } | null> {
  const signals = await supabaseSelect<any>(
    env,
    'trend_signals?significance_score=gte.0.6&used_in_content=eq.false&order=significance_score.desc&limit=1'
  );
  if (signals.length === 0) {
    console.log('[Brief] No unused signals found');
    return null;
  }
  const signal = signals[0];
  const pillarInfo = CONTENT_PILLARS[signal.pillar] || { name: signal.pillar, contrarian_frame: '' };

  const briefPrompt = `You are a labor market research analyst. Generate a research brief as JSON only.
No explanation. No markdown code blocks. Pure JSON starting with { and ending with }.

DATA SIGNAL:
Pillar: ${pillarInfo.name}
Finding: ${signal.headline}
Contrarian angle: ${signal.contrarian_angle}
Supporting data: ${JSON.stringify(signal.supporting_data)}

Output this exact JSON structure:
{
  "title": "headline with a specific number (e.g. '29% fewer entry-level jobs — and remote work caused it')",
  "core_finding": "120-150 word paragraph. Lead with the most surprising stat. Break one piece of conventional wisdom explicitly.",
  "supporting_data_points": [
    {"stat": "specific number/percent", "source": "BLS/FRED/Reddit/ILO/HN", "context": "what this means in plain English"}
  ],
  "conventional_wisdom_broken": "The widely-held belief this data disproves",
  "target_keywords": ["4-6 exact phrases people type when searching this topic"],
  "content_pillar": "${signal.pillar}",
  "citation_potential": "high|medium|low",
  "citation_reasoning": "one sentence why AI engines will or won't cite this"
}`;

  const result = await callGemini(env, briefPrompt);
  let brief: any;
  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON object found in Gemini response");
    brief = JSON.parse(jsonMatch[0].trim());
  } catch (e) {
    console.error('[Brief] Failed to parse Gemini JSON:', e, 'Raw result:', result);
    return null;
  }

  const briefId = crypto.randomUUID();
  const contrarianAngle = brief.conventional_wisdom_broken || signal.contrarian_angle;

  let samsAngle = '';
  let status = 'awaiting_angle';
  let nowIso = null;

  if (!requireManualApproval) {
    console.log("[Brief] Autonomous mode active: Generating Sam's angle...");
    try {
      samsAngle = await generateSamsAngle(env, brief.title, brief.core_finding, contrarianAngle);
      status = 'approved';
      nowIso = new Date().toISOString();
      console.log(`[Brief] Automatically generated Sam's angle: "${samsAngle}"`);
    } catch (e) {
      console.error("[Brief] Failed to auto-generate Sam's angle, falling back to manual approval:", e);
      status = 'awaiting_angle';
    }
  }

  // Insert brief
  await supabaseInsert(env, 'research_briefs', {
    id: briefId,
    signal_id: signal.id,
    title: brief.title,
    core_finding: brief.core_finding,
    supporting_data: brief.supporting_data_points || [],
    content_pillar: signal.pillar,
    contrarian_angle: contrarianAngle,
    target_keywords: brief.target_keywords || [],
    citation_potential: brief.citation_potential || 'medium',
    status: status,
    sams_angle: samsAngle || null,
    sams_angle_added_at: nowIso,
    reviewed_at: nowIso,
  });

  // Mark signal as used
  await supabasePatch(env, 'trend_signals', `id=eq.${signal.id}`, { used_in_content: true });

  console.log(`[Brief] Generated: "${brief.title}" (${brief.citation_potential} potential, status: ${status})`);
  return { id: briefId, title: brief.title, core_finding: brief.core_finding, citation_potential: brief.citation_potential };
}

// ============================================================
// STAGE 4: NOTIFY SAM
// ============================================================
async function notifySam(env: Env, brief: { id: string; title: string; core_finding: string; citation_potential: string }): Promise<void> {
  if (!env.RESEND_API_KEY || env.RESEND_API_KEY === 'placeholder') {
    console.log('[Notify] No Resend key — skipping email');
    return;
  }
  const adminUrl = `${env.ADMIN_BASE_URL || 'https://www.hiremax.site/admin'}#intelligence-briefs`;
  const potentialEmoji = brief.citation_potential === 'high' ? '🔥 HIGH' : brief.citation_potential === 'medium' ? '⚡ MEDIUM' : '📊 LOW';

  const emailBody = `
<!DOCTYPE html>
<html>
<body style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0F1117; color: #CBD5E1; padding: 32px;">
  <div style="background: #161B2E; border: 1px solid #2D313D; border-radius: 16px; padding: 32px;">
    <div style="margin-bottom: 24px;">
      <span style="font-size: 10px; font-weight: 800; letter-spacing: 3px; text-transform: uppercase; color: #3B82F6;">🧠 HireMax Intelligence</span>
      <h1 style="color: #FFFFFF; font-size: 22px; font-weight: 800; margin: 8px 0;">${brief.title}</h1>
      <span style="background: ${brief.citation_potential === 'high' ? '#10B981' : '#F59E0B'}; color: #000; font-size: 10px; font-weight: 800; padding: 3px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 2px;">CITATION POTENTIAL: ${potentialEmoji}</span>
    </div>

    <div style="background: #0F1117; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 3px solid #3B82F6;">
      <h2 style="color: #94A3B8; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 12px;">CORE FINDING</h2>
      <p style="color: #E2E8F0; line-height: 1.7; margin: 0;">${brief.core_finding}</p>
    </div>

    <div style="margin: 24px 0;">
      <h2 style="color: #94A3B8; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 12px;">⏱️ YOUR 2-MINUTE TASK</h2>
      <p style="color: #CBD5E1; line-height: 1.6; margin: 0 0 16px;">Add 1-3 sentences of your personal perspective. This is what makes the content non-generic and shareable. Without it, the system won't generate content.</p>
      <a href="${adminUrl}" style="display: inline-block; background: #3B82F6; color: #FFFFFF; font-weight: 800; font-size: 13px; padding: 14px 28px; border-radius: 10px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px;">→ Add Your Angle + Approve</a>
    </div>

    <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #2D313D; font-size: 11px; color: #64748B;">
      This brief was generated automatically from BLS, FRED, Reddit, ILO, and HN data.<br>
      Citation potential: ${brief.citation_potential.toUpperCase()} — ${brief.citation_potential === 'high' ? 'Original data synthesis likely to be cited by AI engines' : 'Good candidate for platform distribution'}
    </div>
  </div>
</body>
</html>`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'HireMax Intelligence <intelligence@hiremax.site>',
      to: [env.SAM_EMAIL || 'hiremax.ai@gmail.com'],
      subject: `🧠 New research brief — ${brief.title}`,
      html: emailBody,
    }),
  });
  console.log(`[Notify] Email sent to ${env.SAM_EMAIL}`);
}

// ============================================================
// MAIN CRON HANDLER
// ============================================================
export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    console.log('[Pipeline] Starting HireMax Intelligence Pipeline...');

    // Stage 1: Fetch all data sources (parallel, failures don't kill pipeline)
    const fetchResults = await Promise.allSettled([
      fetchBLS(env),
      fetchFRED(env),
      fetchEurostat(env),
      fetchILO(env),
      fetchRedditSentiment(env),
      fetchHN(env),
    ]);
    fetchResults.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`[Pipeline] Fetcher ${i} failed:`, r.reason);
      }
    });

    await sleep(100); // Let DB writes settle

    // Stage 2: Detect anomalies
    try {
      await detectAnomalies(env);
    } catch (e) {
      console.error('[Pipeline] Anomaly detection failed:', e);
    }

    await sleep(100);

    // Check manual approval setting from admin profile
    let requireManualApproval = true;
    try {
      const profiles = await supabaseSelect<any>(env, "profiles?email=eq.singh.harsimar23@gmail.com&select=require_manual_approval");
      if (profiles && profiles.length > 0 && profiles[0].require_manual_approval === false) {
        requireManualApproval = false;
      }
    } catch (e) {
      console.error('[Pipeline] Failed to fetch require_manual_approval setting, defaulting to true:', e);
    }
    console.log(`[Pipeline] Manual approval requirement is: ${requireManualApproval}`);

    // Stage 3: Generate brief
    let brief = null;
    try {
      brief = await generateBrief(env, requireManualApproval);
    } catch (e) {
      console.error('[Pipeline] Brief generation failed:', e);
    }

    // Stage 4: Actions based on approval mode
    if (brief) {
      if (requireManualApproval) {
        try {
          await notifySam(env, brief);
        } catch (e) {
          console.error('[Pipeline] Sam notification failed:', e);
        }
      } else {
        // Trigger Content Factory immediately (trimming to defend against trailing whitespaces/newlines)
        const factoryUrl = env.CONTENT_FACTORY_URL?.trim();
        const adminPassword = env.ADMIN_PASSWORD?.trim();
        if (factoryUrl && adminPassword) {
          console.log(`[Pipeline] Triggering Content Factory for brief ${brief.id}...`);
          try {
            const res = await fetch(`${factoryUrl}/generate`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${adminPassword}`,
              },
              body: JSON.stringify({ briefId: brief.id }),
            });
            if (res.ok) {
              console.log('[Pipeline] Content Factory triggered successfully:', await res.text());
            } else {
              console.error(`[Pipeline] Content Factory trigger failed: ${res.status} ${await res.text()}`);
            }
          } catch (e) {
            console.error('[Pipeline] Content Factory request failed:', e);
          }
        } else {
          console.warn('[Pipeline] CONTENT_FACTORY_URL or ADMIN_PASSWORD not configured. Skipping Content Factory trigger.');
        }
      }
    }

    console.log('[Pipeline] Complete.');
  },

  // HTTP handler for manual triggering in dev
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (url.pathname === '/trigger' && request.method === 'POST') {
      ctx.waitUntil(this.scheduled({ scheduledTime: Date.now() } as any, env, ctx));
      return new Response(JSON.stringify({ ok: true, message: 'Pipeline triggered' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('HireMax Intelligence Pipeline — POST /trigger to run', { status: 200 });
  },
};
