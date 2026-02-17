import { createClient } from 'npm:@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'npm:@google/generative-ai'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export async function generateDiagnostic(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { user_id, targetRole, roleTrack, resumeText } = await req.json()

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      throw new Error('Missing GEMINI_API_KEY environment variable')
    }
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

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

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    })

    const responseText = result.response.text()
    const results = JSON.parse(responseText || '{}')

    // Persist to DB
    const { data: analysis, error } = await supabase
      .from('analyses')
      .insert({
        user_id,
        target_role: targetRole,
        role_track: roleTrack,
        resume_text: resumeText,
        results_json: results
      })
      .select()
      .single()

    if (error) throw error

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
}

Deno.serve(generateDiagnostic)
