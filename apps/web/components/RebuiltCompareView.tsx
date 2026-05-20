
import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight, 
  Zap, 
  Target,
  FileText,
  Lock,
  Loader2,
  AlertCircle,
  Mail,
  Phone,
  MapPin,
  Linkedin,
  Link as LinkIcon,
  Download,
  Save
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ComparisonData, UserPlan, DiagnosticResult, StructuredResume } from '../types';

// Add missing interface definition for RebuiltCompareView component
interface RebuiltCompareViewProps {
  analysisId: string | null;
  history: Record<string, DiagnosticResult>;
  plan: UserPlan;
  onUpgrade: () => void;
  onSave: (rebuilt: StructuredResume, analysisId: string) => void;
}

const StructuredResumeRenderer: React.FC<{ resume: StructuredResume }> = ({ resume }) => (
  <div className="bg-white text-slate-900 p-12 shadow-inner min-h-full font-serif" id="resume-rebuilt-preview">
    <header className="mb-8 border-b-2 border-slate-900 pb-6">
      <h1 className="text-3xl font-extrabold uppercase tracking-tight text-slate-950 mb-3">{resume.contact.full_name}</h1>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[10px] font-bold text-slate-700">
        {resume.contact.email && <div className="flex items-center gap-1.5"><Mail size={12} /> {resume.contact.email}</div>}
        {resume.contact.phone && <div className="flex items-center gap-1.5"><Phone size={12} /> {resume.contact.phone}</div>}
        {resume.contact.location && <div className="flex items-center gap-1.5"><MapPin size={12} /> {resume.contact.location}</div>}
        {resume.contact.links.map((link, idx) => (
          <div key={idx} className="flex items-center gap-1.5"><LinkIcon size={12} /> {link}</div>
        ))}
      </div>
    </header>

    <div className="space-y-8">
      {resume.summary && (
        <section>
          <h2 className="text-[11px] font-extrabold uppercase border-b border-slate-200 pb-1 mb-3 text-slate-950 tracking-widest">Professional Summary</h2>
          <p className="text-[13px] leading-relaxed text-slate-800">{resume.summary}</p>
        </section>
      )}

      {resume.experience.length > 0 && (
        <section>
          <h2 className="text-[11px] font-extrabold uppercase border-b border-slate-200 pb-1 mb-4 text-slate-950 tracking-widest">Work Experience</h2>
          <div className="space-y-6">
            {resume.experience.map((exp, idx) => (
              <div key={idx}>
                <div className="flex justify-between items-baseline mb-0.5">
                  <h3 className="text-[14px] font-bold text-slate-950">{exp.title}</h3>
                  <span className="text-[10px] font-bold text-slate-600">{exp.dates}</span>
                </div>
                <p className="text-[12px] font-bold text-slate-700 italic mb-2">{exp.organization}</p>
                <ul className="list-disc list-outside ml-4 space-y-1">
                  {exp.bullets.map((bullet, bIdx) => (
                    <li key={bIdx} className="text-[12px] text-slate-800 leading-snug">{bullet}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {resume.skills && (
        <section>
          <h2 className="text-[11px] font-extrabold uppercase border-b border-slate-200 pb-1 mb-3 text-slate-950 tracking-widest">Technical Skills</h2>
          <div className="grid grid-cols-1 gap-1 text-[12px]">
            {resume.skills.languages.length > 0 && <p><span className="font-bold">Languages:</span> {resume.skills.languages.join(', ')}</p>}
            {resume.skills.frameworks.length > 0 && <p><span className="font-bold">Frameworks:</span> {resume.skills.frameworks.join(', ')}</p>}
            {resume.skills.tools.length > 0 && <p><span className="font-bold">Tools:</span> {resume.skills.tools.join(', ')}</p>}
            {resume.skills.specializations.length > 0 && <p><span className="font-bold">Specializations:</span> {resume.skills.specializations.join(', ')}</p>}
          </div>
        </section>
      )}

      {resume.projects.length > 0 && (
        <section>
          <h2 className="text-[11px] font-extrabold uppercase border-b border-slate-200 pb-1 mb-4 text-slate-950 tracking-widest">Key Projects</h2>
          <div className="space-y-5">
            {resume.projects.map((proj, idx) => (
              <div key={idx}>
                <h3 className="text-[14px] font-bold text-slate-950">{proj.name}</h3>
                <p className="text-[12px] text-slate-800 leading-snug mb-1">{proj.description}</p>
                <p className="text-[12px] font-bold text-slate-700 italic"><span className="uppercase text-[9px] not-italic tracking-wider mr-1">Impact:</span> {proj.impact}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {resume.education.length > 0 && (
        <section>
          <h2 className="text-[11px] font-extrabold uppercase border-b border-slate-200 pb-1 mb-4 text-slate-950 tracking-widest">Education</h2>
          <div className="space-y-4">
            {resume.education.map((edu, idx) => (
              <div key={idx}>
                <div className="flex justify-between items-baseline mb-0.5">
                  <h3 className="text-[14px] font-bold text-slate-950">{edu.institution}</h3>
                  <span className="text-[10px] font-bold text-slate-600">{edu.dates}</span>
                </div>
                <p className="text-[12px] font-bold text-slate-700 italic">{edu.degree}</p>
                {edu.details && <p className="text-[12px] text-slate-800 mt-1">{edu.details}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  </div>
);

export const RebuiltCompareView: React.FC<RebuiltCompareViewProps> = ({ analysisId, history, plan, onUpgrade, onSave }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ComparisonData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analysis = analysisId ? history[analysisId] : null;

  useEffect(() => {
    let active = true;
    const performRebuild = async () => {
      if (!analysisId || !analysis) {
        setError("Please run a resume review before rebuilding.");
        return;
      }

      // Prevent execution if we already have matching rebuild data, or if we are already loading
      if (data && data.analysisId === analysisId) return;

      setLoading(true);
      setError(null);

      try {
        const prompt = `
          SYSTEM RULE — RESUME REBUILD OUTPUT FORMAT (STRICT)
          You are rebuilding a resume for HireMax.
          HireMax uses a structured Resume Architect system.
          You are NOT allowed to output freeform text, markdown, or document-style resumes.
          
          TASK: Deterministic resume rebuilding for ${analysis.role}.
          ORIGINAL: ${analysis.resumeText}
          GAPS FOUND: ${analysis.eightPoints.filter(p => p.score < 80).map(p => p.name).join(', ')}
          SOURCE ANALYSIS ID: ${analysis.analysisId}
          
          CONTENT RULES:
          1. Rewrite content based on the analysis insights provided.
          2. Improve clarity, impact markers, and signal density.
          3. Maintain original facts but optimize phrasing.
          4. Do NOT invent experience or inflate metrics.
          5. Identify 5-7 resume-focused skills to strengthen or add.

          Return a JSON object in this format:
          {
            "newResume": {
              "contact": { "full_name": string, "email": string, "phone": string, "location": string, "links": string[] },
              "summary": string,
              "education": Array<{ "institution": string, "degree": string, "dates": string, "details": string }>,
              "experience": Array<{ "title": string, "organization": string, "dates": string, "bullets": string[] }>,
              "projects": Array<{ "name": string, "description": string, "impact": string }>,
              "skills": { "languages": string[], "frameworks": string[], "tools": string[], "specializations": string[] },
              "leadership": Array<{ "role": string, "description": string }>
            },
            "improvements": Array<{ "change": string, "reasoning": string }>,
            "scoreLift": number,
            "skillsToAdd": Array<{ "name": string, "reason": string }>
          }
        `;

        const { data: genData, error: genError } = await supabase.functions.invoke('generate-text', { body: { prompt } });
        if (genError) throw genError;
        if (genData?.error) throw new Error(genData.error);

        if (!active) return;

        let raw = genData?.text ?? '';
        // Robust JSON Extraction
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          raw = jsonMatch[0];
        } else {
          raw = raw.replace(/```json/gi, '').replace(/```/gi, '').trim();
        }

        const parsed = JSON.parse(raw || '{}');
        setData({
          analysisId: analysis.analysisId,
          oldResume: analysis.resumeText,
          newResume: parsed.newResume,
          improvements: parsed.improvements || [],
          scoreLift: parsed.scoreLift || 20,
          skillsToAdd: (parsed.skillsToAdd || []).slice(0, 7)
        });
      } catch (err) {
        console.error("Rebuild failed", err);
        if (active) {
          setError("Rebuild generation failed. Please try again.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    performRebuild();
    return () => {
      active = false;
    };
  }, [analysisId, analysis, data]);

  const handleDownload = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const content = document.getElementById('resume-rebuilt-preview')?.outerHTML;
      const resumeName = data?.newResume?.contact?.full_name || 'Resume';
      // Strip original title to prevent branding in headers
      const styles = document.head.innerHTML.replace(/<title>.*?<\/title>/g, '');
      
      printWindow.document.write(`
        <html>
          <head>
            <title>${resumeName}</title>
            ${styles}
            <style>
              body { background: white !important; margin: 0 !important; padding: 0 !important; }
              @media print {
                @page { margin: 0; }
                body { margin: 1.6cm; }
                .no-print { display: none; }
                #resume-rebuilt-preview { box-shadow: none !important; width: 100% !important; }
              }
            </style>
          </head>
          <body>
            <div>${content}</div>
            <script>
              window.onload = () => {
                window.print();
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-10">
        <div className="w-16 h-16 bg-red-600/10 rounded-2xl flex items-center justify-center mb-8 border border-red-500/20">
          <AlertCircle className="text-red-500" size={32} />
        </div>
        <h2 className="text-xl font-black text-white uppercase tracking-tight mb-4">{error}</h2>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
        <Loader2 size={64} className="text-blue-500 animate-spin" strokeWidth={1.5} />
        <div className="text-center">
          <h3 className="text-2xl font-bold text-white mb-2 uppercase tracking-tight">Improving Document Clarity</h3>
          <p className="text-slate-500 font-medium tracking-tight">Optimizing architecture based on analysis_{analysisId?.slice(0, 8)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto py-12 px-10">
      <div className="mb-16 flex justify-between items-end">
        <div>
          <div className="flex items-center gap-3 text-green-400 mb-4 bg-green-400/5 w-fit px-4 py-1 rounded-full border border-green-400/10">
            <CheckCircle2 size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Deterministic Rebuild Complete</span>
          </div>
          <h2 className="text-5xl font-black text-white tracking-tighter uppercase">Rebuild & Compare</h2>
          <p className="text-slate-500 text-lg font-medium">Architectural optimization for {analysis?.role}.</p>
        </div>
        <div className="flex items-center gap-4">
           <div className="bg-[#16161E] px-10 py-6 rounded-3xl border border-[#1D1D26] text-right">
             <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Est. Score Lift</p>
             <p className="text-4xl font-black text-green-400">+{data.scoreLift}%</p>
           </div>
           <div className="flex flex-col gap-2">
              <button 
                onClick={handleDownload}
                className="bg-white text-blue-900 font-black py-3 px-6 rounded-xl shadow-xl hover:bg-blue-50 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-[10px]"
              >
                <Download size={14} /> Download PDF
              </button>
              <button 
                onClick={() => onSave(data.newResume, analysisId!)}
                className="bg-blue-600 text-white font-black py-3 px-6 rounded-xl shadow-xl hover:bg-blue-500 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-[10px]"
              >
                <Save size={14} /> Save to History
              </button>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-20">
        <div className="space-y-6">
          <h3 className="text-white font-bold flex items-center gap-2">
            <FileText className="text-slate-500" size={18} /> Source Fragment
          </h3>
          <div className="bg-[#0D0D12] border border-[#1D1D26] p-8 rounded-3xl h-[700px] overflow-y-auto custom-scrollbar">
            <pre className="text-slate-500 text-xs font-mono whitespace-pre-wrap leading-relaxed">
              {data.oldResume}
            </pre>
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-white font-bold flex items-center gap-2">
            <Sparkles className="text-blue-500" size={18} /> Structured Architecture
          </h3>
          <div className="bg-[#16161E] border border-blue-500/20 rounded-3xl h-[700px] overflow-hidden">
            <div className="h-full overflow-y-auto custom-scrollbar">
              <StructuredResumeRenderer resume={data.newResume} />
            </div>
          </div>
        </div>
      </div>

      <div className="mb-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.improvements.map((imp, idx) => (
          <div key={idx} className="bg-[#16161E] border border-[#1D1D26] p-8 rounded-3xl">
            <p className="text-white font-bold text-sm mb-2">{imp.change}</p>
            <p className="text-slate-500 text-xs font-medium leading-relaxed italic">
              {imp.reasoning}
            </p>
          </div>
        ))}
      </div>

      <div className="mb-20 space-y-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-500">
            <Target size={20} />
          </div>
          <h3 className="text-2xl font-bold text-white tracking-tight">Signal Boost Recommendations</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.skillsToAdd.map((skill, idx) => (
            <div key={idx} className="bg-[#16161E] border border-[#1D1D26] p-8 rounded-3xl group hover:border-blue-500/30 transition-all">
              <h4 className="text-white font-bold mb-2 group-hover:text-blue-400 transition-colors">{skill.name}</h4>
              <p className="text-slate-500 text-xs font-medium leading-relaxed">
                {skill.reason}
              </p>
            </div>
          ))}
        </div>
      </div>

      {plan !== 'Career Elite' && (
        <div className="bg-[#1A1D26] border border-[#2D313D] rounded-[3.5rem] p-12 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
            <Zap size={240} />
          </div>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h3 className="text-3xl font-bold text-white mb-4 tracking-tight">Thinking Beyond This Resume?</h3>
            <p className="text-slate-400 font-medium">Career Elite helps you plan what to learn next and how to stay competitive long-term.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            {['Skill Gap Guidance', 'Market Skill Intelligence', 'Career Longevity Planning'].map((label, idx) => (
              <div key={idx} className="bg-[#0D0D12] border border-[#1D1D26] p-8 rounded-3xl relative overflow-hidden text-center">
                <div className="blur-sm select-none opacity-20">
                  <div className="w-12 h-12 bg-slate-700 rounded-full mx-auto mb-6"></div>
                  <div className="h-4 bg-slate-700 rounded w-3/4 mx-auto mb-3"></div>
                  <div className="h-4 bg-slate-700 rounded w-1/2 mx-auto"></div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center p-6">
                  <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">{label}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-center">
            <button 
              onClick={onUpgrade}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 px-12 rounded-2xl shadow-2xl transition-all uppercase tracking-widest text-xs flex items-center gap-3"
            >
              Explore Career Elite <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
