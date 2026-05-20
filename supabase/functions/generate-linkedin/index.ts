import { createClient } from 'npm:@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'npm:@google/generative-ai'

import { checkPlanGate } from '../_shared/plan-gate.ts'

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
    const gateResult = await checkPlanGate(req, ['Career Elite', 'Automation'])
    if (gateResult instanceof Response) return gateResult
    const { user } = gateResult

    const body = await req.json()
    const { targetRole, yearsExperience, resumeText, currentHeadline, currentAbout, run_id } = body
    const safeRole = String(targetRole || '').slice(0, 80)
    const safeResume = String(resumeText || '').slice(0, 10000)
    const safeHeadline = String(currentHeadline || '').slice(0, 220)
    const safeAbout = String(currentAbout || '').slice(0, 2600)
    const years = Number(yearsExperience) || 5

    if (!safeRole) throw new Error('targetRole is required')

    if (run_id) {
      await supabase.from('execution_runs').update({ status: 'running' }).eq('id', run_id)
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) throw new Error('Missing GEMINI_API_KEY')

    const genAI = new GoogleGenerativeAI(apiKey, { apiVersion: 'v1beta' })
    const model = genAI.getGenerativeModel({
      model: 'gemini-flash-latest',
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
    })

    const prompt = `Optimize LinkedIn profile as JSON for target role "${safeRole}" (${years} years exp).
Current headline: ${safeHeadline}
Current about: ${safeAbout}
Resume: ${safeResume}

Return ONLY:
{
  "headline": {"text":"","keywords":[],"searchableKeywordCount":0},
  "about": {"hook":"","full":"","keywordCount":0},
  "experienceBullets": [{"role":"","company":"","original":"","optimized":"","keywordsAdded":[]}],
  "skills": [{"skill":"","searchVolume":"HIGH"|"MEDIUM"|"LOW","rank":1}],
  "discoverabilityScore": {"before":0,"after":0,"delta":0},
  "missingFromCurrentHeadline": []
}
Provide 50 ranked skills, 3+ experience bullet rewrites, realistic discoverability scores.`

    const result = await model.generateContent(prompt)
    const parsed = JSON.parse(result.response.text() || '{}')
    if (!parsed.headline?.text) throw new Error('Malformed LinkedIn optimization response')

    if (run_id) {
      await supabase.from('execution_runs').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      }).eq('id', run_id)
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: 'Error', message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
