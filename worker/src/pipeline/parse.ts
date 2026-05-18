import { Env } from '../config/env';
import { RawJob, ParsedJob } from '../types/job';
import { push as pushToDlq } from '../infra/dlq';
import { KeyPool } from '../infra/key_pool';

/**
 * AI-powered job parsing logic with tiered fallbacks and key rotation.
 * NEVER throws. Returns ParsedJob | null.
 */
export async function parseJob(
  env: Env,
  raw: RawJob,
  companySlug: string
): Promise<ParsedJob | null> {
  const groqPool = new KeyPool(env.GROQ_API_KEY);
  const systemPrompt = `You are a job posting parser. Extract structured data into the EXACT JSON format provided.
Respond with valid JSON only. No markdown, no fences.`;

  const userPrompt = `Extract from this job posting:
Title: ${raw.title}
Company: ${raw.companyName}
Location: ${raw.locationName}
Description: ${raw.description?.slice(0, 3000) ?? 'Not provided'}

Return this EXACT JSON structure:
{
  "role_category": "engineering | design | product | data | other",
  "seniority_band": "junior | mid | senior | staff | lead | other",
  "location_type": "remote | hybrid | onsite",
  "work_model": "remote | hybrid | onsite",
  "industry": "string",
  "tech_stack": ["string"],
  "requirements": ["string"],
  "company_about": "string"
}`;

  const tierErrors: string[] = [];

  // --- TIER 1: Groq (with Rotation) ---
  const groqKey = groqPool.getNextKey();
  if (groqKey) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' }
        }),
        signal: AbortSignal.timeout(12000),
      });

      if (res.ok) {
        const data: any = await res.json();
        const content = data.choices[0]?.message?.content;
        const parsed = sanitizeAndParse(content);
        if (parsed && validateParsedJob(parsed)) {
          return finalizeParsedJob(parsed);
        }
        tierErrors.push(`Groq: Validation failed for content: ${String(content).slice(0, 50)}...`);
      } else {
        const errText = await res.text();
        tierErrors.push(`Groq: HTTP ${res.status} - ${errText.slice(0, 100)}`);
      }
    } catch (err) {
      tierErrors.push(`Groq Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // --- TIER 2: Gemini ---
  if (env.GEMINI_API_KEY) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json'
          }
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        const data: any = await res.json();
        const content = data.candidates[0]?.content?.parts[0]?.text;
        const parsed = sanitizeAndParse(content);
        if (parsed && validateParsedJob(parsed)) {
          return finalizeParsedJob(parsed);
        }
        tierErrors.push(`Gemini: Validation failed for content: ${String(content).slice(0, 50)}...`);
      } else {
        const errText = await res.text();
        tierErrors.push(`Gemini: HTTP ${res.status} - ${errText.slice(0, 100)}`);
      }
    } catch (err) {
      tierErrors.push(`Gemini Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // --- TIER 3: Groq Secondary Key (Fallback) ---
  const secondGroqKey = groqPool.getNextKey();
  if (secondGroqKey) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${secondGroqKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' }
        }),
        signal: AbortSignal.timeout(12000),
      });

      if (res.ok) {
        const data: any = await res.json();
        const content = data.choices[0]?.message?.content;
        const parsed = sanitizeAndParse(content);
        if (parsed && validateParsedJob(parsed)) {
          return finalizeParsedJob(parsed);
        }
        tierErrors.push(`Groq (Fallback): Validation failed`);
      } else {
        tierErrors.push(`Groq (Fallback): HTTP ${res.status}`);
      }
    } catch (err) {
      tierErrors.push(`Groq Fallback Error: ${String(err)}`);
    }
  }

  // --- ALL TIERS FAILED ---
  const combinedError = `AI Failure Chain: [${tierErrors.join(' | ')}]`;
  console.warn(`[parse] ${combinedError}`);
  await pushToDlq(env, raw.source, companySlug, raw, combinedError);
  return null;
}

/**
 * Fills in default values for all other ParsedJob fields.
 */
function finalizeParsedJob(partial: any): ParsedJob {
  const role = partial.role_category || 'other';

  return {
    role_category: role,
    seniority_band: partial.seniority_band || 'other',
    location_type: partial.location_type || 'onsite',
    work_model: partial.work_model || 'onsite',
    industry: partial.industry || 'other',
    tech_stack: Array.isArray(partial.tech_stack) ? partial.tech_stack : [],
    requirements: Array.isArray(partial.requirements) ? partial.requirements : [],
    company_about: partial.company_about || '',
    // --- Signals & Booleans (Matches job_pointers exactly) ---
    is_remote: partial.location_type === 'remote',
    is_tech: ['engineering', 'data', 'product'].includes(role), // Auto-derived signal
    bonus_mentioned: false,
    pay_transparency: false,
    degree_required: false,
    relocation_offered: false,
    visa_sponsorship: false,
    authorized_only: false,
    clearance_required: false,
    easy_apply: false,
    cover_letter_required: false,
    portfolio_required: false,
    // --- Enums & Strings ---
    salary_currency: 'USD',
    equity_type: 'unknown',
    contract_type: 'fulltime',
    clearance_level: 'none',
    ats_type: 'other',
    // --- Collections ---
    benefits: [],
    skills: [],
    visa_types: [],
    // --- Numeric/Optional (Kept undefined for DB NULL persistence) ---
    salary_min: undefined,
    salary_max: undefined,
    total_comp_min: undefined,
    total_comp_max: undefined,
    years_exp_min: undefined,
    years_exp_max: undefined,
    hybrid_days_onsite: undefined,
  };
}

/**
 * Strips markdown fences and parses JSON safely.
 */
function sanitizeAndParse(text: string | undefined): any | null {
  if (!text) return null;
  try {
    const cleanJson = text
      .replace(/```json?/g, '')
      .replace(/```/g, '')
      .trim();
    return JSON.parse(cleanJson);
  } catch (err) {
    console.error('[parse] JSON parse error:', err, 'Raw text:', text);
    return null;
  }
}

/**
 * Validates that the parsed job contains essential fields.
 */
function validateParsedJob(job: any): boolean {
  if (!job || typeof job !== 'object') return false;
  const requiredFields = ['role_category', 'seniority_band', 'location_type', 'work_model', 'tech_stack', 'requirements'];
  for (const field of requiredFields) {
    if (!(field in job)) return false;
  }
  return true;
}
