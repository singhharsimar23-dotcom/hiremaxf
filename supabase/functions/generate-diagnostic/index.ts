import { createClient } from 'npm:@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'npm:@google/generative-ai'

import { checkPlanGate } from '../_shared/plan-gate.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export async function generateDiagnostic(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const gateResult = await checkPlanGate(req, ['Starter', 'Market Verdict', 'Career Pro', 'Career Elite', 'Automation'])
    if (gateResult instanceof Response) return gateResult
    const { user } = gateResult

    const { targetRole, roleTrack, resumeText, run_id } = await req.json()
    const user_id = user.id

    // 1. Initialize Execution State
    if (run_id) {
      await supabase.from('execution_runs').update({ status: 'running' }).eq('id', run_id)
      await supabase.from('execution_logs').insert({
        run_id,
        message: `Initializing diagnostic analysis for ${targetRole}`,
        level: 'info'
      })
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) throw new Error('Missing GEMINI_API_KEY')

    const genAI = new GoogleGenerativeAI(apiKey, { apiVersion: 'v1beta' })
    const model = genAI.getGenerativeModel({
      model: 'gemini-flash-latest',
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1 // Lower temperature for more deterministic/stable structured output
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
      ]
    })

    const prompt = `Analyze this resume for the role of "${targetRole}" within the "${roleTrack}" market track.
    Return a JSON object in this exact structure:
    {
      "overallScore": number,
      "marketReadinessLabel": "Low" | "Medium" | "High",
      "eightPoints": [
        { "id": string, "name": string, "score": number, "explanation": string, "riskHint": string }
      ]
    }
    RESUME TEXT: ${resumeText}`

    // 2. Execute with Retry Logic (Senior Pattern)
    let results: any = null
    let attempts = 0
    const maxAttempts = 3

    while (attempts < maxAttempts) {
      try {
        if (run_id) {
          await supabase.from('execution_logs').insert({
            run_id,
            message: `Gemini Dispatch: Attempt ${attempts + 1}/${maxAttempts}`,
            level: 'info'
          })
        }

        const result = await model.generateContent(prompt)
        const responseText = result.response.text()
        console.log("[GEMINI RESPONSE]:", responseText)
        results = JSON.parse(responseText || '{}')
        break // Success!
      } catch (err: any) {
        attempts++
        console.warn(`Attempt ${attempts} failed:`, err.message)
        if (attempts >= maxAttempts) throw err
        await new Promise(r => setTimeout(r, 1000 * attempts)) // Linear backoff
      }
    }

    // 3. Finalize and Persist
    const { data: analysis, error } = await supabase
      .from('analyses')
      .insert({
        user_id,
        role: targetRole,
        score: Math.round(results.overallScore || 0),
        results_json: results
      })
      .select()
      .single()

    if (error) throw error

    if (run_id) {
      await supabase.from('execution_runs').update({
        status: 'completed',
        completed_at: new Date().toISOString()
      }).eq('id', run_id)

      await supabase.from('execution_logs').insert({
        run_id,
        message: `Success: Analysis ${analysis.id} generated and persisted.`,
        level: 'success'
      })
    }

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err: any) {
    console.error(`[DIAGNOSTIC ERROR]:`, err)

    // Attempt to log failure to DB if run_id exists
    try {
      const { run_id } = await req.clone().json()
      if (run_id) {
        await supabase.from('execution_runs').update({
          status: 'failed',
          error_reason: err.message
        }).eq('id', run_id)

        await supabase.from('execution_logs').insert({
          run_id,
          message: `CRITICAL FAILURE: ${err.message}`,
          level: 'error'
        })
      }
    } catch { /* Ignore clone failures */ }

    const errorBody = {
      error: err.name || 'Error',
      message: err.message || 'Internal logic failure',
      stack: err.stack,
      details: err.response?.statusText || 'No extra details'
    }

    return new Response(JSON.stringify(errorBody), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
}

Deno.serve(generateDiagnostic)
