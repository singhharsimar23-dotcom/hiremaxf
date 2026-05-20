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

    const body = await req.json()
    const { question, transcript, resume_text } = body

    if (!question || !transcript) {
      throw new Error('Question and transcript are required fields.')
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) throw new Error('Missing GEMINI_API_KEY in server environment')

    const genAI = new GoogleGenerativeAI(apiKey, { apiVersion: 'v1beta' })
    const model = genAI.getGenerativeModel({
      model: 'gemini-flash-latest',
      generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
    })

    const prompt = `You are an elite silicon valley mock interview speech coach.
Evaluate this spoken answer to the following interview question.

Question: "${question}"
Spoken Answer (Transcribed): "${transcript}"
User's Resume context for anchoring: "${String(resume_text || '').slice(0, 1000)}"

Analyze the response against standard professional rubrics:
1. STAR Framework Check: Did they state the Situation, Task, Action, and Result?
2. Score: 40-100 based on structure, technical specificity, ownership verbs, and measurable impact.
3. Strength: What was the absolute best element of their answer?
4. Gap: What critical detail is missing?
5. Suggested Addition: A precise, high-impact sentence they could say to instantly improve their answer.
6. Delivery / Structure critique: Feedback on flow and depth.

You MUST respond with a strict, valid JSON matching this schema:
{
  "score": <number 40-100>,
  "strength": "<string>",
  "gap": "<string>",
  "suggestedAddition": "<string>",
  "starCheck": {
    "situation": <boolean>,
    "task": <boolean>,
    "action": <boolean>,
    "result": <boolean>
  },
  "deliveryCritique": "<string>"
}

Do not return any markdown wrappers, just the raw JSON.`

    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: 'Evaluation failed', message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
