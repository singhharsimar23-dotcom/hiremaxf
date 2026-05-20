import { createClient } from 'npm:@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'npm:@google/generative-ai'

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

    const { job_id } = await req.json()
    if (!job_id) throw new Error('job_id is required')

    const { data: pointer, error: ptrErr } = await supabase
      .from('job_pointers')
      .select('*')
      .eq('job_id', job_id)
      .maybeSingle()

    if (ptrErr) throw ptrErr
    if (!pointer) throw new Error('Job not found')

    let fullDescription = pointer.job_description || ''
    const verifiedUrl = pointer.source_url || pointer.verified_source_url || ''

    if (!fullDescription || fullDescription.length < 200) {
      const apiKey = Deno.env.get('GEMINI_API_KEY')
      if (apiKey) {
        const genAI = new GoogleGenerativeAI(apiKey, { apiVersion: 'v1beta' })
        const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' })
        const prompt = `Expand this job listing into a full description (plain text, 400-800 words):
Title: ${pointer.role || ''}
Company: ${pointer.company || ''}
Location: ${pointer.location || ''}
Snippet: ${pointer.job_description || 'N/A'}`
        const result = await model.generateContent(prompt)
        fullDescription = result.response.text() || fullDescription
      }
    }

    return new Response(JSON.stringify({
      success: true,
      full_description: fullDescription,
      verified_source_url: verifiedUrl,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ success: false, error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
