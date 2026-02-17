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

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    // 1. IDENTITY ANCHORING (SEC-010)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error("Missing Authorization header")

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) throw new Error("Invalid or expired session")

    const body = await req.json()
    const { resume_id, targetRole, roleTrack, sourceText, run_id, version_id } = body
    const user_id = user.id // SECURE: Anchored to JWT

    // 2. STATE ANCHORING: PROCESSING
    if (version_id) {
      await supabase
        .from('resume_versions')
        .update({ status: 'PROCESSING' })
        .eq('id', version_id)
    }

    // 2. INPUT SANITIZATION (SEC-011)
    const sanitize = (text: string, max: number) => {
      return text
        .replace(/[^\w\s\-,.]/gi, '') // Whitelist alphanumeric and common punctuation
        .slice(0, max)
        .trim()
    }

    const safeRole = sanitize(targetRole || '', 80)
    const safeTrack = sanitize(roleTrack || 'BIG_TECH', 40)
    const safeSource = (sourceText || '').slice(0, 10000) // Character limit for content

    if (!resume_id) throw new Error("Missing resume_id for rebuild context")

    // 3. OWNERSHIP VERIFICATION (SEC-010)
    if (resume_id !== 'NEW') {
      const { data: existing, error: checkError } = await supabase
        .from('resumes')
        .select('user_id')
        .eq('id', resume_id)
        .single()

      if (checkError && checkError.code !== 'PGRST116') throw checkError // PGRST116 is 'not found'
      if (existing && existing.user_id !== user_id) {
        console.warn(`[SECURITY] User ${user_id} attempted to rebuild resume ${resume_id} belonging to ${existing.user_id}`);
        throw new Error("Identity mismatch: Access denied to target document.");
      }
    }

    // 4. Initialize Execution State
    if (run_id) {
      await supabase.from('execution_runs').update({ status: 'running' }).eq('id', run_id)
      await supabase.from('execution_logs').insert({
        run_id,
        message: `Initializing architect build for ${safeRole} on track ${safeTrack}`,
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
        temperature: 0.1 // Lower for consistent architecture
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
      ]
    })

    const prompt = `Architect a market-aligned resume for the "${safeTrack}" track.
    TARGET ROLE: ${safeRole}
    SOURCE CONTENT: ${safeSource}
    
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

    // 5. Execute with Retry Logic
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
        console.log("[GEMINI REBUILD RESPONSE]:", responseText)

        // VALIDATION (REL-009)
        const parsed = JSON.parse(responseText || '{}')
        const resumeData = parsed.newResume || parsed.resume || parsed;
        if (!resumeData || !resumeData.contact || !resumeData.experience) {
          throw new Error("Malformed LLM response: Incomplete architecture.")
        }
        results = resumeData
        break
      } catch (err: any) {
        attempts++
        if (attempts >= maxAttempts) throw err
        await new Promise(r => setTimeout(r, 1000 * attempts))
      }
    }

    // 6. Finalize and Persist
    // Ensure parent resume exists if it's a new or specified ID
    const target_resume_id = resume_id === 'NEW' ? crypto.randomUUID() : resume_id;

    const { error: parentError } = await supabase
      .from('resumes')
      .upsert({
        id: target_resume_id,
        user_id, // SECURE
        name: `Rebuild - ${safeRole}`,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })

    if (parentError) throw parentError

    // Create or update the version in the database
    let version: any;
    if (version_id) {
      const { data, error: vError } = await supabase
        .from('resume_versions')
        .update({
          resume_id: target_resume_id,
          version_type: 'optimized',
          data: results,
          status: 'COMPLETED'
        })
        .eq('id', version_id)
        .select()
        .single()
      if (vError) throw vError
      version = data
    } else {
      const { data, error: vError } = await supabase
        .from('resume_versions')
        .insert({
          resume_id: target_resume_id,
          version_type: 'optimized',
          data: results,
          status: 'COMPLETED'
        })
        .select()
        .single()
      if (vError) throw vError
      version = data
    }

    if (run_id) {
      await supabase.from('execution_runs').update({
        status: 'completed',
        completed_at: new Date().toISOString()
      }).eq('id', run_id)

      await supabase.from('execution_logs').insert({
        run_id,
        message: `Success: Version ${version.id} committed.`,
        level: 'success'
      })
    }

    return new Response(JSON.stringify(version), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err: any) {
    console.error(`[REBUILD ERROR]:`, err)

    try {
      const { run_id, version_id } = await req.clone().json()

      if (version_id) {
        await supabase
          .from('resume_versions')
          .update({ status: 'FAILED', error_reason: err.message })
          .eq('id', version_id)
      }

      if (run_id) {
        await supabase.from('execution_runs').update({
          status: 'failed',
          error_reason: err.message
        }).eq('id', run_id)

        await supabase.from('execution_logs').insert({
          run_id,
          message: `REBUILD FAILURE: ${err.message}`,
          level: 'error'
        })
      }
    } catch { }

    return new Response(JSON.stringify({
      error: err.name || 'Error',
      message: typeof err.message === 'string' ? err.message : JSON.stringify(err)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
}

Deno.serve(generateRebuild)
