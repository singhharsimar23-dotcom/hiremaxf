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
    const gateResult = await checkPlanGate(req, ['Career Pro', 'Career Elite', 'Automation'])
    if (gateResult instanceof Response) return gateResult
    const { user } = gateResult

    const body = await req.json()
    const { job_description, resume_text, company_stage, role_level, run_id } = body
    const safeJd = String(job_description || '').slice(0, 12000)
    const safeResume = String(resume_text || '').slice(0, 10000)
    const safeStage = String(company_stage || 'FAANG / Big Tech').slice(0, 80)
    const safeLevel = String(role_level || 'Senior (IC5)').slice(0, 40)

    if (!safeJd.trim()) throw new Error('job_description is required')

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

    const prompt = `Build an interview prep kit as strict JSON for:
Company stage: ${safeStage}
Role level: ${safeLevel}
Job description: ${safeJd}
Resume: ${safeResume}

Return ONLY JSON matching this schema:
{
  "recruiterScreen": [{"question":"","whyAsked":"","framework":[""],"avoid":[""]}],
  "salaryAnchor": {"range":"","script":"","response":"","reasoning":""},
  "hmScreen": [{"question":"","followUp":"","resumeAnchor":"","framework":[""]}],
  "technical": {
    "detectedType": "CODING"|"SYSTEM_DESIGN"|"TAKE_HOME"|"Leetcode"|"System Design"|"Take-home"|"Case Study",
    "questions": [{"question":"","likelihood":85,"hints":"","keyPoints":[""],"tradeoffs":[""]}]
  },
  "behavioral": [{"question":"","situation":"","task":"","preFilled":{"situation":"","task":""}}],
  "questionsToAsk": [{"question":"","category":"Role Clarity"|"Team Dynamics"|"Culture"|"Technical Direction"|"Growth","mustAsk":true,"whyItWorks":""}]
}
Include 5 recruiter questions, 6 HM questions, 4-6 technical questions, 12 behavioral with preFilled from resume, 10 questionsToAsk.`

    let kit: Record<string, unknown> | null = null
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await model.generateContent(prompt)
        kit = JSON.parse(result.response.text() || '{}')
        if (kit?.recruiterScreen || kit?.hmScreen) break
        throw new Error('Incomplete prep kit')
      } catch (e) {
        if (attempt >= 2) throw e
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
      }
    }

    if (run_id) {
      await supabase.from('execution_runs').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      }).eq('id', run_id)
    }

    return new Response(JSON.stringify(kit), {
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
