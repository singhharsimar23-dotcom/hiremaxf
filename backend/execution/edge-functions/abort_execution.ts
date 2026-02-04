

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * abort_execution
 * Safety mechanism to halt an active run.
 */
export async function abortExecution(req: Request) {
  const supabase = createClient(
    // Fixed: Use process.env instead of Deno.env to resolve "Cannot find name 'Deno'"
    process.env.SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  );

  const { run_id, reason } = await req.json();

  const { error } = await supabase
    .from('execution_runs')
    .update({ status: 'aborted', error_reason: reason })
    .eq('id', run_id);

  await supabase.from('execution_logs').insert({ 
    run_id, 
    message: `Execution aborted: ${reason}`, 
    level: 'error' 
  });

  return new Response(JSON.stringify({ status: 'aborted' }), { status: 200 });
}
