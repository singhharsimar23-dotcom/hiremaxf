
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenAI } from 'https://esm.sh/@google/genai@1.34.0';

export async function generateDiagnostic(req: Request) {
  const supabase = createClient(
    process.env.SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  );

  try {
    const { user_id, targetRole, roleTrack, resumeText } = await req.json();

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Analyze this resume for the role of "${targetRole}" within the "${roleTrack}" market track.
    Return a JSON object in this exact structure:
    {
      "overallScore": number,
      "marketReadinessLabel": "Low" | "Medium" | "High",
      "eightPoints": [
        { "id": string, "name": string, "score": number, "explanation": string, "riskHint": string }
      ]
    }
    RESUME TEXT: ${resumeText}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    const results = JSON.parse(response.text || '{}');

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
      .single();

    if (error) throw error;

    return new Response(JSON.stringify(analysis), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
