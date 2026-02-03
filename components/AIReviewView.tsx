
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  UploadCloud, 
  Loader2, 
  ShieldCheck, 
  Target, 
  Lock, 
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  AlertCircle,
  Fingerprint,
  Cpu,
  BarChart3,
  Shield,
  Key,
  ShieldX,
  FileText,
  Zap,
  Building2,
  Binary
} from 'lucide-react';
import { UserPlan, DiagnosticResult, RoleTrack, BackgroundJob, JobType } from '../types';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = "https://esm.sh/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs";

interface AIReviewViewProps {
  plan: UserPlan;
  onResult: (res: DiagnosticResult) => void;
  onUpload: (text: string) => void;
  pendingResumeText: string;
  onUpgrade: () => void;
  onStartScratch: () => void;
  activeJobs: Record<string, BackgroundJob>;
  dispatchJob: (type: JobType, payload: any) => Promise<string>;
}

export function AIReviewView(props: AIReviewViewProps) {
  const { plan, onResult, onUpload, pendingResumeText, onUpgrade, activeJobs, dispatchJob } = props;

  const [step, setStep] = useState<'upload' | 'paste' | 'analyze' | 'processing' | 'quota_error'>('upload');
  const [targetRole, setTargetRole] = useState('');
  const [roleTrack, setRoleTrack] = useState<RoleTrack>('BIG_TECH');
  const [resumeText, setResumeText] = useState(pendingResumeText || '');
  const [isParsing, setIsParsing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Recovery: Find any running analysis job
  const runningJobId = useMemo(() => {
    return Object.keys(activeJobs).find(id => activeJobs[id].type === 'ANALYSIS' && activeJobs[id].status === 'RUNNING');
  }, [activeJobs]);

  useEffect(() => {
    if (runningJobId) {
      setStep('processing');
    }
  }, [runningJobId]);

  // Observer: Detect when the analysis completes
  useEffect(() => {
    if (runningJobId) {
      const job = activeJobs[runningJobId];
      if (job.status === 'COMPLETED' && job.result) {
        const data = job.result;
        const finalResult: DiagnosticResult = {
          analysisId: job.id,
          role: job.payload.targetRole,
          roleTrack: job.payload.roleTrack,
          resumeText: job.payload.resumeText,
          overallScore: data.overallScore || 50,
          foundation: {
            marketReadiness: data.marketReadinessLabel || 'Medium',
            atsShield: 'Verified',
            readability: 'High',
            strengthsSnapshot: []
          },
          eightPoints: data.eightPoints || [],
          recruiterScan: [],
          rejectionReasons: [],
          roleSaturation: 'Moderate',
          skillRadar: [],
          longevityEstimate: { status: 'Stable', reasoning: 'Standard lifecycle detected.' }
        };
        onResult(finalResult);
      } else if (job.status === 'FAILED') {
        setErrorFeedback(job.error || "Hiring Simulation failed.");
        setStep('analyze');
      }
    }
  }, [activeJobs, runningJobId, onResult]);

  useEffect(() => {
    if (pendingResumeText) {
      setResumeText(pendingResumeText);
      setStep('analyze');
    }
  }, [pendingResumeText]);

  const isStarter = plan === 'Starter';

  const handleSelectKey = async () => {
    try {
      await window.aistudio.openSelectKey();
      startAnalysis(); 
    } catch (e) {
      console.error("Key selection failed", e);
    }
  };

  async function processFile(file: File) {
    setIsParsing(true);
    setErrorFeedback(null);
    try {
      let fullText = '';
      if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n';
        }
      } else if (file.type.indexOf('word') !== -1) {
        const arrayBuffer = await file.arrayBuffer();
        const res = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
        fullText = res.value;
      } else {
        fullText = await file.text();
      }
      
      setResumeText(fullText);
      onUpload(fullText);
      setStep('analyze');
    } catch (err) {
      setErrorFeedback("Parsing sequence failed. System suggests manual text ingestion.");
    } finally {
      setIsParsing(false);
    }
  }

  async function startAnalysis() {
    if (!targetRole || !resumeText) return;
    
    const prompt = `You are a Tier-1 Hiring Committee simulation engine. 
    Analyze this resume for the role of "${targetRole}" within the "${roleTrack}" market track. 
    User Plan Level: ${isStarter ? 'BASIC_AUDIT' : 'DEEP_INTERVENTION'}.

    RULES:
    1. Provide deterministic scores (0-100).
    2. Identify 8 specific evaluation points.
    3. Focus on: Maturity & Leadership, Architectural Scope, Technical Signal, Impact Quantification, and Heuristic Alignment.

    Return a JSON object in this exact structure:
    {
      "overallScore": number,
      "foundationVerdict": "READY" | "INTERVENTION" | "HIGH RISK",
      "marketReadinessLabel": string,
      "rejectionRisk": string (e.g. "42%"),
      "coveragePercent": number,
      "eightPoints": [
        { "id": string, "name": string, "score": number, "explanation": string, "riskHint": string }
      ]
    }

    RESUME TEXT: ${resumeText}`;

    await dispatchJob('ANALYSIS', { prompt, targetRole, roleTrack, resumeText });
    setStep('processing');
  }

  if (step === 'quota_error') {
    return (
      <div className="max-w-3xl mx-auto py-24 px-10 text-center animate-in fade-in duration-500">
        <div className="w-24 h-24 bg-amber-500/10 border border-amber-500/20 rounded-[2.5rem] flex items-center justify-center mx-auto text-amber-500 mb-10">
          <Key size={48} />
        </div>
        <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-6">Quota Exhausted</h2>
        <p className="text-slate-400 text-lg font-medium leading-relaxed mb-12">
          High-fidelity analysis has reached its operational limit on the shared environment key. To proceed with priority screening, authenticate with a private API key.
        </p>
        <div className="space-y-6">
          <button 
            onClick={handleSelectKey}
            className="px-12 py-6 bg-blue-600 text-white font-black rounded-2xl uppercase tracking-[0.2em] text-xs hover:bg-blue-500 transition-all shadow-2xl shadow-blue-900/40 w-full md:w-auto"
          >
            Authenticate Private Key
          </button>
          <button 
            onClick={() => setStep('analyze')}
            className="text-slate-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest pt-8 block mx-auto"
          >
            Cancel and Return
          </button>
        </div>
      </div>
    );
  }

  if (step === 'upload') {
    return (
      <div className="max-w-5xl mx-auto py-12 px-6 animate-in fade-in duration-500">
        <div className="mb-12">
          <h2 className="text-4xl font-bold text-white mb-2 uppercase tracking-tight">System Initialization</h2>
          <p className="text-slate-400 font-medium">Provide a professional document for structural calibration.</p>
        </div>

        <div className="space-y-8">
          <div 
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files ? e.dataTransfer.files[0] : null; if(f) processFile(f); }}
            onClick={() => fileInputRef.current?.click()}
            className={"border-2 border-dashed rounded-[3rem] p-24 flex flex-col items-center justify-center cursor-pointer transition-all group " + (isDragging ? 'border-blue-500 bg-blue-500/10 scale-[1.01]' : 'border-[#1D1D26] hover:bg-white/5')}
          >
            {isParsing ? <Loader2 className="animate-spin text-blue-500 mb-4" /> : <UploadCloud size={64} className={(isDragging ? 'text-blue-500' : 'text-slate-500 group-hover:text-blue-500') + " mb-6 transition-colors"} />}
            <p className="text-white font-bold text-2xl uppercase tracking-tighter">{isDragging ? 'Release Fragment' : 'Upload Resume'}</p>
            <p className="text-slate-500 text-xs mt-3 uppercase tracking-widest font-black opacity-60">System supports .PDF, .DOCX, .TXT</p>
            <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => { if(e.target.files && e.target.files[0]) processFile(e.target.files[0]); }} />
          </div>

          <div className="flex items-center gap-6 p-8 bg-[#16161E] border border-[#1D1D26] rounded-3xl">
            <div className="flex-1">
              <p className="text-white font-bold mb-1 uppercase text-xs tracking-widest">Direct Input</p>
              <p className="text-slate-500 text-xs font-medium">Initialize system using pasted text fragments.</p>
            </div>
            <button 
              onClick={() => setStep('paste')}
              className="px-6 py-3 bg-[#1A1D26] border border-[#2D313D] text-slate-300 rounded-xl text-xs font-black uppercase tracking-widest hover:text-white transition-all"
            >
              Paste Text
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'paste') {
    return (
      <div className="max-w-4xl mx-auto py-12 px-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="mb-12 flex items-center gap-4">
          <button onClick={() => setStep('upload')} className="text-slate-500 hover:text-white transition-colors">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h2 className="text-4xl font-bold text-white mb-2 uppercase tracking-tight">Manual Ingestion</h2>
            <p className="text-slate-400 font-medium">Paste your raw resume content below to continue.</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-[#16161E] border border-[#1D1D26] rounded-[2.5rem] p-8 shadow-2xl">
            <textarea 
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder="Paste resume text here..."
              className="w-full bg-[#0D0D12] border border-[#2D313D] rounded-2xl p-6 text-white h-96 resize-none outline-none focus:border-blue-500 transition-all font-mono text-sm leading-relaxed"
            />
          </div>
          <button 
            disabled={!resumeText.trim()}
            onClick={() => setStep('analyze')}
            className="w-full bg-blue-600 hover:bg-blue-50 text-white font-black py-6 rounded-3xl flex items-center justify-center gap-4 transition-all disabled:opacity-30 uppercase tracking-[0.2em] text-xs shadow-2xl"
          >
            Confirm Ingestion <ArrowRight size={20} />
          </button>
        </div>
      </div>
    );
  }

  if (step === 'analyze') {
    return (
      <div className="max-w-6xl mx-auto py-12 px-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="mb-12 flex items-center gap-4">
          <button onClick={() => setStep(resumeText ? 'paste' : 'upload')} className="text-slate-500 hover:text-white transition-colors">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h2 className="text-4xl font-bold text-white mb-2 uppercase tracking-tight">Calibration Parameters</h2>
            <p className="text-slate-400 font-medium">Configure the judgment committee heuristics for specific market signals.</p>
          </div>
        </div>

        <div className="space-y-10">
          <div className="bg-[#16161E] border border-[#1D1D26] rounded-[2.5rem] p-10 space-y-12 shadow-2xl">
            {errorFeedback && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500 text-xs font-bold animate-in shake duration-300">
                <AlertCircle size={16} />
                <span>{errorFeedback}</span>
              </div>
            )}
            
            <div className="space-y-6">
              <div className="flex items-center gap-3 px-1">
                 <Shield className="text-blue-500" size={16} />
                 <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em]">
                   Judgment Committee Profile (Market Context)
                 </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {[
                   { id: 'BIG_TECH', label: 'Big Tech / FAANG', desc: 'Standard Tier-1 algorithmic & scale filters.', icon: <Building2 size={20} /> },
                   { id: 'STARTUP_ENG', label: 'Growth Startup', desc: 'Prioritizes velocity, 0-1 metrics, and generalist depth.', icon: <Zap size={20} /> },
                   { id: 'AI_PRODUCTION', label: 'AI/ML Engineering', desc: 'Focuses on model lifecycle, RAG, and compute infra.', icon: <Cpu size={20} /> },
                   { id: 'RESEARCH_ACADEMIC', label: 'AI Research / PhD', desc: 'Evaluates publications, core math, and theoretical novelties.', icon: <Binary size={20} /> },
                   { id: 'FINTECH_INFRA', label: 'High-Scale Systems', desc: 'Prioritizes latency, availability, and mission-critical safety.', icon: <Fingerprint size={20} /> }
                 ].map((track) => (
                   <button 
                    key={track.id}
                    type="button"
                    onClick={() => setRoleTrack(track.id as RoleTrack)}
                    className={"flex flex-col gap-4 p-6 rounded-2xl border transition-all text-left group " + (roleTrack === track.id ? 'bg-blue-600/10 border-blue-500 shadow-lg' : 'bg-[#0D0D12] border-[#2D313D] hover:border-slate-700')}
                   >
                     <div className="flex items-center justify-between w-full">
                       <div className={roleTrack === track.id ? 'text-blue-500' : 'text-slate-500 group-hover:text-slate-400'}>
                         {track.icon}
                       </div>
                       {roleTrack === track.id && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
                     </div>
                     <div>
                       <span className={"text-xs font-black uppercase tracking-widest block mb-1 " + (roleTrack === track.id ? 'text-white' : 'text-slate-400')}>{track.label}</span>
                       <p className="text-[10px] text-slate-600 font-medium leading-relaxed">{track.desc}</p>
                     </div>
                   </button>
                 ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 px-1">
                 <Target className="text-blue-500" size={16} />
                 <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em]">
                   Target Role Designation
                 </label>
              </div>
              <div className="relative group">
                <input 
                  type="text" 
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="e.g. Senior Machine Learning Engineer"
                  className="w-full bg-[#0D0D12] border border-[#2D313D] rounded-2xl p-6 text-white outline-none focus:border-blue-500 text-xl font-bold transition-all placeholder:opacity-10 pl-14"
                />
                <Target size={20} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-700 group-focus-within:text-blue-500 transition-colors" />
              </div>
            </div>
          </div>

          <button 
            type="button"
            onClick={() => startAnalysis()}
            disabled={!targetRole || !resumeText || isParsing}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-8 rounded-3xl flex items-center justify-center gap-4 transition-all disabled:opacity-30 uppercase tracking-[0.3em] text-sm shadow-2xl shadow-blue-900/30 group"
          >
            Run Hiring Safety Check <ArrowRight size={24} className="group-hover:translate-x-2 transition-transform" />
          </button>
        </div>
      </div>
    );
  }

  if (step === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-10">
        <Loader2 size={80} className="text-blue-500 animate-spin" strokeWidth={1.5} />
        <div className="text-center space-y-4">
          <h3 className="text-3xl font-black text-white uppercase tracking-tight">Hiring Committee Simulation</h3>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">Evaluating signal fidelity for {targetRole}</p>
          <p className="text-slate-600 text-xs font-medium uppercase tracking-[0.2em]">Execution continuing in background...</p>
        </div>
      </div>
    );
  }

  return null;
}
