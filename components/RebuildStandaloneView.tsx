
import React, { useState, useRef } from 'react';
import { 
  Sparkles, 
  Briefcase, 
  Building2, 
  ChevronRight, 
  UploadCloud, 
  Loader2, 
  CheckCircle2, 
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Zap,
  Lock,
  Target,
  FileText,
  History
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { UserPlan, StructuredResume, ResumeGroup } from '../types';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs`;

interface RebuildStandaloneViewProps {
  plan: UserPlan;
  credits: number;
  setCredits: (c: number) => void;
  onRebuildSuccess: (rebuilt: StructuredResume, analysisId?: string, label?: string) => void;
  onUpgrade: () => void;
  history: ResumeGroup[];
}

const BundleCard: React.FC<{ count: number; price: string; total: string; onBuy: () => void; popular?: boolean }> = ({ count, price, total, onBuy, popular }) => (
  <div className={`bg-[#1A1D26] border ${popular ? 'border-blue-500 shadow-2xl shadow-blue-900/10 scale-105' : 'border-[#2D313D] shadow-xl'} p-8 rounded-[2.5rem] flex flex-col items-center text-center group transition-all relative`}>
    {popular && (
      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest px-4 py-1 rounded-full shadow-lg">Most Popular</span>
    )}
    <div className="w-12 h-12 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-500 mb-6">
      <Zap size={24} />
    </div>
    <h4 className="text-xl font-black text-white mb-1 uppercase tracking-tight">{count} {count === 1 ? 'Resume' : 'Resumes'}</h4>
    <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-4">Rebuild Bundle</p>
    <p className="text-5xl font-black text-white mb-2">{total}</p>
    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-8">{price} / resume</p>
    <button 
      onClick={onBuy}
      className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl transition-all uppercase tracking-widest text-[11px] shadow-lg shadow-blue-900/20"
    >
      Buy & Start Rebuild
    </button>
  </div>
);

export const RebuildStandaloneView: React.FC<RebuildStandaloneViewProps> = ({ plan, credits, setCredits, onRebuildSuccess, onUpgrade, history }) => {
  const [step, setStep] = useState<'marketing' | 'form' | 'processing' | 'feedback'>('form');
  const [loading, setLoading] = useState(false);
  const [resumeText, setResumeText] = useState('');
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    role: '',
    seniority: 'Mid-Level',
    industry: '',
    companyType: ''
  });

  const isStarter = plan === 'Starter';
  const hasUnlimited = plan !== 'Starter';
  const canRebuild = hasUnlimited || credits > 0;

  // If user is Starter and has no credits, force marketing view
  const activeStep = (isStarter && credits <= 0 && step !== 'marketing') ? 'marketing' : step;

  const handleBuy = (amount: number) => {
    setCredits(credits + amount);
    setStep('form');
  };

  const processFile = async (file: File) => {
    setIsParsing(true);
    try {
      if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n';
        }
        setResumeText(fullText);
        setSelectedResumeId('');
      } else if (file.type.includes('word')) {
        const arrayBuffer = await file.arrayBuffer();
        const res = await mammoth.extractRawText({ arrayBuffer });
        setResumeText(res.value);
        setSelectedResumeId('');
      } else {
        setResumeText(await file.text());
        setSelectedResumeId('');
      }
    } catch (err) {
      alert("Parsing failed.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleSelectExisting = (id: string) => {
    setSelectedResumeId(id);
    const group = history.find(g => g.id === id);
    if (group) {
      // Use the latest version for context
      const latest = group.versions[0];
      // Flattening structure back to text for AI context
      const text = `
        ${latest.data.contact.full_name}
        ${latest.data.summary}
        Experience: ${latest.data.experience.map(e => `${e.title} at ${e.organization}: ${e.bullets.join(' ')}`).join('\n')}
        Education: ${latest.data.education.map(e => `${e.degree} at ${e.institution}`).join('\n')}
      `;
      setResumeText(text);
    }
  };

  const startRebuild = async () => {
    if (!resumeText || !formData.role || !formData.industry || !formData.companyType) return;
    setStep('processing');
    setLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `
        SYSTEM RULE — RESUME REBUILD OUTPUT FORMAT (STRICT)
        You are rebuilding a resume for HireMax Resume Architect.
        This is an execution-focused task to survive screening for a specific role and company type.
        
        TASK: Architect a market-aligned resume.
        TARGET ROLE: ${formData.role}
        SENIORITY: ${formData.seniority}
        INDUSTRY: ${formData.industry}
        COMPANY CONTEXT: ${formData.companyType}
        SOURCE CONTENT: ${resumeText}
        
        STRICT BEHAVIOR RULES:
        1. ROLE-SPECIFIC LOGIC: 
           - If role is Technical/Startup: Prioritize ownership, speed, and technical stack.
           - If role is Enterprise: Prioritize scale, stability, and process adherence.
           - If role is Mid/Senior: Emphasize business impact and data-driven outcomes.
        2. NO HALLUCINATION: Do NOT invent metrics, tools, or responsibilities. Rephrase conservatively.
        3. NO GENERIC OUTPUT: Avoid template language. Every bullet must be constrained by the target role/industry.
        4. COMPANY TYPE AWARENESS: Adjust section density and phrasing based on whether it is a ${formData.companyType}.
        5. OUTPUT ONLY STRUCTURED JSON. NO EXPLANATIONS.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              newResume: {
                type: Type.OBJECT,
                properties: {
                  contact: {
                    type: Type.OBJECT,
                    properties: {
                      full_name: { type: Type.STRING },
                      email: { type: Type.STRING },
                      phone: { type: Type.STRING },
                      location: { type: Type.STRING },
                      links: { type: Type.ARRAY, items: { type: Type.STRING } }
                    }
                  },
                  summary: { type: Type.STRING },
                  education: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        institution: { type: Type.STRING },
                        degree: { type: Type.STRING },
                        dates: { type: Type.STRING },
                        details: { type: Type.STRING }
                      }
                    }
                  },
                  experience: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        organization: { type: Type.STRING },
                        dates: { type: Type.STRING },
                        bullets: { type: Type.ARRAY, items: { type: Type.STRING } }
                      }
                    }
                  },
                  projects: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        description: { type: Type.STRING },
                        impact: { type: Type.STRING }
                      }
                    }
                  },
                  skills: {
                    type: Type.OBJECT,
                    properties: {
                      languages: { type: Type.ARRAY, items: { type: Type.STRING } },
                      frameworks: { type: Type.ARRAY, items: { type: Type.STRING } },
                      tools: { type: Type.ARRAY, items: { type: Type.STRING } },
                      specializations: { type: Type.ARRAY, items: { type: Type.STRING } }
                    }
                  },
                  leadership: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        role: { type: Type.STRING },
                        description: { type: Type.STRING }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });

      const parsed = JSON.parse(response.text || '{}');
      if (!hasUnlimited) setCredits(credits - 1);
      
      onRebuildSuccess(parsed.newResume, undefined, `${formData.role} @ ${formData.companyType}`);

    } catch (err) {
      console.error(err);
      setStep('form');
    } finally {
      setLoading(false);
    }
  };

  if (activeStep === 'marketing') {
    return (
      <div className="max-w-6xl mx-auto py-24 px-10">
        <div className="text-center mb-20 space-y-6">
          <div className="flex items-center justify-center gap-3 text-blue-500 mb-6 bg-blue-500/5 w-fit px-5 py-2 rounded-full border border-blue-500/10 mx-auto">
            <Sparkles size={18} />
            <span className="text-[12px] font-black uppercase tracking-widest">Execution-Ready Assets</span>
          </div>
          <h2 className="text-7xl font-black text-white tracking-tighter uppercase mb-4">Resume Rebuild</h2>
          <p className="text-slate-500 text-2xl font-medium max-w-3xl mx-auto leading-relaxed">
            Tailored for your role and company type. Optimized for ATS and recruiter screening.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-24">
          <BundleCard count={1} total="$19" price="$19" onBuy={() => handleBuy(1)} />
          <BundleCard count={3} total="$45" price="$15" popular onBuy={() => handleBuy(3)} />
          <BundleCard count={5} total="$69" price="$13.80" onBuy={() => handleBuy(5)} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-24">
           <div className="bg-[#16161E] border border-[#2D313D] p-12 rounded-[3.5rem] shadow-xl">
              <h3 className="text-2xl font-black text-white mb-6 uppercase tracking-tight">How it works</h3>
              <div className="space-y-8">
                 {[
                   { t: 'Input Context', d: 'Provide your target role, industry, and company type.' },
                   { t: 'Architectural Rebuild', d: 'Our engine re-maps your history to the target expectations.' },
                   { t: 'Permanent Asset', d: 'Get a fully editable, downloadable resume version.' }
                 ].map((s, i) => (
                    <div key={i} className="flex gap-6">
                       <div className="w-8 h-8 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-500 font-black text-xs shrink-0">{i+1}</div>
                       <div>
                          <p className="text-white font-bold text-lg mb-1">{s.t}</p>
                          <p className="text-slate-500 text-sm font-medium leading-relaxed">{s.d}</p>
                       </div>
                    </div>
                 ))}
              </div>
           </div>

           <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-12 rounded-[3.5rem] text-white flex flex-col justify-between shadow-2xl relative overflow-hidden group">
              <Lock className="absolute top-0 right-0 p-10 opacity-10" size={200} />
              <div className="relative z-10">
                 <h3 className="text-3xl font-black mb-4 uppercase tracking-tight leading-none">Applying to many roles?</h3>
                 <p className="text-blue-100 font-medium mb-10 opacity-90 leading-relaxed text-lg">
                    Career Pro & Elite members get unlimited rebuilds plus deeper explanations and market intelligence.
                 </p>
              </div>
              <button 
                onClick={onUpgrade}
                className="relative z-10 bg-white text-blue-900 font-black py-5 px-10 rounded-2xl flex items-center justify-center gap-3 uppercase tracking-widest text-xs hover:bg-blue-50 transition-all shadow-xl"
              >
                Upgrade to Career Pro <ArrowRight size={18} />
              </button>
           </div>
        </div>
      </div>
    );
  }

  if (step === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-10">
        <Loader2 size={80} className="text-blue-500 animate-spin" strokeWidth={1.5} />
        <div className="text-center space-y-4">
          <h3 className="text-3xl font-black text-white uppercase tracking-tight">Architectural Rebuild in Progress</h3>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">Target: {formData.role} @ {formData.companyType}</p>
          <div className="flex justify-center gap-8 pt-6">
             {['Role Alignment Strengthened', 'Seniority Positioning Clearer', 'ATS Compatibility Improved'].map((l, i) => (
               <div key={i} className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" /> {l}
               </div>
             ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-16 px-10">
      <div className="mb-12 flex justify-between items-end">
        <div>
          <h2 className="text-5xl font-black text-white tracking-tighter uppercase mb-2">Resume Rebuild</h2>
          <p className="text-slate-500 font-medium">Build a tailored version for a specific role and company.</p>
        </div>
        <div className="bg-[#16161E] px-8 py-4 rounded-2xl border border-[#1D1D26] text-right shadow-lg">
           <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Status</p>
           <p className="text-base font-black text-white">
             {hasUnlimited ? 'Unlimited Access' : `${credits} Credits Available`}
           </p>
        </div>
      </div>

      <div className="space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="space-y-8">
            <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-3">
              <Target size={14} className="text-blue-500" /> Mandatory Parameters
            </h3>
            <div className="space-y-6">
              <div>
                <label className="input-label">Target Role</label>
                <input 
                  type="text" 
                  placeholder="e.g. Senior Frontend Engineer"
                  value={formData.role}
                  onChange={e => setFormData({...formData, role: e.target.value})}
                  className="w-full bg-[#16161E] border border-[#1D1D26] rounded-2xl p-4 text-white focus:border-blue-500 outline-none transition-all shadow-inner"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Seniority</label>
                  <select 
                    value={formData.seniority}
                    onChange={e => setFormData({...formData, seniority: e.target.value})}
                    className="w-full bg-[#16161E] border border-[#1D1D26] rounded-2xl p-4 text-white focus:border-blue-500 outline-none transition-all appearance-none"
                  >
                    <option>Entry-Level</option>
                    <option>Mid-Level</option>
                    <option>Senior</option>
                    <option>Lead / Principal</option>
                    <option>Director / Management</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Industry</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Fintech, E-commerce"
                    value={formData.industry}
                    onChange={e => setFormData({...formData, industry: e.target.value})}
                    className="w-full bg-[#16161E] border border-[#1D1D26] rounded-2xl p-4 text-white focus:border-blue-500 outline-none transition-all shadow-inner"
                  />
                </div>
              </div>
              <div>
                <label className="input-label">Company / Company Type</label>
                <input 
                  type="text" 
                  placeholder="e.g. Stripe or FAANG"
                  value={formData.companyType}
                  onChange={e => setFormData({...formData, companyType: e.target.value})}
                  className="w-full bg-[#16161E] border border-[#1D1D26] rounded-2xl p-4 text-white focus:border-blue-500 outline-none transition-all shadow-inner"
                />
              </div>
            </div>
          </div>

          <div className="space-y-8">
             <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-3">
              <History size={14} className="text-blue-500" /> Source Content
            </h3>
            
            <div className="space-y-4">
              <label className="input-label">Select Source Resume</label>
              <div className="grid grid-cols-1 gap-3">
                {history.length > 0 && history.map(group => (
                  <button 
                    key={group.id}
                    onClick={() => handleSelectExisting(group.id)}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${selectedResumeId === group.id ? 'bg-blue-600/10 border-blue-500' : 'bg-[#16161E] border-[#1D1D26] hover:border-slate-700'}`}
                  >
                    <div className="flex items-center gap-3">
                      <FileText size={18} className={selectedResumeId === group.id ? 'text-blue-500' : 'text-slate-500'} />
                      <span className="text-sm font-bold text-white truncate max-w-[180px]">{group.name}</span>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">v{group.versions.length}</span>
                  </button>
                ))}
                
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-white/5 group ${resumeText && !selectedResumeId ? 'bg-green-500/5 border-green-500/20' : 'border-[#1D1D26]'}`}
                >
                  {isParsing ? <Loader2 className="animate-spin text-blue-500" /> : (
                    <>
                      <UploadCloud size={28} className={`mb-3 transition-colors ${resumeText && !selectedResumeId ? 'text-green-500' : 'text-slate-600 group-hover:text-blue-500'}`} />
                      <p className="text-white font-bold text-xs">{resumeText && !selectedResumeId ? 'Document Loaded' : 'Upload New Fragment'}</p>
                      <p className="text-slate-600 text-[9px] mt-1 uppercase tracking-widest">PDF, DOCX, TXT</p>
                    </>
                  )}
                  <input type="file" ref={fileInputRef} className="hidden" onChange={e => e.target.files?.[0] && processFile(e.target.files[0])} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <button 
          onClick={startRebuild}
          disabled={!canRebuild || !resumeText || !formData.role || !formData.industry || !formData.companyType || loading}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-6 rounded-3xl flex items-center justify-center gap-4 transition-all uppercase tracking-[0.2em] text-xs shadow-2xl shadow-blue-900/30"
        >
          {loading ? <Loader2 className="animate-spin" /> : <><Sparkles size={18} /> Execute Tailored Rebuild</>}
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="p-8 bg-[#16161E] border border-[#1D1D26] rounded-[2.5rem] flex items-center gap-6 shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-green-600/10 flex items-center justify-center text-green-500 shrink-0">
                <ShieldCheck size={24} />
              </div>
              <div>
                 <p className="text-white font-bold text-sm mb-1">Qualitative Trust Signals Only</p>
                 <p className="text-slate-500 text-[11px] font-medium leading-relaxed">
                   We do not show percentages. Every rebuild is optimized for structural integrity and seniority positioning.
                 </p>
              </div>
           </div>
           <div className="p-8 bg-[#16161E] border border-[#1D1D26] rounded-[2.5rem] flex items-center gap-6 shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-amber-600/10 flex items-center justify-center text-amber-500 shrink-0">
                <Zap size={24} />
              </div>
              <div>
                 <p className="text-white font-bold text-sm mb-1">Hallucination Safeguard</p>
                 <p className="text-slate-500 text-[11px] font-medium leading-relaxed">
                   Logic is deterministic. No invented experience or inflated scope. Trust is prioritized over generative fluff.
                 </p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
