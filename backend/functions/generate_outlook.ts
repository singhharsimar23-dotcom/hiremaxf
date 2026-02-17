import { createClient } from 'npm:@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'npm:@google/generative-ai'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export async function generateOutlook(req: Request) {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { user_id, role, geography, expBand } = await req.json()

        const apiKey = Deno.env.get('GEMINI_API_KEY')
        if (!apiKey) {
            throw new Error('Missing GEMINI_API_KEY environment variable')
        }
        const genAI = new GoogleGenerativeAI(apiKey)
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

        const prompt = `You are the HireMax Career Elite Market Command Engine.
    ISSUE A SYNTHETIC MARKET COMMAND PROJECTION.
    
    INPUT CONTEXT:
    Role: ${role}
    Geography: ${geography}
    Experience: ${expBand}

    OUTPUT RULES (STRICT JSON):
    {
      "marketStatus": { "label": string, "implication": string },
      "executionTargets": [{ "company": string, "roleTitle": string, "fitReason": string, "confidence": number, "validityWindow": string }],
      "doNotApplyZone": [{ "entityType": string, "reasoning": string }],
      "actionOrders": { 
        "next7Days": string[], 
        "next30Days": string[], 
        "positioningDirectives": string[], 
        "interviewDirectives": string[] 
      },
      "risks": { "uncertainty": string, "refreshCondition": string }
    }`

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
        })

        const responseText = result.response.text()
        const results = JSON.parse(responseText || '{}')

        // Persist to DB
        const { data: snapshot, error } = await supabase
            .from('market_snapshots')
            .insert({
                user_id,
                context_json: { role, geography, expBand },
                results_json: results,
                expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 day expiry
            })
            .select()
            .single()

        if (error) throw error

        return new Response(JSON.stringify(snapshot), {
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

Deno.serve(generateOutlook)
