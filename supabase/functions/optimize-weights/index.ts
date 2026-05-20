import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header')
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) throw new Error('Invalid or expired session')

    const { data: profile } = await supabase
      .from('profiles')
      .select('plan, email')
      .eq('id', user.id)
      .maybeSingle()

    const isAdmin = profile?.plan === 'Automation' || profile?.email?.endsWith('@hiremax.site')
    if (!isAdmin) throw new Error('Admin access required')

    const { data: current } = await supabase
      .from('scoring_weight_sets')
      .select('*')
      .eq('status', 'ACTIVE')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()

    const baseWeights = (current?.weights as Record<string, number>) || {
      skill_match: 0.35,
      experience_fit: 0.25,
      market_timing: 0.15,
      callback_probability: 0.25,
    }

    const nudged: Record<string, number> = {}
    for (const [k, v] of Object.entries(baseWeights)) {
      nudged[k] = Math.min(1, Math.max(0, Number(v) + (Math.random() - 0.5) * 0.04))
    }
    const sum = Object.values(nudged).reduce((a, b) => a + b, 0) || 1
    for (const k of Object.keys(nudged)) nudged[k] = nudged[k] / sum

    const nextVersion = (current?.version || 0) + 1
    const { data: candidate, error: insErr } = await supabase
      .from('scoring_weight_sets')
      .insert({
        version: nextVersion,
        weights: nudged,
        status: 'CANDIDATE',
        parent_weight_set_id: current?.id ?? null,
      })
      .select()
      .single()

    if (insErr) throw insErr

    return new Response(JSON.stringify({
      ok: true,
      candidate_version: candidate,
      message: `Candidate weight set v${nextVersion} created`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
