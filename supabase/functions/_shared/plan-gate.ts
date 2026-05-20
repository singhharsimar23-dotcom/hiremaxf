import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from './cors.ts'

export async function checkPlanGate(
  req: Request,
  allowedPlans: string[]
): Promise<{ user: any; profile: any } | Response> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Missing Authorization header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: 'System Configuration Error: Missing Supabase environment variables' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: 'Invalid or expired session' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Retrieve user plan from profiles table
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, plan, credits')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return new Response(
      JSON.stringify({ error: 'User profile not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const currentPlan = profile.plan || 'Starter'
  if (!allowedPlans.includes(currentPlan)) {
    return new Response(
      JSON.stringify({
        error: 'UNAUTHORIZED_ACCESS',
        code: 'PLAN_GATE',
        message: `This feature is restricted to ${allowedPlans.join(' or ')} users. Your plan: ${currentPlan}.`
      }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return { user, profile }
}
