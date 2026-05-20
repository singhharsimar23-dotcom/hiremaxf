import { createClient } from 'npm:@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'npm:@google/generative-ai'

import { checkPlanGate } from '../_shared/plan-gate.ts'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export async function generateOutlook(req: Request) {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    try {
        const gateResult = await checkPlanGate(req, ['Career Elite', 'Automation'])
        if (gateResult instanceof Response) return gateResult
        const { user } = gateResult

        const body = await req.json()
        const { role, geography, expBand, run_id } = body
        const user_id = user.id // SECURE: Anchored to JWT

        // 3. PROMPT SANITIZATION (SEC-006)
        const sanitize = (text: string, max: number) => {
            return text
                .replace(/[^\w\s\-,.]/gi, '') // Whitelist alphanumeric and common chars
                .slice(0, max)
                .trim()
        }

        const safeRole = sanitize(role || '', 60)
        const safeGeography = sanitize(geography || '', 60)
        const safeExpBand = sanitize(expBand || '', 40)

        if (!safeRole || !safeGeography) throw new Error("Invalid input: Role and Geography are required.")

        // 3. Initialize Execution State
        if (run_id) {
            await supabase.from('execution_runs').update({ status: 'running' }).eq('id', run_id)
            await supabase.from('execution_logs').insert({
                run_id,
                message: `Initiating market command projection for ${safeRole} in ${safeGeography}`,
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
                temperature: 0.1 // Lowered for consistency and reliability
            },
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
            ]
        })

        const prompt = `You are the HireMax Career Elite Market Command Engine.
    TASK: ISSUE A SYNTHETIC MARKET COMMAND PROJECTION BASED ON CURRENT MACRO TRENDS.
    
    INPUT CONTEXT:
    Role: ${safeRole}
    Geography: ${safeGeography}
    Experience: ${safeExpBand}

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
    }
    
    DO NOT INCLUDE ANY TEXT OUTSIDE THE JSON BLOCK.`

        // 4. Execute with Retry Logic
        let results: any = null
        let attempts = 0
        const maxAttempts = 3

        while (attempts < maxAttempts) {
            try {
                if (run_id) {
                    await supabase.from('execution_logs').insert({
                        run_id,
                        message: `Gemini Outlook Dispatch: Attempt ${attempts + 1}/${maxAttempts}`,
                        level: 'info'
                    })
                }

                const result = await model.generateContent(prompt)
                const responseText = result.response.text()
                console.log("[GEMINI OUTLOOK RESPONSE]:", responseText)

                // DATA INTEGRITY CHECK
                const parsed = JSON.parse(responseText || '{}')
                if (!parsed.marketStatus || !parsed.executionTargets) {
                    throw new Error("Malformed LLM response: Missing required fields")
                }
                results = parsed
                break
            } catch (err: any) {
                attempts++
                console.warn(`Attempt ${attempts} failed:`, err.message)
                if (attempts >= maxAttempts) throw err
                await new Promise(r => setTimeout(r, 1000 * attempts))
            }
        }

        // 5. Finalize and Persist
        const { data: snapshot, error } = await supabase
            .from('market_snapshots')
            .insert({
                user_id, // SECURE
                context_json: { role: safeRole, geography: safeGeography, expBand: safeExpBand },
                results_json: results,
                expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 day expiry
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
                message: `Success: Market command ${snapshot.id} hardened.`,
                level: 'success'
            })
        }

        return new Response(JSON.stringify(snapshot), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    } catch (err: any) {
        console.error(`[OUTLOOK ERROR]:`, err)

        try {
            const { run_id } = await req.clone().json()
            if (run_id) {
                await supabase.from('execution_runs').update({
                    status: 'failed',
                    error_reason: err.message
                }).eq('id', run_id)

                await supabase.from('execution_logs').insert({
                    run_id,
                    message: `OUTLOOK FAILURE: ${err.message}`,
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

Deno.serve(generateOutlook)
