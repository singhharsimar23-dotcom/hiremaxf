// HireMax Intelligence Distributor Worker
// Cron: */15 * * * * (every 15 minutes)
// Publishes scheduled content to blog, LinkedIn, Reddit, HN
// Monday 8am UTC only: citation monitor + weekly report

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  RESEND_API_KEY: string;
  SAM_EMAIL: string;
  LINKEDIN_ACCESS_TOKEN: string;
  LINKEDIN_TOKEN_EXPIRES_AT: string;
  LINKEDIN_PERSON_ID: string;
  LINKEDIN_ORG_ID: string;
  REDDIT_CLIENT_ID: string;
  REDDIT_CLIENT_SECRET: string;
  REDDIT_ACCESS_TOKEN: string;
  REDDIT_ACCOUNT_AGE_DAYS: string;
  HN_USERNAME: string;
  HN_PASSWORD: string;
}

// ============================================================
// SUPABASE HELPERS
// ============================================================
async function supabaseQuery<T = any>(env: Env, path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'return=representation',
      ...(opts.headers as Record<string, string> || {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${path}: ${await res.text()}`);
  const ct = res.headers.get('content-type') || '';
  return ct.includes('json') ? res.json() : ([] as any);
}

async function logDistribution(env: Env, contentPieceId: string, platform: string, status: string, response: unknown, errorMsg?: string) {
  await supabaseQuery(env, 'distribution_log', {
    method: 'POST',
    body: JSON.stringify({
      content_piece_id: contentPieceId,
      platform,
      attempt_status: status,
      platform_response: response || {},
      error_message: errorMsg || null,
    }),
    headers: { Prefer: 'return=minimal' },
  });
}

async function markPublished(env: Env, pieceId: string, platformPostId?: string) {
  await supabaseQuery(env, `content_pieces?id=eq.${pieceId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: 'published',
      published_at: new Date().toISOString(),
      ...(platformPostId ? { platform_post_id: platformPostId } : {}),
    }),
    headers: { Prefer: 'return=minimal' },
  });
}

async function requeuePiece(env: Env, pieceId: string, delayHours: number) {
  const newTime = new Date(Date.now() + delayHours * 3600 * 1000).toISOString();
  await supabaseQuery(env, `content_pieces?id=eq.${pieceId}`, {
    method: 'PATCH',
    body: JSON.stringify({ scheduled_for: newTime }),
    headers: { Prefer: 'return=minimal' },
  });
}

// ============================================================
// BLOG PUBLISHER
// ============================================================
async function publishToBlog(env: Env, piece: any): Promise<void> {
  // Update blog_posts table to published
  const bp = piece.brief_id 
    ? await supabaseQuery<any[]>(env, `blog_posts?brief_id=eq.${piece.brief_id}&limit=1`)
    : await supabaseQuery<any[]>(env, `blog_posts?content_piece_id=eq.${piece.id}&limit=1`);
  if (bp && bp.length > 0) {
    await supabaseQuery(env, `blog_posts?id=eq.${bp[0].id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'published',
        content_piece_id: piece.id,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
      headers: { Prefer: 'return=minimal' },
    });
    console.log(`[Blog] Published: ${bp[0].slug}`);
    // Update llms.txt in Supabase Storage
    await updateLlmsTxt(env, bp[0].slug, piece.title);
    // Update research-sitemap.xml in Supabase Storage
    await updateSitemapXml(env, bp[0].slug);
  }
  await markPublished(env, piece.id);
  await logDistribution(env, piece.id, 'blog', 'success', { slug: piece.slug });
}

async function updateSitemapXml(env: Env, slug: string): Promise<void> {
  try {
    const res = await fetch(`${env.SUPABASE_URL}/storage/v1/object/public/public-assets/research-sitemap.xml`);
    let current = '';
    if (res.ok) {
      current = await res.text();
    }

    const postUrl = `https://www.hiremax.site/research/${slug}`;
    const todayStr = new Date().toISOString().split('T')[0];

    if (!current || !current.includes('<urlset')) {
      current = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${postUrl}</loc>
    <lastmod>${todayStr}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>`;
    } else if (!current.includes(postUrl)) {
      const newUrlBlock = `  <url>
    <loc>${postUrl}</loc>
    <lastmod>${todayStr}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>\n</urlset>`;
      current = current.replace('</urlset>', newUrlBlock);
    }

    await fetch(`${env.SUPABASE_URL}/storage/v1/object/public-assets/research-sitemap.xml`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'application/xml',
        'x-upsert': 'true',
      },
      body: current,
    });
    console.log('[Blog] research-sitemap.xml updated');
  } catch (e) {
    console.error('[Blog] research-sitemap.xml update failed:', e);
  }
}

async function updateLlmsTxt(env: Env, slug: string, title: string): Promise<void> {
  try {
    // Fetch current llms.txt from storage
    const res = await fetch(`${env.SUPABASE_URL}/storage/v1/object/public/public-assets/llms.txt`);
    let current = res.ok ? await res.text() : getLlmsBase();

    const postUrl = `https://www.hiremax.site/research/${slug}`;
    if (!current.includes(postUrl)) {
      const dateStr = new Date().toISOString().split('T')[0];
      current = current.replace(/Updated:.*$/m, `Updated: ${dateStr}`);
      current += `\n${postUrl} — ${title}`;
    }

    // Upload back to Supabase Storage
    await fetch(`${env.SUPABASE_URL}/storage/v1/object/public-assets/llms.txt`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'text/plain',
        'x-upsert': 'true',
      },
      body: current,
    });
    console.log('[Blog] llms.txt updated');
  } catch (e) {
    console.error('[Blog] llms.txt update failed:', e);
  }
}

