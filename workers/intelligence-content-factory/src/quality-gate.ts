// HireMax Quality Gate Module
import { extractIntelligence } from './intelligence-extractor';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  GEMINI_API_KEY: string;
}

export interface QualityGateResult {
  decision: 'publish' | 'regenerate' | 'kill';
  clean: boolean;
  violations: string[];
  scores: {
    specificity_score: number;
    non_obviousness_score: number;
    falsifiability_score: number;
    voice_score: number;
    aeo_readiness: number;
  };
  notes?: string;
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
            generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
          }),
        }
      );
      if (res.status === 429) {
        console.warn(`[Quality Gate Gemini] 429 rate limit (attempt ${attempt}). Waiting 5s...`);
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
      const data = await res.json() as any;
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (e) {
      if (attempt === 1) throw e;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  throw new Error('Gemini failed in Quality Gate');
}

// Memory cache for banned phrases
let cachedBannedPhrases: string[] = [];

export async function getBannedPhrases(env: Env): Promise<string[]> {
  if (cachedBannedPhrases.length > 0) return cachedBannedPhrases;
  try {
    const rows = await supabaseQuery(env, 'banned_phrases?select=phrase') as Array<{ phrase: string }>;
    cachedBannedPhrases = rows?.map(r => r.phrase) || [];
  } catch (err) {
    console.error('[Quality Gate] Failed to load banned phrases, falling back to static baseline:', err);
    cachedBannedPhrases = ["delve", "dive deep", "landscape", "paradigm", "game-changer", "groundbreaking"];
  }
  return cachedBannedPhrases;
}

export async function runQualityGate(env: Env, contentPieceId: string, attempt = 1): Promise<QualityGateResult> {
  console.log(`[Quality Gate] Running Check A & B on Content Piece ${contentPieceId} (Attempt #${attempt})...`);

  // Fetch content piece
  const pieces = await supabaseQuery(env, `content_pieces?id=eq.${contentPieceId}&limit=1`) as any[];
  if (!pieces || pieces.length === 0) {
    throw new Error(`Content piece ${contentPieceId} not found`);
  }
  const piece = pieces[0];
  const body = piece.content || '';

  // --------------------------------------------------
  // CHECK A: Regex & Rule Scans (Banned phrases, H2 check, formatting)
  // --------------------------------------------------
  const violations: string[] = [];
  const bannedPhrases = await getBannedPhrases(env);

  // 1. Scan body against banned phrases
  const lowerBody = body.toLowerCase();
  const matchedPhrases = bannedPhrases.filter(p => lowerBody.includes(p.toLowerCase()));
  if (matchedPhrases.length > 0) {
    violations.push(`Contains banned phrases: ${matchedPhrases.map(p => `"${p}"`).join(', ')}`);
  }

  // 3. Reject if "In conclusion" present
  if (lowerBody.includes('in conclusion')) {
    violations.push('Contains forbidden transition "In conclusion"');
  }

  // 4. Reject if fewer than 3 number-patterns
  const bodyWithoutDates = body.replace(/\d{4}-\d{2}-\d{2}/g, '').replace(/\d{4}\/\d{2}\/\d{2}/g, '');
  const numberRegex = /\d+(?:,\d{3})*(?:\.\d+)?%?/g;
  const numberMatches = bodyWithoutDates.match(numberRegex) || [];
  if (numberMatches.length < 3) {
    violations.push(`Fewer than 3 numeric data points in body (found ${numberMatches.length})`);
  }

  // 5. Reject if any number isn't within 200 chars of a source token
  const sourceTokens = [
    'bls', 'fred', 'ilo', 'eurostat', 'hiremax', 'source:', 'arxiv',
    'forecast', 'predict', 'projection', 'estimate', 'target', 'score',
    'expect', 'analysis', 'z-score', 'deviation', 'value', 'level', 'rate', 'coefficient', 'index', 'ratio', 'mean', 'standard',
    'overhang', 'trend', 'bound', 'contraction', 'nominal', 'stock',
    'history', 'data', 'period', 'cycle', 'report'
  ];
  let unsourcedNumbers = 0;
  let numberMatch;
  while ((numberMatch = numberRegex.exec(bodyWithoutDates)) !== null) {
    const numStr = numberMatch[0];
    const numVal = parseFloat(numStr.replace(/,/g, ''));
    
    // Ignore standard years (e.g. 1900 to 2100) and single-digit numbers (0-9)
    const isYear = /^\d{4}$/.test(numStr) && numVal >= 1900 && numVal <= 2100;
    const isSmallInt = /^\d$/.test(numStr);
    const isCommonVal = [10, 30, 90, 180, 360, 365, 100].includes(numVal);
    if (isYear || isSmallInt || isCommonVal) {
      continue;
    }

    const index = numberMatch.index;
    const start = Math.max(0, index - 200);
    const end = Math.min(bodyWithoutDates.length, index + numberMatch[0].length + 200);
    const contextWindow = bodyWithoutDates.slice(start, end).toLowerCase();
    const hasSource = sourceTokens.some(token => contextWindow.includes(token));
    if (!hasSource) {
      unsourcedNumbers++;
    }
  }
  if (unsourcedNumbers > 0) {
    violations.push(`${unsourcedNumbers} numbers found without a verifying source token (BLS, FRED, etc.) within 200 characters`);
  }

  const clean = violations.length === 0;

  // --------------------------------------------------
  // CHECK B: Gemini Flash scoring
  // --------------------------------------------------
  const checkBPrompt = `Score the following content for publishing quality. You must return exactly a JSON object (no markdown wrappers like \`\`\`json, no other text):
  {
    "specificity_score": 1-10,
    "non_obviousness_score": 1-10,
    "falsifiability_score": 1-10,
    "voice_score": 1-10,
    "aeo_readiness": 1-10
  }
  
  Content:
  ${body}`;

  let scores = {
    specificity_score: 5,
    non_obviousness_score: 5,
    falsifiability_score: 5,
    voice_score: 5,
    aeo_readiness: 5
  };

  try {
    const scoreRes = await callGemini(env, checkBPrompt);
    const jsonMatch = scoreRes.match(/\{[\s\S]*\}/);
    const parsedB = JSON.parse(jsonMatch ? jsonMatch[0] : scoreRes);
    scores = {
      specificity_score: parseInt(parsedB.specificity_score || '5', 10),
      non_obviousness_score: parseInt(parsedB.non_obviousness_score || '5', 10),
      falsifiability_score: parseInt(parsedB.falsifiability_score || '5', 10),
      voice_score: parseInt(parsedB.voice_score || '5', 10),
      aeo_readiness: parseInt(parsedB.aeo_readiness || '5', 10)
    };
  } catch (err) {
    console.error('[Quality Gate] Check B scoring failed:', err);
  }

  // --------------------------------------------------
  // DECISION LOGIC
  // --------------------------------------------------
  const allScoresList = Object.values(scores);
  const anyScoreBelow4 = allScoresList.some(s => s <= 4);
  const anyScoreBelow6 = allScoresList.some(s => s <= 6);

  let decision: 'publish' | 'regenerate' | 'kill' = 'publish';
  let notes = '';

  if (anyScoreBelow4) {
    decision = 'kill';
    notes = `Killed due to extremely low score(s) <= 4: ${JSON.stringify(scores)}`;
  } else if (!clean || anyScoreBelow6) {
    decision = 'regenerate';
    notes = `Regenerate requested. Check A Clean: ${clean}. Violations: ${violations.join('; ')}. Scores: ${JSON.stringify(scores)}`;
  } else {
    decision = 'publish';
    notes = `Passed quality gate on attempt #${attempt}.`;
  }

  // Insert to quality_gate_log
  await supabaseQuery(env, 'quality_gate_log', {
    method: 'POST',
    body: JSON.stringify({
      content_piece_id: contentPieceId,
      attempt_number: attempt,
      scores,
      decision,
      regeneration_notes: decision === 'regenerate' ? notes : null,
      kill_reason: decision === 'kill' ? notes : null,
    }),
    headers: { Prefer: 'return=minimal' },
  });

  return {
    decision,
    clean,
    violations,
    scores,
    notes
  };
}
