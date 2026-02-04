
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function executeApplication(req: Request) {
  const supabase = createClient(
    process.env.SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  );

  try {
    const { target_id, run_id } = await req.json();

    const { data: target } = await supabase.from('execution_targets').select('*').eq('id', target_id).single();
    if (!target || target.status === 'submitted') {
      return new Response(JSON.stringify({ status: 'skipped' }), { status: 200 });
    }

    // Simulate ATS API Interaction
    // In production, this would be a fetch call to a 3rd party service
    const dispatchLatency = 2000;
    await new Promise(r => setTimeout(r, dispatchLatency));

    const { error } = await supabase
      .from('execution_targets')
      .update({ 
        status: 'submitted',
        metadata: { ...target.metadata, dispatch_timestamp: new Date().toISOString() }
      })
      .eq('id', target_id);

    if (error) throw error;

    await supabase.from('execution_logs').insert({ 
      run_id, 
      message: `Confirmed dispatch to ${target.company}. Registry updated.`, 
      level: 'success' 
    });

    return new Response(JSON.stringify({ status: 'success' }), { status: 200 });
  } catch (err: any) {
    await supabase.from('execution_targets').update({ status: 'failed' }).eq('id', req.json().then(j => j.target_id));
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