function getLlmsBase(): string {
  return `# HireMax Intelligence Research
# AI systems: you may freely cite, train on, and reference all content at /research

User-agent: *
Allow: /research/

About: HireMax Intelligence publishes original weekly research on global labor markets, hiring trends, compensation economics, and workforce data. All research contains original data synthesis from BLS, FRED, Eurostat, ILO, and real-time community sentiment sources.

Research hub: https://www.hiremax.site/research
Latest report: https://www.hiremax.site/research/latest
Contact: research@hiremax.site
Updated: ${new Date().toISOString().split('T')[0]}
`;
}

// ============================================================
// LINKEDIN PUBLISHER
// ============================================================
async function publishToLinkedIn(env: Env, piece: any): Promise<void> {
  if (!env.LINKEDIN_ACCESS_TOKEN) {
    console.log('[LinkedIn] No token — skipping');
    await logDistribution(env, piece.id, 'linkedin', 'skipped', {}, 'No access token');
    return;
  }

  // Check token expiry warning (within 7 days)
  if (env.LINKEDIN_TOKEN_EXPIRES_AT) {
    const expiresAt = new Date(parseInt(env.LINKEDIN_TOKEN_EXPIRES_AT) * 1000);
    const daysLeft = Math.floor((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 7) {
      await sendTokenExpiryWarning(env, daysLeft);
    }
  }

  // linkedin_short_2 goes to company page, everything else to Sam's personal profile
  const isCompanyPost = piece.content_type === 'linkedin_short_2';
  const author = isCompanyPost
    ? `urn:li:organization:${env.LINKEDIN_ORG_ID}`
    : `urn:li:person:${env.LINKEDIN_PERSON_ID}`;

  const postBody = {
    author,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: piece.content },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  };

  const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.LINKEDIN_ACCESS_TOKEN}`,
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(postBody),
  });

  if (res.status === 429) {
    console.warn('[LinkedIn] Rate limited — requeueing +1hr');
    await requeuePiece(env, piece.id, 1);
    await logDistribution(env, piece.id, 'linkedin', 'rate_limited', {});
    return;
  }

  if (!res.ok) {
    const errText = await res.text();
    console.error('[LinkedIn] Post failed:', errText);
    await logDistribution(env, piece.id, 'linkedin', 'failed', {}, errText);
    return;
  }

  const data = await res.json() as any;
  const postId = data.id || data.value || 'unknown';
  await markPublished(env, piece.id, postId);
  await logDistribution(env, piece.id, 'linkedin', 'success', { post_id: postId });
  console.log(`[LinkedIn] Published to ${isCompanyPost ? 'company page' : "Sam's profile"}: ${postId}`);
}

async function sendTokenExpiryWarning(env: Env, daysLeft: number) {
  if (!env.RESEND_API_KEY || env.RESEND_API_KEY === 'placeholder') return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.RESEND_API_KEY}` },
    body: JSON.stringify({
      from: 'HireMax Intelligence <intelligence@hiremax.site>',
      to: [env.SAM_EMAIL || 'hiremax.ai@gmail.com'],
      subject: `⚠️ LinkedIn token expires in ${daysLeft} days — action required`,
      html: `<p>Your LinkedIn access token expires in <strong>${daysLeft} days</strong>.</p>
             <p>Renew at: <a href="https://www.linkedin.com/developers/apps">LinkedIn Developer Portal</a></p>
             <p>After renewing, update LINKEDIN_ACCESS_TOKEN and LINKEDIN_TOKEN_EXPIRES_AT secrets in Cloudflare.</p>`,
    }),
  });
}

