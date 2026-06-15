// HireMax Intelligence Content Factory Worker
// HTTP Worker — triggered by webhook when Sam approves a brief
// Generates all 8 content formats sequentially (4s delays, Gemini rate-limit safe)

import { extractIntelligence } from './intelligence-extractor';
import { runQualityGate, getBannedPhrases } from './quality-gate';
import { injectSEOAEO } from './seo-aeo-injector';
import { buildTemplateAPrompt, buildTemplateBPrompt } from './templates';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  GEMINI_API_KEY: string;
  ADMIN_PASSWORD: string;
  DISTRIBUTOR_URL?: string;
  SELF?: Fetcher;
}

interface ResearchBrief {
  id: string;
  title: string;
  core_finding: string;
  supporting_data: Array<{ stat: string; source: string; context: string }>;
  content_pillar: string;
  contrarian_angle: string;
  target_keywords: string[];
  citation_potential: string;
  sams_angle: string;
}

// ============================================================
// SUPABASE HELPERS
// ============================================================
async function supabaseQuery(env: Env, path: string, opts: RequestInit = {}) {
  const url = env.SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'return=representation',
      ...(opts.headers as Record<string, string> || {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${path}: ${await res.text()}`);
  const ct = res.headers.get('content-type') || '';
  return ct.includes('json') ? res.json() : null;
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ============================================================
// GEMINI
// ============================================================
async function callGemini(env: Env, prompt: string): Promise<string> {
  const model = 'gemini-2.0-flash-exp';
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
            generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
          }),
        }
      );
      if (res.status === 429) {
        console.warn(`[Gemini] 429 Rate limited on ${model}. Retrying in 5s...`);
        await sleep(5000);
        continue;
      }
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
      const data = await res.json() as any;
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (e) {
      console.error(`[Gemini] Attempt ${attempt} failed on ${model}:`, e);
      if (attempt === 1) throw e;
      await sleep(2000);
    }
  }
  throw new Error('Gemini exhausted retries');
}

// ============================================================
// PROMPT SYSTEM
// ============================================================
const SYSTEM_PROMPT = `You are the chief research writer for HireMax Intelligence — the most authoritative independent source on global labor market data. Writing style: The Economist's analytical precision combined with Paul Graham's bluntness. You write like a human who has read the raw government datasets, not a chatbot summarizing articles.

NON-NEGOTIABLE RULES (violating any = automatic failure):
1. NEVER open with a generic statement. The first sentence must contain the single most counterintuitive specific number from the data.
2. Sam's personal angle must appear organically — NOT as a quote block, but woven into the analysis.
3. Every claim is tethered to a specific number, source, and timeframe. No vague claims.
4. Name the conventional wisdom explicitly, then dismantle it with data — not opinion.
5. Global scope by default; US-only if data is US-specific, and flag it.
6. End with a "Key Data Points" section: exactly 6 stats, format: "[Stat] ([Source], [Period])"
7. NEVER use: "in today's world", "it's no secret", "game-changer", "delve", "leveraging", "as an AI", "certainly", "navigating", "landscape", "ever-evolving", "it is worth noting", "importantly"
8. Every 350-400 words, insert a callout box using markdown blockquote: > **Key Insight:** [one-sentence synthesis that would stand alone as a tweet]`;

function buildPrompt(brief: ResearchBrief, contentType: string): string {
  const samsAngle = brief.sams_angle?.trim()
    ? `\nSAM'S PERSPECTIVE (weave naturally into the opening — his exact words are gold):\n"${brief.sams_angle}"`
    : '';
  const dataStr = JSON.stringify(brief.supporting_data);
  const kwStr = brief.target_keywords.join(', ');

  const prompts: Record<string, string> = {
    blog_post: `${SYSTEM_PROMPT}
${samsAngle}

Write a long-form research article for hiremax.site/research.

RESEARCH BRIEF:
Title: ${brief.title}
Core finding: ${brief.core_finding}
Data: ${dataStr}
Conventional wisdom being demolished: ${brief.contrarian_angle}
Target keywords (weave in naturally, never force): ${kwStr}

STRUCTURE (follow exactly, in order):
1. H1: post title — exact match to brief title
2. ANSWER CAPSULE: **Bold paragraph, 50-70 words.** Must be a self-contained summary that answers "what does this mean for someone's career right now?" AI engines extract this directly — make it the clearest, most data-dense thing on the page.
3. H2: "The Data" — what the raw numbers actually say. First paragraph (40-60 words) fully answers the H2.
4. > **Key Insight:** [one-sentence synthesis]
5. H2: "What Everyone Is Getting Wrong" — name the consensus, then destroy it with specific numbers.
6. > **Key Insight:** [one-sentence synthesis]
7. H2: "The Historical Pattern" — what has happened in 2-3 comparable historical moments.
8. H2: "What Comes Next" — one falsifiable prediction with exact timeframe and explicit invalidation conditions.
9. > **Key Insight:** [one-sentence synthesis]
10. H2: "FAQ" — exactly 4 Q&A pairs. Questions must be what a real job seeker or hiring manager would type into Google. Answers: 50-80 words, data-backed, no hedging.
11. H2: "Key Data Points" — exactly 6 stats, one per line, format: "[Stat] ([Source], [Period])"
12. Final 2 sentences: natural CTA toward HireMax product (not salesy, just contextually relevant).

LENGTH: 1,500-2,200 words total. Short articles signal thin content — don't cut corners.
OUTPUT: markdown only, no code fences around it`,

    linkedin_long: `${SYSTEM_PROMPT}

Write a LinkedIn long-form post (700-900 words).
${samsAngle}
Brief: ${JSON.stringify({ title: brief.title, core_finding: brief.core_finding, data: brief.supporting_data, angle: brief.contrarian_angle })}
Rules: Second person (you/your). Hook = most counterintuitive number in first line.
No headers. Flowing paragraphs. End with one direct question to drive comments.
Output: plain text only`,

    linkedin_short_1: `${SYSTEM_PROMPT}

Write a LinkedIn short post (100-160 words).
${samsAngle}
Brief: ${brief.title} | Finding: ${brief.core_finding}
Format: Line 1 = stat that stops scrolling. Lines 2-8 = 3-4 insight lines.
Last line = question that invites disagreement (controversy drives comments).
Output: plain text only`,

    linkedin_short_2: `${SYSTEM_PROMPT}

Write a contrarian LinkedIn short post (80-130 words) for HireMax company page.
Brief: ${brief.core_finding}
Format: Open with "Everyone says X. The data says something different."
Include one specific stat. End with "Full analysis: [link placeholder]"
Output: plain text only`,

    linkedin_carousel: `${SYSTEM_PROMPT}

Write a 10-slide LinkedIn carousel script.
Brief: ${brief.title} | Data: ${dataStr}
Format for each slide:
SLIDE N:
TITLE: [6 words max]
BODY: [2-3 lines, one idea per slide]
[DATA POINT if applicable]

Slide 1 = hook (most surprising number)
Slides 2-8 = one insight each
Slide 9 = "What this means for you" (actionable)
Slide 10 = "Follow HireMax for weekly hiring data"
Output: the slide scripts only`,

    reddit_post: `${SYSTEM_PROMPT}

Write a Reddit discussion post (200-350 words).
Finding: ${brief.core_finding}
Data: ${JSON.stringify(brief.supporting_data.slice(0, 3))}

CRITICAL RULES for Reddit:
- NO marketing tone. Sound like a curious person sharing data they found.
- Title format: "[Data] [counterintuitive finding]" — lead with the number
- Body: share the finding, show 3 data points, genuine curiosity
- End with: "What are you seeing in your own job search or hiring process?"
- Do NOT mention HireMax by name in the post.
Output:
TITLE: [title]
BODY: [body]`,

    newsletter_section: `${SYSTEM_PROMPT}

Write a newsletter section (180-220 words) for the weekly HireMax Intelligence digest.
Brief: ${brief.title} | Finding: ${brief.core_finding} | Data: ${JSON.stringify(brief.supporting_data.slice(0, 2))}
Format:
- Section header: "This Week's Finding"
- 2 paragraphs: finding + implication
- "The number: [single most important stat]"
- "Read the full analysis: [link placeholder]"
Output: plain text, newsletter format`,

    hn_post: `${SYSTEM_PROMPT}

Write a Hacker News Show HN post (100-200 words).
Brief: ${brief.title} | Finding: ${brief.core_finding}
Format:
TITLE: Show HN: [finding with specific number] [link: hiremax.site/research/[slug]]
BODY: [description of methodology and data sources — HN readers care about HOW you got the data]
Tone: technical, factual, no marketing
Output:
TITLE: [title]
BODY: [body]`,
  };

  return prompts[contentType] || '';
}

// ============================================================
// QUALITY GATE
// ============================================================
async function qualityCheck(env: Env, content: string, type: string): Promise<boolean> {
  const checkPrompt = `Score this ${type} content. Return JSON only — no explanation, no code blocks.
{"scores":{"has_original_data":0-2,"breaks_conventional_wisdom":0-2,"no_ai_phrases":0-2,"globally_relevant":0-2,"specific_numbers":0-2},"total":0-10,"pass":true|false}
Pass threshold: total >= 7.
Content sample: ${content.slice(0, 800)}`;
  try {
    const result = await callGemini(env, checkPrompt);
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const parsed = JSON.parse(jsonMatch[0].trim());
    console.log(`[QA] ${type}: ${parsed.total}/10 — ${parsed.pass ? 'PASS' : 'FAIL'}`);
    return parsed.pass;
  } catch {
    return true; // On parse error, don't block
  }
}

// ============================================================
// SCHEDULING LOGIC
// ============================================================
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function setUTCHour(date: Date, hour: number): Date {
  const d = new Date(date);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}

function scheduleContent(type: string, approvedAt: Date): Date | null {
  const schedule: Record<string, () => Date | null> = {
    blog_post: () => approvedAt, // Immediate publishing
    linkedin_long: () => setUTCHour(addDays(approvedAt, 1), 7),
    linkedin_short_1: () => setUTCHour(addDays(approvedAt, 1), 12),
    linkedin_carousel: () => setUTCHour(addDays(approvedAt, 2), 7),
    linkedin_short_2: () => setUTCHour(addDays(approvedAt, 2), 12),
    reddit_post: () => setUTCHour(addDays(approvedAt, 1), 20),
    hn_post: () => setUTCHour(addDays(approvedAt, 3), 14),
    newsletter_section: () => null, // Collected weekly
  };
  return schedule[type]?.() ?? addDays(approvedAt, 1);
}

// ============================================================
// SLUG GENERATOR
// ============================================================
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80) + '-' + Date.now().toString(36);
}

