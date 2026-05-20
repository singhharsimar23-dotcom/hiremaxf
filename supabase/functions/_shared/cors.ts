export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

export async function requireUser(req: Request, supabase: ReturnType<typeof import('npm:@supabase/supabase-js@2').createClient>) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('Missing Authorization header');
  const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (error || !user) throw new Error('Invalid or expired session');
  return user;
}

export function sanitize(text: string, max: number) {
  return text.replace(/[^\w\s\-,.]/gi, '').slice(0, max).trim();
}