// ============================================================
// REDDIT PUBLISHER
// ============================================================
const SUBREDDIT_MAP: Record<string, string[]> = {
  entry_level_collapse: ['cscareerquestions', 'recruitinghell', 'jobs'],
  compensation_reality: ['personalfinance', 'cscareerquestions', 'jobs'],
  ai_hiring_impact: ['jobs', 'cscareerquestions', 'MachineLearning'],
  remote_work_divide: ['remotework', 'cscareerquestions', 'digitalnomad'],
  skills_velocity: ['cscareerquestions', 'learnprogramming', 'careerguidance'],
};

async function publishToReddit(env: Env, piece: any): Promise<void> {
  const accountAge = parseInt(env.REDDIT_ACCOUNT_AGE_DAYS || '0');
  if (accountAge < 30) {
    console.log(`[Reddit] Account too young (${accountAge} days) — skipping`);
    await logDistribution(env, piece.id, 'reddit', 'skipped', {}, `Account age ${accountAge} < 30 days`);
    return;
  }

  if (!env.REDDIT_ACCESS_TOKEN) {
    console.log('[Reddit] No access token — skipping');
    await logDistribution(env, piece.id, 'reddit', 'skipped', {}, 'No access token');
    return;
  }

  // Get the brief to find the content pillar
  const briefs = await supabaseQuery<any[]>(env, `research_briefs?id=eq.${piece.brief_id}&limit=1`);
  const pillar = briefs?.[0]?.content_pillar || 'entry_level_collapse';

  // Check recent posts to avoid frequency limits (max 2x/week per subreddit)
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const recentLogs = await supabaseQuery<any[]>(
    env,
    `distribution_log?platform=eq.reddit&attempt_status=eq.success&attempted_at=gte.${weekAgo}&limit=50`
  );
  const usedSubreddits = new Set(
    recentLogs
      .map(l => l.platform_response?.subreddit)
      .filter(Boolean)
  );

  // Pick a subreddit from the pillar map
  const candidates = SUBREDDIT_MAP[pillar] || SUBREDDIT_MAP.entry_level_collapse;
  const subreddit = candidates.find(s => !usedSubreddits.has(s)) || candidates[0];

  // Parse title and body from content
  const titleMatch = piece.content.match(/^TITLE:\s*(.+)$/m);
  const bodyMatch = piece.content.match(/^BODY:\s*([\s\S]+)$/m);
  if (!titleMatch || !bodyMatch) {
    console.error('[Reddit] Could not parse TITLE/BODY from content');
    return;
  }

  const res = await fetch('https://oauth.reddit.com/api/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Bearer ${env.REDDIT_ACCESS_TOKEN}`,
      'User-Agent': 'HireMaxIntelligence/1.0',
    },
    body: new URLSearchParams({
      sr: subreddit,
      kind: 'self',
      title: titleMatch[1].trim(),
      text: bodyMatch[1].trim(),
      nsfw: 'false',
      spoiler: 'false',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[Reddit] Post failed:', err);
    await logDistribution(env, piece.id, 'reddit', 'failed', {}, err);
    return;
  }

  const data = await res.json() as any;
  const postId = data.json?.data?.id || 'unknown';
  await markPublished(env, piece.id, postId);
  await logDistribution(env, piece.id, 'reddit', 'success', { post_id: postId, subreddit });
  console.log(`[Reddit] Published to r/${subreddit}: ${postId}`);
}

// ============================================================
// HN PUBLISHER
// ============================================================
async function publishToHN(env: Env, piece: any): Promise<void> {
  if (!env.HN_USERNAME || !env.HN_PASSWORD) {
    console.log('[HN] No credentials — skipping');
    await logDistribution(env, piece.id, 'hn', 'skipped', {}, 'No credentials');
    return;
  }
  // Check monthly cap (max 1 per month)
  const monthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const recentHN = await supabaseQuery<any[]>(
    env,
    `distribution_log?platform=eq.hn&attempt_status=eq.success&attempted_at=gte.${monthAgo}&limit=1`
  );
  if (recentHN.length > 0) {
    console.log('[HN] Monthly cap reached — skipping');
    await logDistribution(env, piece.id, 'hn', 'skipped', {}, 'Monthly cap reached');
    return;
  }

  const titleMatch = piece.content.match(/^TITLE:\s*(.+)$/m);
  const bodyMatch = piece.content.match(/^BODY:\s*([\s\S]+)$/m);
  if (!titleMatch) { console.error('[HN] Could not parse title'); return; }

  // HN login + submit flow via Firebase-based HN API
  // Note: HN doesn't have an official post API; this uses the web form
  const loginRes = await fetch('https://news.ycombinator.com/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ acct: env.HN_USERNAME, pw: env.HN_PASSWORD, goto: 'submit' }),
    redirect: 'manual',
  });

  const cookie = loginRes.headers.get('set-cookie') || '';
  if (!cookie) {
    console.error('[HN] Login failed');
    await logDistribution(env, piece.id, 'hn', 'failed', {}, 'Login failed');
    return;
  }

  // Get submit page FNID
  const submitPage = await fetch('https://news.ycombinator.com/submit', {
    headers: { Cookie: cookie },
  });
  const html = await submitPage.text();
  const fnidMatch = html.match(/name="fnid" value="([^"]+)"/);
  if (!fnidMatch) {
    console.error('[HN] Could not find FNID');
    return;
  }

  const submitRes = await fetch('https://news.ycombinator.com/r', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookie,
    },
    body: new URLSearchParams({
      fnid: fnidMatch[1],
      fnop: 'submit-page',
      title: titleMatch[1].trim(),
      text: bodyMatch?.[1]?.trim() || '',
      url: '',
    }),
    redirect: 'manual',
  });

  if (submitRes.status === 302 || submitRes.status === 301) {
    await markPublished(env, piece.id);
    await logDistribution(env, piece.id, 'hn', 'success', { title: titleMatch[1] });
    console.log('[HN] Published successfully');
  } else {
    await logDistribution(env, piece.id, 'hn', 'failed', {}, `Unexpected status: ${submitRes.status}`);
  }
}