// ============================================================
// EXTRACT FAQ PAIRS FROM BLOG POST
// ============================================================
function extractFAQPairs(markdown: string): Array<{ question: string; answer: string }> {
  const faqSection = markdown.match(/##\s*(?:FAQ|Frequently Asked Questions?)([\s\S]*?)(?=##|$)/i);
  if (!faqSection) return [];
  const pairs: Array<{ question: string; answer: string }> = [];
  const qPattern = /###?\s*(.+?)\n+([\s\S]+?)(?=###?\s*|$)/g;
  let match;
  while ((match = qPattern.exec(faqSection[1])) !== null) {
    pairs.push({
      question: match[1].trim().replace(/\*\*/g, ''),
      answer: match[2].trim().replace(/\*\*/g, '').slice(0, 300),
    });
    if (pairs.length >= 5) break;
  }
  return pairs;
}

// ============================================================
// MAIN GENERATION FLOW
// ============================================================
async function generateAllContent(env: Env, briefId: string, origin: string): Promise<void> {
  // Fetch brief
  const briefs = await supabaseQuery(env, `research_briefs?id=eq.${briefId}&limit=1`) as ResearchBrief[];
  if (!briefs || briefs.length === 0) throw new Error(`Brief ${briefId} not found`);
  const brief = briefs[0];

  const approvedAt = new Date();
  const contentTypes = [
    'blog_post', 'linkedin_long', 'linkedin_short_1',
    'linkedin_short_2', 'linkedin_carousel',
    'reddit_post', 'newsletter_section',
  ];
  if (brief.citation_potential === 'high') contentTypes.push('hn_post');

  // Query existing content pieces for this brief
  const existing = await supabaseQuery(env, `content_pieces?brief_id=eq.${briefId}&select=content_type`) as Array<{ content_type: string }>;
  const existingTypes = new Set(existing?.map(e => e.content_type) || []);

  // Find the first content type that is not yet generated
  const contentType = contentTypes.find(t => !existingTypes.has(t));
  if (!contentType) {
    console.log(`[Factory] All content formats for brief ${briefId} have already been generated.`);
    return;
  }

  console.log(`[Factory] Chained execution: Generating ${contentType} for brief ${briefId}...`);
  try {
    const prompt = buildPrompt(brief, contentType);
    let content = await callGemini(env, prompt);

    // Quality check — regenerate once if fails
    const passed = await qualityCheck(env, content, contentType);
    if (!passed) {
      console.log(`[Factory] QA failed for ${contentType} — regenerating...`);
      await sleep(2000);
      content = await callGemini(env, prompt + '\n\nPrevious attempt scored below 7/10 on: specific numbers, breaking conventional wisdom. Fix both.');
    }

    const scheduledFor = scheduleContent(contentType, approvedAt);
    const slug = contentType === 'blog_post' ? generateSlug(brief.title) : null;

    // Build SEO meta for blog posts
    const seoMeta = contentType === 'blog_post' ? {
      description: brief.core_finding.slice(0, 160),
      keywords: brief.target_keywords.join(', '),
      og_title: brief.title,
      og_description: brief.core_finding.slice(0, 100),
    } : {};

    // Article + Dataset + FAQ schema for blog posts
    const schemaMarkup = contentType === 'blog_post' ? {
      article: {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: brief.title,
        description: brief.core_finding.slice(0, 160),
        author: { '@type': 'Person', name: "Harsimar 'sam' Singh", jobTitle: 'Founder', worksFor: { '@type': 'Organization', name: 'HireMax' }, url: 'https://www.hiremax.site' },
        publisher: { '@type': 'Organization', name: 'HireMax', url: 'https://www.hiremax.site' },
        keywords: brief.target_keywords.join(', '),
      },
      dataset: {
        '@context': 'https://schema.org',
        '@type': 'Dataset',
        name: `HireMax ${brief.content_pillar} Intelligence`,
        description: brief.core_finding.slice(0, 160),
        creator: { '@type': 'Organization', name: 'HireMax Intelligence' },
        license: 'https://creativecommons.org/licenses/by/4.0/',
        url: slug ? `https://www.hiremax.site/research/${slug}` : '',
      },
    } : {};

    // Insert into content_pieces
    const pieceData: Record<string, unknown> = {
      brief_id: briefId,
      content_type: contentType,
      title: brief.title,
      slug,
      content,
      schema_markup: schemaMarkup,
      seo_meta: seoMeta,
      status: scheduledFor ? 'scheduled' : 'pending',
      scheduled_for: scheduledFor?.toISOString() || null,
      platform: contentType.startsWith('linkedin') ? 'linkedin'
        : contentType === 'reddit_post' ? 'reddit'
        : contentType === 'hn_post' ? 'hn'
        : contentType === 'newsletter_section' ? 'newsletter'
        : 'blog',
    };

    await supabaseQuery(env, 'content_pieces', {
      method: 'POST',
      body: JSON.stringify(pieceData),
      headers: { Prefer: 'return=minimal' },
    });

    // For blog posts, also insert into blog_posts table
    if (contentType === 'blog_post' && slug) {
      const faqPairs = extractFAQPairs(content);
      await supabaseQuery(env, 'blog_posts', {
        method: 'POST',
        body: JSON.stringify({
          brief_id: briefId,
          slug,
          title: brief.title,
          content_markdown: content,
          seo_meta: seoMeta,
          schema_markup: schemaMarkup,
          pillar: brief.content_pillar,
          faq_pairs: faqPairs,
          status: 'draft', // Distributor publishes it when scheduled_for is due
        }),
        headers: { Prefer: 'return=minimal' },
      });
    }

    console.log(`[Factory] ✅ ${contentType} created successfully.`);

    // Find if there is a next content type in the list to chain
    const remainingTypes = contentTypes.filter(t => t !== contentType && !existingTypes.has(t));
    if (remainingTypes.length > 0) {
      console.log(`[Factory] Chaining to next type. Remaining types count: ${remainingTypes.length}`);
      try {
        const url = env.SELF ? 'http://self/generate' : `${origin}/generate`;
        const caller = env.SELF || { fetch: globalThis.fetch };
        console.log(`[Factory] Triggering self webhook: ${url}`);
        const res = await caller.fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.ADMIN_PASSWORD?.trim()}`,
          },
          body: JSON.stringify({ briefId }),
        });
        console.log(`[Factory] Self webhook response status: ${res.status}`);
      } catch (triggerError) {
        console.error(`[Factory] Failed to chain trigger self-webhook:`, triggerError);
      }
    } else {
      console.log(`[Factory] Chained generation complete. All formats generated for brief ${briefId}.`);
    }

  } catch (e) {
    console.error(`[Factory] ❌ Failed to generate ${contentType}:`, e);
  }
}

// ============================================================
// NEW MULTI-SIGNAL ANTI-SLOP WORKFLOWS
// ============================================================
async function triggerDistributor(env: Env) {
  const distributorUrl = env.DISTRIBUTOR_URL || 'https://hiremax-intelligence-distributor.singh-harsimar23.workers.dev';
  try {
    const res = await fetch(`${distributorUrl}/trigger-distribute`, {
      method: 'POST',
    });
    console.log(`[Factory] Distributor trigger response: status=${res.status}`);
  } catch (e) {
    console.error('[Factory] Failed to trigger distributor:', e);
  }
}

// HELPER FOR SELF-TRIGGER WEBHOOK
async function selfTrigger(env: Env, origin: string, password: string | undefined, body: any) {
  try {
    const url = env.SELF ? 'http://self/generate' : `${origin}/generate`;
    const caller = env.SELF || { fetch: globalThis.fetch };
    const res = await caller.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${password?.trim()}`,
      },
      body: JSON.stringify(body),
    });
    console.log(`[SelfTrigger] ${body.type} response: status=${res.status}`);
  } catch (err) {
    console.error(`[SelfTrigger] ${body.type} failed:`, err);
  }
}

