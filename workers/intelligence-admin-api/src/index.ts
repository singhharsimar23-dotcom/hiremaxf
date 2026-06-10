// HireMax Intelligence Admin API Worker
// HTTP-only worker: CRUD for research briefs, content calendar, performance metrics

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ADMIN_PASSWORD: string;
  CONTENT_FACTORY_URL: string;
  RESEND_API_KEY: string;
  SAM_EMAIL: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://www.hiremax.site',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function error(msg: string, status = 400) {
  return json({ error: msg }, status);
}

async function supabaseQuery(env: Env, path: string, options: RequestInit = {}) {
  const url = `${env.SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'return=representation',
      ...(options.headers as Record<string, string> || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase error ${res.status}: ${text}`);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return null;
}

function verifyPassword(req: Request, env: Env): boolean {
  const auth = req.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '');
  return token === env.ADMIN_PASSWORD;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Public: newsletter subscribe
    if (request.method === 'POST' && path === '/subscribe') {
      return handleSubscribe(request, env);
    }

    // All other routes require admin password
    if (!verifyPassword(request, env)) {
      return error('Unauthorized', 401);
    }

    // GET /briefs — list all briefs (with optional status filter)
    if (request.method === 'GET' && path === '/briefs') {
      const status = url.searchParams.get('status');
      const queryPath = status
        ? `research_briefs?status=eq.${status}&order=generated_at.desc&limit=50`
        : `research_briefs?order=generated_at.desc&limit=50`;
      const data = await supabaseQuery(env, queryPath);
      return json(data);
    }

    // GET /briefs/:id — single brief
    if (request.method === 'GET' && path.startsWith('/briefs/')) {
      const id = path.split('/')[2];
      const data = await supabaseQuery(env, `research_briefs?id=eq.${id}&limit=1`);
      return json(Array.isArray(data) ? data[0] : data);
    }

    // PATCH /briefs/:id/angle — Sam adds his angle + approve
    if (request.method === 'PATCH' && path.match(/^\/briefs\/[^/]+\/angle$/)) {
      const id = path.split('/')[2];
      const body = await request.json() as { sams_angle: string };
      if (!body.sams_angle || body.sams_angle.trim().length < 5) {
        return error('Angle must be at least 5 characters');
      }
      await supabaseQuery(env, `research_briefs?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          sams_angle: body.sams_angle.trim(),
          sams_angle_added_at: new Date().toISOString(),
          status: 'approved',
          reviewed_at: new Date().toISOString(),
        }),
      });
      // Fire content factory webhook
      try {
        await fetch(`${env.CONTENT_FACTORY_URL}/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.ADMIN_PASSWORD}` },
          body: JSON.stringify({ briefId: id }),
        });
      } catch (e) {
        console.error('Content factory webhook failed:', e);
      }
      return json({ ok: true, status: 'approved', contentGenerating: true });
    }

    // PATCH /briefs/:id/approve — approve without angle
    if (request.method === 'PATCH' && path.match(/^\/briefs\/[^/]+\/approve$/)) {
      const id = path.split('/')[2];
      await supabaseQuery(env, `research_briefs?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'approved', reviewed_at: new Date().toISOString() }),
      });
      try {
        await fetch(`${env.CONTENT_FACTORY_URL}/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.ADMIN_PASSWORD}` },
          body: JSON.stringify({ briefId: id }),
        });
      } catch (e) {
        console.error('Content factory webhook failed:', e);
      }
      return json({ ok: true, status: 'approved', contentGenerating: true });
    }

    // PATCH /briefs/:id/reject
    if (request.method === 'PATCH' && path.match(/^\/briefs\/[^/]+\/reject$/)) {
      const id = path.split('/')[2];
      await supabaseQuery(env, `research_briefs?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'rejected', reviewed_at: new Date().toISOString() }),
      });
      return json({ ok: true, status: 'rejected' });
    }

    // GET /content — list content_pieces with schedule (next 7 days)
    if (request.method === 'GET' && path === '/content') {
      const status = url.searchParams.get('status') || 'scheduled';
      const data = await supabaseQuery(
        env,
        `content_pieces?status=eq.${status}&order=scheduled_for.asc&limit=100`
      );
      return json(data);
    }

    // GET /content/all — all pieces
    if (request.method === 'GET' && path === '/content/all') {
      const data = await supabaseQuery(
        env,
        `content_pieces?order=created_at.desc&limit=100`
      );
      return json(data);
    }

    // PATCH /content/:id/reschedule
    if (request.method === 'PATCH' && path.match(/^\/content\/[^/]+\/reschedule$/)) {
      const id = path.split('/')[2];
      const body = await request.json() as { scheduled_for: string };
      await supabaseQuery(env, `content_pieces?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ scheduled_for: body.scheduled_for }),
      });
      return json({ ok: true });
    }

    // GET /performance — pillar performance data (last 8 weeks)
    if (request.method === 'GET' && path === '/performance') {
      const eightWeeksAgo = new Date();
      eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
      const data = await supabaseQuery(
        env,
        `pillar_performance?week_start=gte.${eightWeeksAgo.toISOString().split('T')[0]}&order=week_start.desc&limit=100`
      );
      return json(data);
    }

    // GET /stats — summary stats for dashboard cards
    if (request.method === 'GET' && path === '/stats') {
      const [briefs, pieces, citations] = await Promise.all([
        supabaseQuery(env, 'research_briefs?select=status&order=generated_at.desc&limit=30'),
        supabaseQuery(env, 'content_pieces?select=status,platform,published_at&order=published_at.desc&limit=100'),
        supabaseQuery(env, 'citation_events?select=citation_source,session_count,detected_at&order=detected_at.desc&limit=200'),
      ]);

      const pendingBriefs = (briefs as any[]).filter(b => b.status === 'awaiting_angle' || b.status === 'pending').length;
      const publishedThisWeek = (() => {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return (pieces as any[]).filter(p => p.status === 'published' && new Date(p.published_at) > weekAgo).length;
      })();
      const aiSessions = (citations as any[]).reduce((sum: number, c: any) => sum + (c.session_count || 0), 0);

      return json({ pendingBriefs, publishedThisWeek, aiSessions });
    }

    return error('Not found', 404);
  },
};

async function handleSubscribe(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as { email: string };
  if (!body.email || !body.email.includes('@')) {
    return error('Valid email required');
  }
  await supabaseQuery(env, 'newsletter_subscribers', {
    method: 'POST',
    body: JSON.stringify({ email: body.email.toLowerCase().trim() }),
    headers: { Prefer: 'on-conflict=ignore' },
  });
  return json({ ok: true, message: 'Subscribed!' });
}