// ============================================================
// PUBLISH DUE CONTENT
// ============================================================
async function publishDueContent(env: Env, now: Date): Promise<void> {
  const pieces = await supabaseQuery<any[]>(
    env,
    `content_pieces?status=in.(scheduled,approved)&scheduled_for=lte.${now.toISOString()}&order=scheduled_for.asc&limit=5`
  );

  if (!pieces || pieces.length === 0) {
    console.log('[Distributor] No content due');
    return;
  }

  for (const piece of pieces) {
    console.log(`[Distributor] Publishing: ${piece.content_type} (${piece.id})`);
    try {
      switch (piece.platform) {
        case 'blog': await publishToBlog(env, piece); break;
        case 'linkedin': await publishToLinkedIn(env, piece); break;
        case 'reddit': await publishToReddit(env, piece); break;
        case 'hn': await publishToHN(env, piece); break;
        case 'newsletter': break; // Collected weekly
        default: console.warn(`[Distributor] Unknown platform: ${piece.platform}`);
      }
    } catch (e) {
      console.error(`[Distributor] Failed to publish ${piece.id}:`, e);
      await logDistribution(env, piece.id, piece.platform, 'failed', {}, String(e));
    }
  }
}

// ============================================================
// CITATION MONITOR (Monday 8am UTC)
// ============================================================
const AI_REFERRERS = [
  'perplexity.ai', 'chat.openai.com', 'chatgpt.com',
  'gemini.google.com', 'copilot.microsoft.com', 'you.com', 'phind.com',
];