// --------------------------------------------------
// STANDARD BRIEF WORKFLOW
// --------------------------------------------------

// STEP 1: Extract Intelligence from Signal
async function generateStandardBrief(env: Env, signalId: string, origin: string): Promise<void> {
  console.log(`[Factory] Standard Brief Step 1: Ingestion & Extraction for signalId=${signalId}`);
  try {
    const signals = await supabaseQuery(env, `domain_signals?id=eq.${signalId}&limit=1`) as any[];
    if (!signals || signals.length === 0) {
      throw new Error(`Signal ${signalId} not found`);
    }
    const signal = signals[0];

    const intel = await extractIntelligence(env as any, signal);
    
    // Trigger Step 2: Content Generation
    await selfTrigger(env, origin, env.ADMIN_PASSWORD, {
      type: 'standard_intelligence_generate',
      signal_id: signalId,
      intel,
    });
  } catch (err: any) {
    console.error(`[Factory] Error in generateStandardBrief Step 1:`, err);
  }
}

// STEP 2: Content Generation
async function generateStandardBrief_generate(
  env: Env,
  signalId: string,
  intel: any,
  origin: string,
  attempt = 1,
  appendNotes = '',
  existingPieceId?: string,
  existingBlogPostId?: string
): Promise<void> {
  console.log(`[Factory] Standard Brief Step 2: Content Generation for signalId=${signalId}, attempt=${attempt}`);
  try {
    const bannedPhrases = await getBannedPhrases(env as any);

    let prompt = buildTemplateAPrompt(intel, bannedPhrases);
    if (appendNotes) {
      prompt += `\n\nREGENERATION NOTES/FEEDBACK (Please correct these violations in the rewrite):\n${appendNotes}`;
    }

    const geminiRes = await callGemini(env, prompt);
    const jsonMatch = geminiRes.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`Invalid JSON format returned from Gemini: ${geminiRes}`);
    }
    const parsed = JSON.parse(jsonMatch[0].trim());

    const slug = generateSlug(parsed.title);
    const seoMeta = {
      description: parsed.content.slice(0, 160).replace(/\*\*/g, '').trim(),
      keywords: (parsed.secondary_keywords || []).join(', '),
      og_title: parsed.title,
      og_description: parsed.content.slice(0, 100).replace(/\*\*/g, '').trim(),
    };

    const pieceData = {
      title: parsed.title,
      content: parsed.content,
      content_type: 'blog_post',
      status: 'pending',
      platform: 'blog',
      scheduled_for: new Date().toISOString(),
    };

    let pieceId = existingPieceId;
    if (existingPieceId) {
      await supabaseQuery(env, `content_pieces?id=eq.${existingPieceId}`, {
        method: 'PATCH',
        body: JSON.stringify(pieceData),
        headers: { Prefer: 'return=minimal' },
      });
    } else {
      const inserted = await supabaseQuery(env, 'content_pieces', {
        method: 'POST',
        body: JSON.stringify(pieceData),
      }) as any[];
      if (!inserted || inserted.length === 0) throw new Error("Failed to insert content piece");
      pieceId = inserted[0].id;
    }

    const faqPairs = parsed.faq || [];
    const blogPostData = {
      content_piece_id: pieceId,
      slug,
      title: parsed.title,
      content_markdown: parsed.content,
      pillar: intel.vertical,
      faq_pairs: faqPairs,
      status: 'draft',
      seo_meta: seoMeta,
      schema_markup: {},
    };

    let blogPostId = existingBlogPostId;
    if (existingBlogPostId) {
      await supabaseQuery(env, `blog_posts?id=eq.${existingBlogPostId}`, {
        method: 'PATCH',
        body: JSON.stringify(blogPostData),
        headers: { Prefer: 'return=minimal' },
      });
    } else {
      const inserted = await supabaseQuery(env, 'blog_posts', {
        method: 'POST',
        body: JSON.stringify(blogPostData),
      }) as any[];
      if (!inserted || inserted.length === 0) throw new Error("Failed to insert blog post");
      blogPostId = inserted[0].id;
    }

    // Trigger Step 3: QA
    await selfTrigger(env, origin, env.ADMIN_PASSWORD, {
      type: 'standard_intelligence_qa',
      signal_id: signalId,
      intel,
      piece_id: pieceId,
      blog_post_id: blogPostId,
      attempt,
    });
  } catch (err: any) {
    console.error(`[Factory] Error in generateStandardBrief Step 2:`, err);
  }
}

