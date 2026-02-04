
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function startExecutionRun(req: Request) {
  const supabase = createClient(
    process.env.SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  );

  try {
    const { user_id, resume_id, target_role } = await req.json();

    // 1. Quota & Plan Check
    const { data: profile } = await supabase.from('profiles').select('metadata, plan').eq('id', user_id).single();
    if (!profile) return new Response(JSON.stringify({ error: "Profile not found." }), { status: 404 });

    const sentToday = profile.metadata?.applications_sent_today ?? 0;
    const limit = profile.metadata?.daily_application_limit ?? 50;

    if (sentToday >= limit) {
      return new Response(JSON.stringify({ error: "Daily application limit reached." }), { status: 403 });
    }

    // 2. Initialize Run
    const { data: run, error: runError } = await supabase
      .from('execution_runs')
      .insert({ user_id, resume_id, target_role, status: 'running' })
      .select()
      .single();

    if (runError) throw runError;

    // 3. Initial Audit Log
    await supabase.from('execution_logs').insert({ 
      run_id: run.id, 
      message: `System Handshake: Initialized Application Run for ${target_role}.`, 
      level: 'info' 
    });

    return new Response(JSON.stringify(run), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