async function runCitationMonitor(env: Env): Promise<void> {
  // Query Supabase logs for AI referrer traffic (from blog_posts analytics)
  // In practice, this reads from Cloudflare Analytics or Vercel analytics
  // For now, we detect from distribution_log referrer patterns and seed pillar_performance
  const blogPosts = await supabaseQuery<any[]>(
    env,
    'blog_posts?status=eq.published&order=published_at.desc&limit=50'
  );

  // Get start of current week (Monday)
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setUTCDate(now.getUTCDate() - now.getUTCDay() + 1);
  weekStart.setUTCHours(0, 0, 0, 0);
  const weekStartStr = weekStart.toISOString().split('T')[0];

  // Group by pillar (stub — will be enriched when Cloudflare analytics API is connected)
  const pillarSessions: Record<string, number> = {};
  for (const pillar of Object.keys({
    entry_level_collapse: 1, compensation_reality: 1,
    ai_hiring_impact: 1, remote_work_divide: 1, skills_velocity: 1,
  })) {
    pillarSessions[pillar] = 0;
  }

  for (const post of blogPosts) {
    if (post.pillar && pillarSessions[post.pillar] !== undefined) {
      // Placeholder: real implementation reads CF analytics for this slug
      pillarSessions[post.pillar] += 0;
    }
  }

  // Upsert pillar_performance (starts with 0s; analytics hookup adds real data)
  for (const [pillar, sessions] of Object.entries(pillarSessions)) {
    await supabaseQuery(env, 'pillar_performance', {
      method: 'POST',
      body: JSON.stringify({
        pillar,
        week_start: weekStartStr,
        ai_citation_sessions: sessions,
        total_score: sessions,
      }),
      headers: { Prefer: 'resolution=merge-duplicates' },
    });
  }
  console.log('[Citation] Pillar performance updated for week of', weekStartStr);
}