// STEP 3: Quality Gate & Decision
async function generateStandardBrief_qa(
  env: Env,
  signalId: string,
  intel: any,
  pieceId: string,
  blogPostId: string,
  origin: string,
  attempt: number
): Promise<void> {
  console.log(`[Factory] Standard Brief Step 3: QA for signalId=${signalId}, pieceId=${pieceId}, attempt=${attempt}`);
  try {
    const qgRes = await runQualityGate(env as any, pieceId, attempt);

    if (qgRes.decision === 'publish') {
      const composite = (qgRes.scores.specificity_score + qgRes.scores.non_obviousness_score + qgRes.scores.falsifiability_score + qgRes.scores.voice_score + qgRes.scores.aeo_readiness) / 5;
      
      await supabaseQuery(env, `content_pieces?id=eq.${pieceId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'approved',
          quality_score: composite,
        }),
        headers: { Prefer: 'return=minimal' },
      });

      await supabaseQuery(env, `domain_signals?id=eq.${signalId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          content_generated: true,
          insight_extracted: true,
          quality_gate_score: qgRes.scores,
          quality_gate_decision: 'publish',
        }),
        headers: { Prefer: 'return=minimal' },
      });

      if (intel.prediction && intel.prediction.confidence_score >= 6) {
        await supabaseQuery(env, 'predictions', {
          method: 'POST',
          body: JSON.stringify({
            prediction_text: intel.prediction.prediction_statement,
            prediction_direction: intel.prediction.direction,
            prediction_magnitude_range: intel.prediction.magnitude_range,
            prediction_metric: intel.prediction.prediction_metric,
            prediction_source: intel.prediction.prediction_source,
            prediction_timeframe: intel.prediction.prediction_timeframe,
            confidence_score: intel.prediction.confidence_score,
            invalidation_conditions: intel.prediction.invalidation_conditions,
            content_piece_id: pieceId,
          }),
          headers: { Prefer: 'return=minimal' },
        });
      }

      // Trigger Step 4: SEO
      await selfTrigger(env, origin, env.ADMIN_PASSWORD, {
        type: 'standard_intelligence_seo',
        piece_id: pieceId,
      });

    } else if (qgRes.decision === 'regenerate' && attempt < 3) {
      console.log(`[Factory] QA requested regeneration for Standard Brief attempt #${attempt}. Recursing...`);
      await selfTrigger(env, origin, env.ADMIN_PASSWORD, {
        type: 'standard_intelligence_generate',
        signal_id: signalId,
        intel,
        attempt: attempt + 1,
        appendNotes: qgRes.notes || '',
        existingPieceId: pieceId,
        existingBlogPostId: blogPostId,
      });
    } else {
      console.log(`[Factory] Standard Brief killed/failed. Reason: ${qgRes.notes}`);
      await supabaseQuery(env, `content_pieces?id=eq.${pieceId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'killed' }),
        headers: { Prefer: 'return=minimal' },
      });

      await supabaseQuery(env, `domain_signals?id=eq.${signalId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          content_generated: false,
          quality_gate_score: qgRes.scores,
          quality_gate_decision: 'kill',
        }),
        headers: { Prefer: 'return=minimal' },
      });
    }
  } catch (err: any) {
    console.error(`[Factory] Error in generateStandardBrief Step 3:`, err);
  }
}

