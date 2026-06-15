// HireMax SEO-AEO Injector Module
interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  GEMINI_API_KEY: string;
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
            generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
          }),
        }
      );
      if (res.status === 429) {
        console.warn(`[SEO-AEO Gemini] 429 rate limit (attempt ${attempt}). Waiting 5s...`);
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
  throw new Error('Gemini failed in SEO-AEO Injector');
}

export async function injectSEOAEO(env: Env, contentPieceId: string): Promise<void> {
  console.log(`[SEO-AEO] Injecting metadata and structured schema for Content Piece ${contentPieceId}...`);

  // 1. Fetch content piece and its corresponding brief (if any)
  const pieces = await supabaseQuery(env, `content_pieces?id=eq.${contentPieceId}&limit=1`) as any[];
  if (!pieces || pieces.length === 0) {
    throw new Error(`Content piece ${contentPieceId} not found`);
  }
  const piece = pieces[0];
  let content = piece.content || '';
  const title = piece.title || '';
  const initialSlug = piece.slug || 'slug-' + Date.now().toString(36);

  // Default vertical if not in brief
  let vertical = 'macro';
  let primaryKeyword = title;
  let secondaryKeywords = ['labor market', 'hiring data', 'employment trends'];

  if (piece.brief_id) {
    try {
      const briefs = await supabaseQuery(env, `research_briefs?id=eq.${piece.brief_id}&limit=1`) as any[];
      if (briefs && briefs.length > 0) {
        vertical = briefs[0].content_pillar || 'macro';
        const keywords = briefs[0].target_keywords || [];
        if (keywords.length > 0) {
          primaryKeyword = keywords[0];
          secondaryKeywords = keywords.slice(1);
        }
      }
    } catch (err) {
      console.error('[SEO-AEO] Failed to fetch brief details for piece:', err);
    }
  }

  const nowStr = new Date().toISOString();

  // 2. Call Gemini for JSON-LD schemas
  const promptJsonLd = `You are a structured data expert. Generate a single JSON object containing standard schema.org JSON-LD scripts for this research post.
  Do not include markdown code block wrappers (like \`\`\`json). Output only valid JSON.
  
  Title: "${title}"
  Content Snippet: "${content.slice(0, 1000)}"
  Vertical: "${vertical}"
  Slug: "${initialSlug}"
  Published Date: "${nowStr}"
  
  Include these schemas in the returned JSON object:
  - "article": Article schema (author: Person "Harsimar 'sam' Singh", publisher: Org "HireMax Intelligence", headline: title, datePublished, dateModified).
  - "dataset": Dataset schema (temporalCoverage: past 90 days, spatialCoverage: US/Global, variableMeasured: ["${vertical}"], license: "https://creativecommons.org/licenses/by/4.0/", creator: "HireMax Intelligence").
  - "faq": FAQPage schema from the FAQ questions in the post.
  - "speakable": Speakable schema pointing to the bolded answer capsule.
  - "breadcrumbs": BreadcrumbList schema (Home -> Research -> ${vertical} -> ${initialSlug}).
  
  Return exactly this JSON:
  {
    "article": {},
    "dataset": {},
    "faq": {},
    "speakable": {},
    "breadcrumbs": {}
  }`;

  let schemaMarkup = {};
  try {
    const jsonLdRes = await callGemini(env, promptJsonLd);
    const jsonMatch = jsonLdRes.match(/\{[\s\S]*\}/);
    schemaMarkup = JSON.parse(jsonMatch ? jsonMatch[0] : jsonLdRes);
  } catch (err) {
    console.error('[SEO-AEO] JSON-LD generation failed:', err);
  }

  // 3. Call Gemini for Meta Tags
  const promptMeta = `Generate Meta tags for this research post as JSON only. Do not include markdown code blocks.
  Title: "${title}"
  Content Snippet: "${content.slice(0, 1000)}"
  Primary Keyword: "${primaryKeyword}"
  Secondary Keywords: ${JSON.stringify(secondaryKeywords)}
  
  Return exactly this JSON structure:
  {
    "meta_title": "50-60 characters, must include primary keyword, format: '[Finding] — [Vertical] | HireMax Intelligence'",
    "meta_description": "140-155 characters, incorporating the bolded answer capsule and secondary_keywords[0]",
    "og_title": "Open Graph Title",
    "og_description": "Open Graph Description",
    "twitter_card": "summary_large_image"
  }`;

  let seoMeta = {};
  try {
    const metaRes = await callGemini(env, promptMeta);
    const jsonMatch = metaRes.match(/\{[\s\S]*\}/);
    seoMeta = JSON.parse(jsonMatch ? jsonMatch[0] : metaRes);
  } catch (err) {
    console.error('[SEO-AEO] Meta tags generation failed:', err);
  }

  // 4. Internal Link Insertion
  let internalLinksText = '';
  try {
    // Query last 30 published blog posts
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const posts = await supabaseQuery(
      env,
      `blog_posts?select=slug,title&status=eq.published&published_at=gt.${sixMonthsAgo.toISOString()}&limit=30`
    ) as any[];

    if (posts && posts.length > 0) {
      const existingPostsList = posts.map(p => ({ title: p.title, slug: p.slug }));
      const promptInternalLinks = `Identify up to 3 highly relevant internal posts from the list to link to from our current post.
      Return exactly a JSON array of objects (max 3, only relevance_score >= 7):
      [
        {
          "anchor_text": "Anchor text describing the link topic",
          "target_slug": "target-post-slug",
          "relevance_score": 1-10
        }
      ]
      
      Current Post Title: "${title}"
      Existing Posts List:
      ${JSON.stringify(existingPostsList)}`;

      const linksRes = await callGemini(env, promptInternalLinks);
      const jsonMatch = linksRes.match(/\[[\s\S]*\]/);
      const internalLinks = JSON.parse(jsonMatch ? jsonMatch[0] : linksRes) as Array<{ anchor_text: string; target_slug: string; relevance_score: number }>;

      if (internalLinks && internalLinks.length > 0) {
        internalLinksText = '\n\n### Related Research\n';
        for (const link of internalLinks) {
          if (link.relevance_score >= 7) {
            internalLinksText += `- Learn more about [${link.anchor_text}](https://hiremax.site/research/${link.target_slug})\n`;
          }
        }
        content += internalLinksText;
      }
    }
  } catch (err) {
    console.error('[SEO-AEO] Internal links query or generation failed:', err);
  }

  // 5. Canonical URL & Slug deduplication
  let finalSlug = initialSlug;
  let collision = true;
  let counter = 1;
  try {
    while (collision) {
      // Check blog_posts for slug collision (excluding ourselves if we have a blog post)
      const existing = await supabaseQuery(env, `blog_posts?slug=eq.${finalSlug}`) as any[];
      if (existing && existing.length > 0 && existing[0].content_piece_id !== contentPieceId) {
        counter++;
        finalSlug = `${initialSlug}-${counter}`;
      } else {
        collision = false;
      }
    }
  } catch (err) {
    console.error('[SEO-AEO] Slug deduplication failed:', err);
  }

  const canonicalUrl = `https://hiremax.site/research/${vertical}/${finalSlug}`;
  // Merge canonical into seoMeta
  seoMeta = {
    ...seoMeta,
    canonical_url: canonicalUrl,
  };

  // 6. Update content_pieces in Supabase
  console.log(`[SEO-AEO] Updating content piece ${contentPieceId} with generated SEO metadata...`);
  await supabaseQuery(env, `content_pieces?id=eq.${contentPieceId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      slug: finalSlug,
      content,
      schema_markup: schemaMarkup,
      seo_meta: seoMeta,
    }),
    headers: { Prefer: 'return=minimal' },
  });

  console.log(`[SEO-AEO] Success. Slug: ${finalSlug}`);
}