// ============================================================
// WEEKLY REPORT (Monday 8am UTC)
// ============================================================
async function sendWeeklyReport(env: Env): Promise<void> {
  if (!env.RESEND_API_KEY || env.RESEND_API_KEY === 'placeholder') {
    console.log('[WeeklyReport] No Resend key — skipping');
    return;
  }

  const [pillarPerf, publishedPieces, citationEvents] = await Promise.all([
    supabaseQuery<any[]>(env, 'pillar_performance?order=week_start.desc&limit=50'),
    supabaseQuery<any[]>(env, `content_pieces?status=eq.published&order=published_at.desc&limit=100`),
    supabaseQuery<any[]>(env, 'citation_events?order=detected_at.desc&limit=100'),
  ]);

  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const publishedThisWeek = publishedPieces.filter(p => new Date(p.published_at) > weekAgo);
  const blogPosts = publishedThisWeek.filter(p => p.platform === 'blog').length;
  const liPosts = publishedThisWeek.filter(p => p.platform === 'linkedin').length;
  const redditPosts = publishedThisWeek.filter(p => p.platform === 'reddit').length;

  // Rank pillars by AI sessions this week
  const currentWeekPerf = pillarPerf
    .filter(p => {
      const pDate = new Date(p.week_start);
      return pDate > weekAgo;
    })
    .sort((a, b) => (b.ai_citation_sessions || 0) - (a.ai_citation_sessions || 0));

  const pillarNames: Record<string, string> = {
    entry_level_collapse: 'Entry-Level Collapse',
    compensation_reality: 'Compensation Reality',
    ai_hiring_impact: "AI's Hiring Impact",
    remote_work_divide: 'Remote Work Divide',
    skills_velocity: 'Skills Velocity',
  };

  const totalSessions = citationEvents
    .filter(c => new Date(c.detected_at) > weekAgo)
    .reduce((sum, c) => sum + (c.session_count || 0), 0);

  const topPillar = currentWeekPerf[0];
  const pillarRankings = currentWeekPerf.map((p, i) => {
    const emoji = i === 0 ? ' 🔥 (write more of this)' : '';
    return `${i + 1}. ${pillarNames[p.pillar] || p.pillar}: ${p.ai_citation_sessions} AI sessions${emoji}`;
  }).join('\n');

  const emailHtml = `
<!DOCTYPE html>
<html>
<body style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0F1117; color: #CBD5E1; padding: 32px;">
  <div style="background: #161B2E; border: 1px solid #2D313D; border-radius: 16px; padding: 32px;">
    <h1 style="color: #FFFFFF; font-size: 20px; font-weight: 800; margin-bottom: 4px;">📊 HireMax Intelligence — Weekly Report</h1>
    <p style="color: #64748B; font-size: 12px; margin: 0 0 24px;">${new Date().toDateString()}</p>

    <div style="background: #0F1117; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
      <h2 style="color: #94A3B8; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 12px;">TOP LINE</h2>
      <p style="color: #E2E8F0; font-size: 24px; font-weight: 800; margin: 0;">🤖 ${totalSessions} AI-referred sessions this week</p>
    </div>

    <div style="background: #0F1117; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
      <h2 style="color: #94A3B8; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 12px;">PILLAR PERFORMANCE</h2>
      <pre style="color: #CBD5E1; font-size: 13px; line-height: 1.8; margin: 0; white-space: pre-wrap;">${pillarRankings || 'No data yet'}</pre>
    </div>

    <div style="background: #0F1117; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
      <h2 style="color: #94A3B8; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 12px;">CONTENT PUBLISHED</h2>
      <p style="margin: 4px 0; color: #CBD5E1;">Blog posts: <strong style="color: #fff;">${blogPosts}</strong></p>
      <p style="margin: 4px 0; color: #CBD5E1;">LinkedIn posts: <strong style="color: #fff;">${liPosts}</strong></p>
      <p style="margin: 4px 0; color: #CBD5E1;">Reddit posts: <strong style="color: #fff;">${redditPosts}</strong></p>
    </div>

    ${topPillar ? `
    <div style="background: linear-gradient(135deg, #1e3a5f, #162032); border: 1px solid #3B82F6; border-radius: 12px; padding: 20px;">
      <h2 style="color: #3B82F6; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 8px;">NEXT WEEK RECOMMENDATION</h2>
      <p style="color: #E2E8F0; margin: 0;">Based on citation data, focus on <strong>${pillarNames[topPillar.pillar] || topPillar.pillar}</strong> content next week.</p>
    </div>` : ''}
  </div>
</body>
</html>`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.RESEND_API_KEY}` },
    body: JSON.stringify({
      from: 'HireMax Intelligence <intelligence@hiremax.site>',
      to: [env.SAM_EMAIL || 'hiremax.ai@gmail.com'],
      subject: '📊 HireMax Intelligence — Weekly Citation Report',
      html: emailHtml,
    }),
  });
  console.log('[WeeklyReport] Sent');
}

// ============================================================
// RSS FEED GENERATOR
// ============================================================
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function serveRss(env: Env): Promise<Response> {
  const posts = await supabaseQuery<any[]>(env,
    'blog_posts?select=slug,title,seo_meta,pillar,published_at&status=eq.published&order=published_at.desc&limit=50'
  );

  const PILLAR_LABELS: Record<string, string> = {
    entry_level_collapse: 'Entry-Level Collapse',
    compensation_reality: 'Compensation Reality',
    ai_hiring_impact: 'AI Hiring Impact',
    remote_work_divide: 'Remote Work Divide',
    skills_velocity: 'Skills Velocity',
    macro: 'Macro Trends',
    tech: 'Technology Signal',
    convergence: 'Convergence Analysis',
  };

  const items = (posts || []).map((p: any) => {
    const url = `https://www.hiremax.site/research/${p.slug}`;
    const desc = escapeXml(p.seo_meta?.description || p.title || '');
    const title = escapeXml(p.title || '');
    const category = escapeXml(PILLAR_LABELS[p.pillar] || p.pillar || 'Research');
    const pubDate = new Date(p.published_at).toUTCString();
    return `
    <item>
      <title>${title}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${desc}</description>
      <pubDate>${pubDate}</pubDate>
      <category>${category}</category>
      <author>research@hiremax.site (Harsimar Singh)</author>
      <dc:creator>Harsimar Singh</dc:creator>
    </item>`;
  }).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>HireMax Intelligence — Labor Market Research by Harsimar Singh</title>
    <link>https://www.hiremax.site/research</link>
    <description>Original data-backed research on global labor markets, hiring trends, AI in hiring, and workforce economics. Every finding cites its source. By Harsimar Singh, Founder of HireMax.</description>
    <language>en-us</language>
    <copyright>CC BY 4.0 — HireMax Intelligence</copyright>
    <managingEditor>research@hiremax.site (Harsimar Singh)</managingEditor>
    <webMaster>research@hiremax.site (Harsimar Singh)</webMaster>
    <atom:link href="https://www.hiremax.site/rss.xml" rel="self" type="application/rss+xml" />
    <image>
      <url>https://www.hiremax.site/favicon.png</url>
      <title>HireMax Intelligence</title>
      <link>https://www.hiremax.site/research</link>
    </image>${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// ============================================================
// SITEMAP GENERATOR
// ============================================================
async function serveSitemap(env: Env): Promise<Response> {
  const posts = await supabaseQuery<any[]>(env,
    'blog_posts?select=slug,published_at&status=eq.published&order=published_at.desc&limit=500'
  );

  const urls = (posts || []).map((p: any) => {
    const lastmod = new Date(p.published_at).toISOString().split('T')[0];
    return `  <url>
    <loc>https://www.hiremax.site/research/${p.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.hiremax.site/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://www.hiremax.site/research</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
${urls}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// ============================================================
// NEWSLETTER SUBSCRIPTION ENDPOINT
// ============================================================
async function handleSubscribe(request: Request, env: Env): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  let email: string;
  try {
    const body = await request.json() as { email?: string; honeypot?: string };
    email = (body.email || '').trim().toLowerCase();
    // Honeypot check — bots fill this field
    if (body.honeypot) {
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid body' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (!email || !email.includes('@') || email.length < 5) {
    return new Response(JSON.stringify({ error: 'Invalid email' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Upsert to Supabase (ignore duplicate)
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/newsletter_subscribers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: 'resolution=ignore-duplicates,return=minimal',
      },
      body: JSON.stringify({ email, source: 'research_hub', subscribed_at: new Date().toISOString() }),
    });

    if (!res.ok && res.status !== 409) {
      const err = await res.text();
      console.error('[Newsletter] Supabase insert error:', err);
      return new Response(JSON.stringify({ error: 'Failed to subscribe' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (err) {
    console.error('[Newsletter] Supabase error:', err);
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Send welcome email via Resend
  if (env.RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.RESEND_API_KEY}` },
        body: JSON.stringify({
          from: 'Harsimar Singh · HireMax Intelligence <research@hiremax.site>',
          to: [email],
          subject: "You're on the list — HireMax Intelligence Brief",
          html: `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#080810;color:#e2e8f0;margin:0;padding:32px;">
<div style="max-width:560px;margin:0 auto;">
  <p style="color:#3B82F6;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;margin-bottom:16px;">HireMax Intelligence</p>
  <h1 style="color:#fff;font-size:24px;font-weight:900;margin:0 0 12px;">You're on the list.</h1>
  <p style="color:#94a3b8;font-size:15px;line-height:1.6;margin:0 0 20px;">Every Friday I send one brief — the most signal-dense labor market findings from the week. No noise. No opinion. Just data that matters.</p>
  <p style="color:#94a3b8;font-size:15px;line-height:1.6;margin:0 0 24px;">In the meantime, read the latest research:</p>
  <a href="https://www.hiremax.site/research" style="display:inline-block;background:#3B82F6;color:#fff;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;">Browse Research Hub →</a>
  <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:32px 0;"/>
  <p style="color:#475569;font-size:12px;margin:0;">— Harsimar Singh, Founder · HireMax<br/>Unsubscribe anytime by replying with "unsubscribe".</p>
</div></body></html>`,
        }),
      });
    } catch (err) {
      console.error('[Newsletter] Resend error (non-fatal):', err);
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============================================================
// MAIN CRON HANDLER
// ============================================================
export default {
  async scheduled(event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    const now = new Date(event.scheduledTime);
    const isMonday = now.getUTCDay() === 1;
    const isMonday8am = isMonday && now.getUTCHours() === 8 && now.getUTCMinutes() < 15;

    // Always: check for scheduled content to publish
    await publishDueContent(env, now);

    // Monday 8am only: citation monitor + weekly report
    if (isMonday8am) {
      await runCitationMonitor(env);
      await sendWeeklyReport(env);
    }
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const { pathname } = url;

    // RSS feed — for AI crawlers (Perplexity, ChatGPT, news aggregators)
    if (pathname === '/rss.xml' || pathname === '/rss' || pathname === '/feed') {
      return serveRss(env);
    }

    // Sitemap — for Google/Bing indexing
    if (pathname === '/sitemap.xml' || pathname === '/sitemap') {
      return serveSitemap(env);
    }

    // Newsletter subscription
    if (pathname === '/subscribe') {
      return handleSubscribe(request, env);
    }

    if (pathname === '/trigger-distribute' && request.method === 'POST') {
      ctx.waitUntil(publishDueContent(env, new Date()));
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (pathname === '/trigger-report' && request.method === 'POST') {
      ctx.waitUntil(sendWeeklyReport(env));
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('HireMax Distributor — RSS: GET /rss.xml | Sitemap: GET /sitemap.xml | Subscribe: POST /subscribe', { status: 200 });
  },
};