// STEP 4: SEO Optimization & Distributor Trigger
async function generateStandardBrief_seo(env: Env, pieceId: string): Promise<void> {
  console.log(`[Factory] Standard Brief Step 4: SEO Optimization for pieceId=${pieceId}`);
  try {
    await injectSEOAEO(env as any, pieceId);
    await triggerDistributor(env);
    console.log(`[Factory] Standard Brief Step 4 Complete. Published: ${pieceId}`);
  } catch (err: any) {
    console.error(`[Factory] Error in generateStandardBrief Step 4:`, err);
  }
}


// --------------------------------------------------
// CONVERGENCE BRIEF WORKFLOW
// --------------------------------------------------

// STEP 1: Extract Intelligence from Signal
async function generateConvergenceBrief(env: Env, convergenceSignalId: string, origin: string): Promise<void> {
  console.log(`[Factory] Convergence Brief Step 1: Extraction for convergenceSignalId=${convergenceSignalId}`);
  try {
    const convSignals = await supabaseQuery(env, `convergence_signals?id=eq.${convergenceSignalId}&limit=1`) as any[];
    if (!convSignals || convSignals.length === 0) {
      throw new Error(`Convergence signal ${convergenceSignalId} not found`);
    }
    const convSignal = convSignals[0];

    const signalIds = convSignal.signal_ids || [];
    if (signalIds.length === 0) {
      throw new Error(`Convergence signal ${convergenceSignalId} has no signal_ids`);
    }
    const signals = await supabaseQuery(env, `domain_signals?id=eq.${signalIds[0]}&limit=1`) as any[];
    if (!signals || signals.length === 0) {
      throw new Error(`First signal ${signalIds[0]} not found in domain_signals`);
    }
    const signal = signals[0];

    const intel = await extractIntelligence(env as any, signal);

    // Trigger Step 2: Content Generation
    await selfTrigger(env, origin, env.ADMIN_PASSWORD, {
      type: 'convergence_brief_generate',
      convergence_signal_id: convergenceSignalId,
      conv_signal_details: convSignal,
      intel,
    });
  } catch (err: any) {
    console.error(`[Factory] Error in generateConvergenceBrief Step 1:`, err);
  }
}

