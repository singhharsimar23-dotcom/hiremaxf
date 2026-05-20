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
    const gateResult = await checkPlanGate(req, ['Starter', 'Market Verdict', 'Career Pro', 'Career Elite', 'Automation'])
    if (gateResult instanceof Response) return gateResult
    const { user } = gateResult

    const body = await req.json()
    const {
      job_description,
      company_name,
      job_title,
      resume_text,
      hiring_manager_name,
      tone,
      run_id,
    } = body

    const safeCompany = String(company_name || '').slice(0, 120)
    const safeTitle = String(job_title || '').slice(0, 120)
    const safeJd = String(job_description || '').slice(0, 12000)
    const safeResume = String(resume_text || '').slice(0, 10000)
    const safeTone = String(tone || 'Professional').slice(0, 40)

    if (!safeCompany || !safeJd) throw new Error('company_name and job_description are required')

    if (run_id) {
      await supabase.from('execution_runs').update({ status: 'running' }).eq('id', run_id)
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) throw new Error('Missing GEMINI_API_KEY')

    const genAI = new GoogleGenerativeAI(apiKey, { apiVersion: 'v1beta' })
    const model = genAI.getGenerativeModel({
      model: 'gemini-flash-latest',
      generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
    })

    const prompt = `Write a cover letter as JSON.
Company: ${safeCompany}
Role: ${safeTitle}
Hiring manager: ${hiring_manager_name || 'Hiring Manager'}
Tone: ${safeTone}
Job description: ${safeJd}
Resume: ${safeResume}

Return ONLY:
{
  "letterText": "full letter",
  "wordCount": number,
  "specificityScore": number 0-100,
  "paragraphs": {"hook":"","evidence":"","companySignal":"","close":""},
  "analysis": {"painPoint":"","matchingExperience":"","companySignalUsed":"","toneCalibration":""},
  "evidenceChain": [{"claim":"","resumeProof":""}]
}`

    const result = await model.generateContent(prompt)
    const parsed = JSON.parse(result.response.text() || '{}')
    if (!parsed.letterText) throw new Error('Malformed cover letter response')

    parsed.wordCount = parsed.wordCount || parsed.letterText.split(/\s+/).length
    parsed.specificityScore = parsed.specificityScore ?? 75

    if (user.id) {
      await supabase.from('cover_letters').insert({
        user_id: user.id,
        company_name: safeCompany,
        job_title: safeTitle,
        content_text: parsed.letterText,
        specificity_score: parsed.specificityScore,
      }).then(({ error }) => {
        if (error) console.warn('[cover_letters insert]', error.message)
      })
    }

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
