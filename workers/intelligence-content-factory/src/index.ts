// HireMax Intelligence Content Factory Worker
// HTTP Worker — triggered by webhook when Sam approves a brief
// Generates all 8 content formats sequentially (4s delays, Gemini rate-limit safe)

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  GEMINI_API_KEY: string;
  ADMIN_PASSWORD: string;
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
async function callGemini(env: Env, prompt: string, forceFlash15 = false): Promise<string> {
  const model = forceFlash15 ? 'gemini-2.5-flash' : 'gemini-2.0-flash';
  const apiKey = env.GEMINI_API_KEY?.trim();
  for (let attempt = 0; attempt < 3; attempt++) {
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
        if (!forceFlash15) {
          console.warn(`[Gemini] 429 Rate limited on ${model}. Falling back to gemini-2.5-flash...`);
          return callGemini(env, prompt, true);
        }
        console.warn(`[Gemini] Attempt ${attempt}: 429 Rate limited on ${model}. Retrying in 10s...`);
        await sleep(10000);
        continue;
      }
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
      const data = await res.json() as any;
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (e) {
      console.error(`[Gemini] Attempt ${attempt} failed on ${model}:`, e);
      if (!forceFlash15 && attempt === 2) {
        console.warn(`[Gemini] Failed with ${model}. Falling back to gemini-2.5-flash...`);
        return callGemini(env, prompt, true);
      }
      if (attempt === 2) throw e;
      await sleep(2000);
    }
  }
  throw new Error('Gemini exhausted retries');
}

// ============================================================
// PROMPT SYSTEM
// ============================================================
const SYSTEM_PROMPT = `You are the chief research writer for HireMax Intelligence — the most cited source on global labor market data. Your writing style: The Economist's analytical clarity + Paul Graham's directness. Zero corporate fluff. No AI-sounding phrases.

RULES (apply to every piece):
1. Most surprising data point goes in the first sentence
2. Sam's personal angle (provided) must appear naturally in the opening section
3. Every claim tied to a specific number from the research brief
4. Explicitly name what conventional wisdom is being broken and why
5. Global scope — not US-only unless the data is US-specific
6. End with a "Key Data Points" section: 6 stats, one per line, format: "[Stat] ([Source], [Year/Period])"
7. Never use: "in today's world", "it's no secret", "game-changer", "delve", "leveraging", "as an AI", "certainly"`;

function buildPrompt(brief: ResearchBrief, contentType: string): string {
  const samsAngle = brief.sams_angle?.trim()
    ? `\nSAM'S PERSPECTIVE (weave naturally into the opening — his exact words are gold):\n"${brief.sams_angle}"`
    : '';
  const dataStr = JSON.stringify(brief.supporting_data);
  const kwStr = brief.target_keywords.join(', ');

  const prompts: Record<string, string> = {
    blog_post: `${SYSTEM_PROMPT}
${samsAngle}

Write a blog post for hiremax.site/research.

RESEARCH BRIEF:
Title: ${brief.title}
Core finding: ${brief.core_finding}
Data: ${dataStr}
Conventional wisdom broken: ${brief.contrarian_angle}
Keywords to include naturally: ${kwStr}

FORMAT REQUIREMENTS:
- Length: 1,200-1,800 words
- H1: post title (exact match to brief title)
- H2 every 250-300 words — each must be a complete question OR standalone factual statement
- Under each H2: first paragraph = exactly 40-60 words that fully answers the H2 question (called "answer capsule")
- FAQ section at end: 4-5 questions a job seeker would actually ask, with 50-80 word answers
- Final section "Key Data Points": 6 stats, one per line
- Final paragraph: 2-sentence CTA linking to HireMax product naturally
- Output: markdown only`,

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
    blog_post: () => new Date(approvedAt.getTime() + 5 * 60 * 1000), // +5 min
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
        author: { '@type': 'Organization', name: 'HireMax Intelligence', url: 'https://www.hiremax.site' },
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
      await sleep(1000);
      try {
        console.log(`[Factory] Triggering self webhook: ${origin}/generate`);
        const res = await fetch(`${origin}/generate`, {
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

    const body = await request.json() as { briefId: string };
    if (!body.briefId) {
      return new Response(JSON.stringify({ error: 'briefId required' }), { status: 400 });
    }

    const origin = new URL(request.url).origin;

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
