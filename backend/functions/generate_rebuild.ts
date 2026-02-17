import { createClient } from 'npm:@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'npm:@google/generative-ai'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export async function generateRebuild(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { user_id, resume_id, targetRole, roleTrack, sourceText } = await req.json()

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      throw new Error('Missing GEMINI_API_KEY environment variable')
    }
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = `Architect a market-aligned resume for the "${roleTrack}" track.
    TARGET ROLE: ${targetRole}
    SOURCE CONTENT: ${sourceText}
    
    Return JSON in the exact following structure:
    {
      "newResume": {
        "contact": { "full_name": string, "email": string, "phone": string, "location": string, "links": string[] },
        "summary": string,
        "education": [{ "institution": string, "degree": string, "dates": string, "details": string }],
        "experience": [{ "title": string, "organization": string, "dates": string, "bullets": string[] }],
        "projects": [{ "name": string, "description": string, "impact": string }],
        "skills": { "languages": string[], "frameworks": string[], "tools": string[], "specializations": string[] },
        "leadership": [{ "role": string, "description": string }]
      }
    }`

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    })

    const responseText = result.response.text()
    const results = JSON.parse(responseText || '{}')

    // Ensure parent resume exists
    const { error: parentError } = await supabase
      .from('resumes')
      .upsert({
        id: resume_id,
        user_id,
        name: `Rebuild - ${targetRole}`,
        created_at: new Date().toISOString()
      }, { onConflict: 'id', ignoreDuplicates: true })

    if (parentError) throw parentError

    // Robust extraction: Handle various potential AI response structures
    const resumeData = results.newResume || results.resume || results;

    // Create a new version in the database
    const { data: version, error } = await supabase
      .from('resume_versions')
      .insert({
        resume_id,
        version_type: 'optimized',
        data: resumeData
      })
      .select()
      .single()

    if (error) throw error

    return new Response(JSON.stringify(version), {
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

Deno.serve(generateRebuild)