// STEP 2: Content Generation
async function generateConvergenceBrief_generate(
  env: Env,
  convergenceSignalId: string,
  convSignalDetails: any,
  intel: any,
  origin: string,
  attempt = 1,
  appendNotes = '',
  existingPieceId?: string,
  existingBlogPostId?: string
): Promise<void> {
  console.log(`[Factory] Convergence Brief Step 2: Content Generation for convergenceSignalId=${convergenceSignalId}, attempt=${attempt}`);
  try {
    const bannedPhrases = await getBannedPhrases(env as any);

    let prompt = buildTemplateBPrompt(intel, convSignalDetails, bannedPhrases);
    if (appendNotes) {
      prompt += `\n\nREGENERATION NOTES/FEEDBACK (Please correct these violations in the rewrite):\n${appendNotes}`;
    }

    const geminiRes = await callGemini(env, prompt);
    const jsonMatch = geminiRes.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`Invalid JSON format returned from Gemini: ${geminiRes}`);
    }
    const parsed = JSON.parse(jsonMatch[0].trim());

    const slug = generateSlug(parsed.title);
    const seoMeta = {
      description: parsed.content.slice(0, 160).replace(/\*\*/g, '').trim(),
      keywords: `convergence, ${convSignalDetails.vertical_a}, ${convSignalDetails.vertical_b}, hiring data`,
      og_title: parsed.title,
      og_description: parsed.content.slice(0, 100).replace(/\*\*/g, '').trim(),
    };

    const pieceData = {
      title: parsed.title,
      content: parsed.content,
      content_type: 'blog_post',
      status: 'pending',
      platform: 'blog',
      scheduled_for: new Date().toISOString(),
    };

    let pieceId = existingPieceId;
    if (existingPieceId) {
      await supabaseQuery(env, `content_pieces?id=eq.${existingPieceId}`, {
        method: 'PATCH',
        body: JSON.stringify(pieceData),
        headers: { Prefer: 'return=minimal' },
      });
    } else {
      const inserted = await supabaseQuery(env, 'content_pieces', {
        method: 'POST',
        body: JSON.stringify(pieceData),
      }) as any[];
      if (!inserted || inserted.length === 0) throw new Error("Failed to insert content piece");
      pieceId = inserted[0].id;
    }

    const faqPairs = parsed.faq || [];
    const blogPostData = {
      content_piece_id: pieceId,
      slug,
      title: parsed.title,
      content_markdown: parsed.content,
      pillar: `${convSignalDetails.vertical_a}_${convSignalDetails.vertical_b}`,
      faq_pairs: faqPairs,
      status: 'draft',
      seo_meta: seoMeta,
      schema_markup: {},
    };

    let blogPostId = existingBlogPostId;
    if (existingBlogPostId) {
      await supabaseQuery(env, `blog_posts?id=eq.${existingBlogPostId}`, {
        method: 'PATCH',
        body: JSON.stringify(blogPostData),
        headers: { Prefer: 'return=minimal' },
      });
    } else {
      const inserted = await supabaseQuery(env, 'blog_posts', {
        method: 'POST',
        body: JSON.stringify(blogPostData),
      }) as any[];
      if (!inserted || inserted.length === 0) throw new Error("Failed to insert blog post");
      blogPostId = inserted[0].id;
    }

    await supabaseQuery(env, `convergence_signals?id=eq.${convergenceSignalId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        content_piece_id: pieceId,
        status: 'generated',
      }),
      headers: { Prefer: 'return=minimal' },
    });

    // Trigger Step 3: QA
    await selfTrigger(env, origin, env.ADMIN_PASSWORD, {
      type: 'convergence_brief_qa',
      convergence_signal_id: convergenceSignalId,
      conv_signal_details: convSignalDetails,
      intel,
      piece_id: pieceId,
      blog_post_id: blogPostId,
      attempt,
    });
  } catch (err: any) {
    console.error(`[Factory] Error in generateConvergenceBrief Step 2:`, err);
  }
}

// STEP 3: Quality Gate & Decision
async function generateConvergenceBrief_qa(
  env: Env,
  convergenceSignalId: string,
  convSignalDetails: any,
  intel: any,
  pieceId: string,
  blogPostId: string,
  origin: string,
  attempt: number
): Promise<void> {
  console.log(`[Factory] Convergence Brief Step 3: QA for convergenceSignalId=${convergenceSignalId}, pieceId=${pieceId}, attempt=${attempt}`);
  try {
    const qgRes = await runQualityGate(env as any, pieceId, attempt);

    if (qgRes.decision === 'publish') {
      const composite = (qgRes.scores.specificity_score + qgRes.scores.non_obviousness_score + qgRes.scores.falsifiability_score + qgRes.scores.voice_score + qgRes.scores.aeo_readiness) / 5;

      await supabaseQuery(env, `content_pieces?id=eq.${pieceId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'approved',
          quality_score: composite,
        }),
        headers: { Prefer: 'return=minimal' },
      });

      await supabaseQuery(env, `convergence_signals?id=eq.${convergenceSignalId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'published' }),
        headers: { Prefer: 'return=minimal' },
      });

      // Trigger Step 4: SEO
      await selfTrigger(env, origin, env.ADMIN_PASSWORD, {
        type: 'convergence_brief_seo',
        piece_id: pieceId,
      });

    } else if (qgRes.decision === 'regenerate' && attempt < 3) {
      console.log(`[Factory] QA requested regeneration for Convergence Brief attempt #${attempt}. Recursing...`);
      await selfTrigger(env, origin, env.ADMIN_PASSWORD, {
        type: 'convergence_brief_generate',
        convergence_signal_id: convergenceSignalId,
        conv_signal_details: convSignalDetails,
        intel,
        attempt: attempt + 1,
        appendNotes: qgRes.notes || '',
        existingPieceId: pieceId,
        existingBlogPostId: blogPostId,
      });
    } else {
      console.log(`[Factory] Convergence Brief killed/failed. Reason: ${qgRes.notes}`);
      await supabaseQuery(env, `content_pieces?id=eq.${pieceId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'killed' }),
        headers: { Prefer: 'return=minimal' },
      });

      await supabaseQuery(env, `convergence_signals?id=eq.${convergenceSignalId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'failed' }),
        headers: { Prefer: 'return=minimal' },
      });
    }
  } catch (err: any) {
    console.error(`[Factory] Error in generateConvergenceBrief Step 3:`, err);
  }
}

// STEP 4: SEO Optimization & Distributor Trigger
async function generateConvergenceBrief_seo(env: Env, pieceId: string): Promise<void> {
  console.log(`[Factory] Convergence Brief Step 4: SEO Optimization for pieceId=${pieceId}`);
  try {
    await injectSEOAEO(env as any, pieceId);
    await triggerDistributor(env);
    console.log(`[Factory] Convergence Brief Step 4 Complete. Published: ${pieceId}`);
  } catch (err: any) {
    console.error(`[Factory] Error in generateConvergenceBrief Step 4:`, err);
  }
}


// --------------------------------------------------
// PREDICTION OUTCOME BRIEF WORKFLOW
// --------------------------------------------------

// STEP 1: Content Generation
async function generatePredictionOutcomeBrief(env: Env, predictionId: string, origin: string): Promise<void> {
  await generatePredictionOutcomeBrief_generate(env, predictionId, origin, 1);
}

