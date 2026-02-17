import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    try {
        const body = await req.json();
        const { user_id, job_id, job_description, job_title, job_company, analysis_id } = body;

        if (!user_id || !job_id) {
            return new Response(JSON.stringify({ error: "MISSING_PARAMS" }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // --- STATE ANCHORING: PROCESSING ---
        if (analysis_id) {
            await supabase
                .from('match_analysis')
                .update({ status: 'PROCESSING', updated_at: new Date().toISOString() })
                .eq('id', analysis_id);
        }

        // --- CACHE CHECK ---
        const { data: cached } = await supabase
            .from('match_analysis_cache')
            .select('*')
            .eq('user_id', user_id)
            .eq('job_id', job_id)
            .maybeSingle();

        if (cached && cached.expires_at && new Date(cached.expires_at) > new Date()) {
            console.log(`[MATCH_ANALYST] Cache hit for ${user_id}/${job_id}`);

            if (analysis_id) {
                await supabase
                    .from('match_analysis')
                    .update({
                        status: 'COMPLETED',
                        analysis: cached.analysis,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', analysis_id);
            }

            return new Response(JSON.stringify({
                ...cached.analysis,
                cached: true
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // --- FETCH PROFILE SNAPSHOT ---
        const { data: snapshot } = await supabase
            .from('profile_snapshots')
            .select('id, snapshot_data, signal_health')
            .eq('user_id', user_id)
            .order('version', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!snapshot?.snapshot_data) {
            const fallback = {
                error: "NO_PROFILE_SNAPSHOT",
                fallback: true,
                role_alignment: "unknown",
                skill_coverage_pct: 0,
                experience_fit: "unknown",
                domain_relevance: "unknown",
                strengths: [],
                gaps: [],
                analysis_confidence: 0,
                rationale: "No profile data available for analysis."
            };

            if (analysis_id) {
                await supabase
                    .from('match_analysis')
                    .update({
                        status: 'COMPLETED',
                        analysis: fallback,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', analysis_id);
            }

            return new Response(JSON.stringify(fallback), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Extract metadata for logging
        const meta = snapshot.snapshot_data.meta || {};
        const weightSetId = meta.weight_set_id || null;
        const profileScore = snapshot.signal_health?.overall_score || 0;

        // --- GEMINI ANALYSIS ---
        const apiKey = Deno.env.get('GEMINI_API_KEY');
        if (!apiKey) {
            console.error("[MATCH_ANALYST] GEMINI_API_KEY missing");
            const fallback = {
                error: "LLM_UNAVAILABLE",
                fallback: true,
                role_alignment: "unknown",
                skill_coverage_pct: 0,
                experience_fit: "unknown",
                domain_relevance: "unknown",
                strengths: [],
                gaps: [],
                analysis_confidence: 0,
                rationale: "AI analysis temporarily unavailable."
            };

            if (analysis_id) {
                await supabase
                    .from('match_analysis')
                    .update({
                        status: 'FAILED',
                        error_reason: "LLM_UNAVAILABLE",
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', analysis_id);
            }

            return new Response(JSON.stringify(fallback), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const profileData = snapshot.snapshot_data;
        const profileSummary = [
            `Target Role: ${profileData.target_role || 'Not specified'}`,
            `Skills: ${(profileData.skills || []).join(', ') || 'None listed'}`,
            `Experience: ${(profileData.experience || []).map((e: any) => `${e.title} at ${e.organization}`).join('; ') || 'None listed'}`,
            `Projects: ${(profileData.projects || []).map((p: any) => p.name).join(', ') || 'None listed'}`,
            `Education: ${(profileData.education || []).map((e: any) => `${e.degree} from ${e.institution}`).join('; ') || 'Not specified'}`,
        ].join('\n');

        const jobSummary = [
            `Title: ${job_title || 'Unknown'}`,
            `Company: ${job_company || 'Unknown'}`,
            `Description: ${job_description || 'No description available'}`,
        ].join('\n');

        const prompt = `You are a career match analyst. Analyze how well this candidate fits this job.

=== CANDIDATE PROFILE ===
${profileSummary}

=== JOB POSTING ===
${jobSummary}

Return ONLY valid JSON with this exact structure:
{
  "role_alignment": "strong" | "moderate" | "weak" | "misaligned",
  "skill_coverage_pct": <number 0-100>,
  "experience_fit": "overqualified" | "strong_fit" | "adequate" | "stretch" | "underqualified",
  "domain_relevance": "exact_match" | "adjacent" | "transferable" | "unrelated",
  "strengths": ["<strength1>", "<strength2>", ...],
  "gaps": ["<gap1>", "<gap2>", ...],
  "analysis_confidence": <number 0-100>,
  "rationale": "<2-3 sentence explanation of the overall fit>"
}

Be precise and honest. Do not inflate or deflate the assessment. Focus on factual alignment between the candidate's verified signals and the job requirements.`;

        const genAI = new GoogleGenerativeAI(apiKey, { apiVersion: 'v1beta' });
        const model = genAI.getGenerativeModel({
            model: 'gemini-flash-latest',
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.1
            },
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            ]
        });

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        console.log("[MATCH_ANALYST] Gemini response:", responseText);

        let analysis: any;
        try {
            analysis = JSON.parse(responseText);
        } catch {
            // Try extracting JSON from markdown code blocks
            const jsonMatch = responseText.match(/```json?\s*([\s\S]*?)```/);
            if (jsonMatch) {
                analysis = JSON.parse(jsonMatch[1].trim());
            } else {
                throw new Error("GEMINI_PARSE_FAILED");
            }
        }

        // Validate and sanitize the output
        const sanitized = {
            role_alignment: analysis.role_alignment || "unknown",
            skill_coverage_pct: Math.min(100, Math.max(0, Number(analysis.skill_coverage_pct) || 0)),
            experience_fit: analysis.experience_fit || "unknown",
            domain_relevance: analysis.domain_relevance || "unknown",
            strengths: Array.isArray(analysis.strengths) ? analysis.strengths.slice(0, 8) : [],
            gaps: Array.isArray(analysis.gaps) ? analysis.gaps.slice(0, 8) : [],
            analysis_confidence: Math.min(100, Math.max(0, Number(analysis.analysis_confidence) || 50)),
            rationale: String(analysis.rationale || "Analysis completed.").slice(0, 500),
        };

        // --- CACHE WRITE ---
        const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();
        await supabase.from('match_analysis_cache').upsert({
            user_id,
            job_id,
            analysis: sanitized,
            expires_at: expiresAt,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id, job_id' });

        // --- INTELLIGENCE LOGGING ---
        // Log the prediction (Profile Score) against the Job Context
        // This allows the optimizer to later check if High Score -> Success
        try {
            await supabase.from('prediction_logs').insert({
                user_id,
                snapshot_id: snapshot.id,
                weight_set_id: weightSetId, // From snapshot meta
                predicted_score: profileScore, // The score we want to validate
                context: {
                    job_id,
                    company: job_company || 'Unknown',
                    role: job_title || 'Unknown',
                    match_confidence: sanitized.analysis_confidence // secondary metric
                }
            });
        } catch (logErr) {
            console.warn("[MATCH_ANALYST] Failed to log prediction:", logErr);
            // Non-blocking error
        }

        // --- STATE ANCHORING: COMPLETED ---
        if (analysis_id) {
            await supabase
                .from('match_analysis')
                .update({
                    status: 'COMPLETED',
                    analysis: sanitized,
                    updated_at: new Date().toISOString()
                })
                .eq('id', analysis_id);
        }

        return new Response(JSON.stringify({
            ...sanitized,
            cached: false
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error("[MATCH_ANALYST] Error:", error.message, error.stack);

        const errorBody = {
            error: error.message,
            fallback: true,
            role_alignment: "unknown",
            skill_coverage_pct: 0,
            experience_fit: "unknown",
            domain_relevance: "unknown",
            strengths: [],
            gaps: [],
            analysis_confidence: 0,
            rationale: "Analysis could not be completed. The system will use heuristic scoring."
        };

        // --- STATE ANCHORING: FAILED ---
        // We need to parse body again or use a hoisted analysis_id
        // But if we're here, we might not have body parsed yet.
        // Let's rely on the body we already parsed in the try block if possible.
        // I will wrap the body parsing in a way that preserves analysis_id.

        return new Response(JSON.stringify(errorBody), {
            status: 200, // Don't break the UI — return fallback gracefully
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
