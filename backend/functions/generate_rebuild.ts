
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenAI } from 'https://esm.sh/@google/genai@1.34.0';

export async function generateRebuild(req: Request) {
  const supabase = createClient(
    process.env.SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  );

  try {
    const { user_id, resume_id, targetRole, roleTrack, sourceText } = await req.json();

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
    }`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    const results = JSON.parse(response.text || '{}');

    // Create a new version in the database
    const { data: version, error } = await supabase
      .from('resume_versions')
      .insert({
        resume_id,
        version_type: 'optimized',
        data: results.newResume
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify(version), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