async function generatePredictionOutcomeBrief_generate(
  env: Env,
  predictionId: string,
  origin: string,
  attempt = 1,
  appendNotes = '',
  existingPieceId?: string,
  existingBlogPostId?: string
): Promise<void> {
  console.log(`[Factory] Prediction Outcome Step 1: Content Generation for predictionId=${predictionId}, attempt=${attempt}`);
  try {
    const predictions = await supabaseQuery(env, `predictions?id=eq.${predictionId}&limit=1`) as any[];
    if (!predictions || predictions.length === 0) {
      throw new Error(`Prediction ${predictionId} not found`);
    }
    const prediction = predictions[0];

    let prompt = `You are Harsimar 'sam' Singh, the founder of HireMax. Write a short, one-paragraph update (called-it / missed-it piece) for our research audience.
You must state the original prediction verbatim, explain the actual outcome, and state whether the prediction was directionally correct.
Be honest, direct, and slightly combative/factual even when wrong. No corporate fluff, no AI slop.

Original Prediction: "${prediction.prediction_text}"
Timeframe: ${prediction.prediction_timeframe}
Stated Metric: ${prediction.prediction_metric}
Actual Outcome Value: ${prediction.outcome_value}
Directional Correctness: ${prediction.prediction_correct ? 'CORRECT' : 'WRONG/INCORRECT'}
Accuracy Note: ${prediction.accuracy_note}

You MUST return exactly a JSON object matching this structure (no markdown code blocks, just pure JSON):
{
  "title": "Headline (short, punchy title)",
  "content": "A single, strong paragraph containing the verbatim prediction, actual outcome, and directional correctness statement. Keep it under 150 words."
}`;

    if (appendNotes) {
      prompt += `\n\nREGENERATION NOTES/FEEDBACK (Please correct these violations in the rewrite):\n${appendNotes}`;
    }

    const geminiRes = await callGemini(env, prompt);
    const jsonMatch = geminiRes.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`Invalid JSON format returned from Gemini: ${geminiRes}`);
    }
    const parsed = JSON.parse(jsonMatch[0].trim());

    const slug = generateSlug(parsed.title);
    const seoMeta = {
      description: parsed.content.slice(0, 160).replace(/\*\*/g, '').trim(),
      keywords: `prediction outcome, ${prediction.prediction_metric}, hiring data`,
      og_title: parsed.title,
      og_description: parsed.content.slice(0, 100).replace(/\*\*/g, '').trim(),
    };

    const pieceData = {
      title: parsed.title,
      content: parsed.content,
      content_type: 'blog_post',
      status: 'pending',
      platform: 'blog',
      scheduled_for: new Date().toISOString(),
    };

    let pieceId = existingPieceId;
    if (existingPieceId) {
      await supabaseQuery(env, `content_pieces?id=eq.${existingPieceId}`, {
        method: 'PATCH',
        body: JSON.stringify(pieceData),
        headers: { Prefer: 'return=minimal' },
      });
    } else {
      const inserted = await supabaseQuery(env, 'content_pieces', {
        method: 'POST',
        body: JSON.stringify(pieceData),
      }) as any[];
      if (!inserted || inserted.length === 0) throw new Error("Failed to insert content piece");
      pieceId = inserted[0].id;
    }

    const blogPostData = {
      content_piece_id: pieceId,
      slug,
      title: parsed.title,
      content_markdown: parsed.content,
      pillar: 'prediction_outcome',
      faq_pairs: [],
      status: 'draft',
      seo_meta: seoMeta,
      schema_markup: {},
    };

    let blogPostId = existingBlogPostId;
    if (existingBlogPostId) {
      await supabaseQuery(env, `blog_posts?id=eq.${existingBlogPostId}`, {
        method: 'PATCH',
        body: JSON.stringify(blogPostData),
        headers: { Prefer: 'return=minimal' },
      });
    } else {
      const inserted = await supabaseQuery(env, 'blog_posts', {
        method: 'POST',
        body: JSON.stringify(blogPostData),
      }) as any[];
      if (!inserted || inserted.length === 0) throw new Error("Failed to insert blog post");
      blogPostId = inserted[0].id;
    }

    await supabaseQuery(env, `predictions?id=eq.${predictionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ content_piece_id: pieceId }),
      headers: { Prefer: 'return=minimal' },
    });

    // Trigger Step 2: QA
    await selfTrigger(env, origin, env.ADMIN_PASSWORD, {
      type: 'prediction_outcome_qa',
      prediction_id: predictionId,
      piece_id: pieceId,
      blog_post_id: blogPostId,
      attempt,
    });
  } catch (err: any) {
    console.error(`[Factory] Error in generatePredictionOutcomeBrief Step 1:`, err);
  }
}

// STEP 2: Quality Gate & Decision
async function generatePredictionOutcomeBrief_qa(
  env: Env,
  predictionId: string,
  pieceId: string,
  blogPostId: string,
  origin: string,
  attempt: number
): Promise<void> {
  console.log(`[Factory] Prediction Outcome Step 2: QA for predictionId=${predictionId}, pieceId=${pieceId}, attempt=${attempt}`);
  try {
    const qgRes = await runQualityGate(env as any, pieceId, attempt);

    if (qgRes.decision === 'publish') {
      const composite = (qgRes.scores.specificity_score + qgRes.scores.non_obviousness_score + qgRes.scores.falsifiability_score + qgRes.scores.voice_score + qgRes.scores.aeo_readiness) / 5;

      await supabaseQuery(env, `content_pieces?id=eq.${pieceId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'approved',
          quality_score: composite,
        }),
        headers: { Prefer: 'return=minimal' },
      });

      await triggerDistributor(env);
      console.log(`[Factory] Prediction Outcome Brief published successfully: ${pieceId}`);

    } else if (qgRes.decision === 'regenerate' && attempt < 3) {
      console.log(`[Factory] QA requested regeneration for Prediction Outcome Brief attempt #${attempt}. Recursing...`);
      await selfTrigger(env, origin, env.ADMIN_PASSWORD, {
        type: 'prediction_outcome_generate',
        prediction_id: predictionId,
        attempt: attempt + 1,
        appendNotes: qgRes.notes || '',
        existingPieceId: pieceId,
        existingBlogPostId: blogPostId,
      });
    } else {
      console.log(`[Factory] Prediction Outcome Brief killed/failed. Reason: ${qgRes.notes}`);
      await supabaseQuery(env, `content_pieces?id=eq.${pieceId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'killed' }),
        headers: { Prefer: 'return=minimal' },
      });
    }
  } catch (err: any) {
    console.error(`[Factory] Error in generatePredictionOutcomeBrief Step 2:`, err);
  }
}

// ============================================================
// WORKER ENTRY
// ============================================================
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': 'https://www.hiremax.site',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    const url = new URL(request.url);

    if (url.pathname !== '/generate' || request.method !== 'POST') {
      return new Response('HireMax Content Factory — POST /generate', { status: 200 });
    }

    // Auth check
    const auth = request.headers.get('Authorization') || '';
    if (auth.replace('Bearer ', '').trim() !== env.ADMIN_PASSWORD?.trim()) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await request.json() as any;
    const origin = new URL(request.url).origin;

    if (body.type) {
      if (body.type === 'standard_intelligence') {
        const signalId = body.signal_id || body.signalId;
        if (!signalId) return new Response(JSON.stringify({ error: 'signal_id required for standard_intelligence' }), { status: 400 });
        ctx.waitUntil(
          generateStandardBrief(env, signalId, origin).catch(e => console.error('[Factory] Standard Brief generation failed:', e))
        );
        return new Response(JSON.stringify({ ok: true, message: 'Standard brief generation started' }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://www.hiremax.site' },
        });
      } else if (body.type === 'standard_intelligence_generate') {
        const signalId = body.signal_id || body.signalId;
        ctx.waitUntil(
          generateStandardBrief_generate(env, signalId, body.intel, origin, body.attempt, body.appendNotes, body.existingPieceId, body.existingBlogPostId)
            .catch(e => console.error('[Factory] Standard Brief generation step 2 failed:', e))
        );
        return new Response(JSON.stringify({ ok: true }));
      } else if (body.type === 'standard_intelligence_qa') {
        const signalId = body.signal_id || body.signalId;
        ctx.waitUntil(
          generateStandardBrief_qa(env, signalId, body.intel, body.piece_id, body.blog_post_id, origin, body.attempt)
            .catch(e => console.error('[Factory] Standard Brief QA step 3 failed:', e))
        );
        return new Response(JSON.stringify({ ok: true }));
      } else if (body.type === 'standard_intelligence_seo') {
        ctx.waitUntil(
          generateStandardBrief_seo(env, body.piece_id)
            .catch(e => console.error('[Factory] Standard Brief SEO step 4 failed:', e))
        );
        return new Response(JSON.stringify({ ok: true }));
      } else if (body.type === 'convergence_brief') {
        const convSignalId = body.convergence_signal_id || body.convergenceSignalId;
        if (!convSignalId) return new Response(JSON.stringify({ error: 'convergence_signal_id required for convergence_brief' }), { status: 400 });
        ctx.waitUntil(
          generateConvergenceBrief(env, convSignalId, origin).catch(e => console.error('[Factory] Convergence Brief generation failed:', e))
        );
        return new Response(JSON.stringify({ ok: true, message: 'Convergence brief generation started' }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://www.hiremax.site' },
        });
      } else if (body.type === 'convergence_brief_generate') {
        const convSignalId = body.convergence_signal_id || body.convergenceSignalId;
        ctx.waitUntil(
          generateConvergenceBrief_generate(env, convSignalId, body.conv_signal_details, body.intel, origin, body.attempt, body.appendNotes, body.existingPieceId, body.existingBlogPostId)
            .catch(e => console.error('[Factory] Convergence Brief generation step 2 failed:', e))
        );
        return new Response(JSON.stringify({ ok: true }));
      } else if (body.type === 'convergence_brief_qa') {
        const convSignalId = body.convergence_signal_id || body.convergenceSignalId;
        ctx.waitUntil(
          generateConvergenceBrief_qa(env, convSignalId, body.conv_signal_details, body.intel, body.piece_id, body.blog_post_id, origin, body.attempt)
            .catch(e => console.error('[Factory] Convergence Brief QA step 3 failed:', e))
        );
        return new Response(JSON.stringify({ ok: true }));
      } else if (body.type === 'convergence_brief_seo') {
        ctx.waitUntil(
          generateConvergenceBrief_seo(env, body.piece_id)
            .catch(e => console.error('[Factory] Convergence Brief SEO step 4 failed:', e))
        );
        return new Response(JSON.stringify({ ok: true }));
      } else if (body.type === 'prediction_outcome') {
        const predId = body.prediction_id || body.predictionId;
        if (!predId) return new Response(JSON.stringify({ error: 'prediction_id required for prediction_outcome' }), { status: 400 });
        ctx.waitUntil(
          generatePredictionOutcomeBrief(env, predId, origin).catch(e => console.error('[Factory] Prediction Outcome Brief generation failed:', e))
        );
        return new Response(JSON.stringify({ ok: true, message: 'Prediction outcome brief generation started' }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://www.hiremax.site' },
        });
      } else if (body.type === 'prediction_outcome_generate') {
        const predId = body.prediction_id || body.predictionId;
        ctx.waitUntil(
          generatePredictionOutcomeBrief_generate(env, predId, origin, body.attempt, body.appendNotes, body.existingPieceId, body.existingBlogPostId)
            .catch(e => console.error('[Factory] Prediction Outcome Brief generation step 2 failed:', e))
        );
        return new Response(JSON.stringify({ ok: true }));
      } else if (body.type === 'prediction_outcome_qa') {
        const predId = body.prediction_id || body.predictionId;
        ctx.waitUntil(
          generatePredictionOutcomeBrief_qa(env, predId, body.piece_id, body.blog_post_id, origin, body.attempt)
            .catch(e => console.error('[Factory] Prediction Outcome Brief QA step 3 failed:', e))
        );
        return new Response(JSON.stringify({ ok: true }));
      } else {
        return new Response(JSON.stringify({ error: `Unknown type: ${body.type}` }), { status: 400 });
      }
    }

    if (!body.briefId) {
      return new Response(JSON.stringify({ error: 'briefId or type required' }), { status: 400 });
    }

    // Run generation in background using native ExecutionContext
    ctx.waitUntil(
      generateAllContent(env, body.briefId, origin).catch(e => console.error('[Factory] Generation failed:', e))
    );

    return new Response(JSON.stringify({ ok: true, briefId: body.briefId, message: 'Generation started' }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://www.hiremax.site',
      },
    });
  },
};
