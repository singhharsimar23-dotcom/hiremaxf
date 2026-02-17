
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

pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

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

  // Persistence: Re-attach to running analysis on mount
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  // Persistence: Re-attach to running analysis on mount
  useEffect(() => {
    const runningJob = Object.values(activeJobs).find(j => j.type === 'ANALYSIS' && j.status === 'RUNNING');
    if (runningJob) {
      setCurrentJobId(runningJob.id);
      setStep('processing');
      setTargetRole(runningJob.payload.targetRole);
    }
  }, []);

  // Observer: Detect when analysis completes
  useEffect(() => {
    const job = currentJobId ? activeJobs[currentJobId] : null;

    if (job) {
      if (job.status === 'RUNNING') {
        setStep('processing');
      } else if (job.status === 'COMPLETED' && job.result) {
        const data = job.result;
        const finalResult: DiagnosticResult = {
          analysisId: data.analysisId || job.id,
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
        setErrorFeedback(job.error || "Simulation failed.");
        if (step === 'processing') setStep('analyze');
      }
    }
  }, [activeJobs, currentJobId, onResult, step]);

  useEffect(() => {
    if (pendingResumeText) {
      setResumeText(pendingResumeText);
      setStep('analyze');
    }
  }, [pendingResumeText]);

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
      setErrorFeedback("Parsing sequence failed.");
    } finally {
      setIsParsing(false);
    }
  }

  async function startAnalysis() {
    if (!targetRole || !resumeText) return;

    const prompt = `Analyze this resume for the role of "${targetRole}" within the "${roleTrack}" market track.
    Return a JSON object in this exact structure:
    {
      "overallScore": number,
      "marketReadinessLabel": string,
      "eightPoints": [
        { "id": string, "name": string, "score": number, "explanation": string, "riskHint": string }
      ]
    }
    RESUME TEXT: ${resumeText}`;

    const id = await dispatchJob('ANALYSIS', { targetRole, roleTrack, resumeText });
    setCurrentJobId(id);
    setStep('processing');
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
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files ? e.dataTransfer.files[0] : null; if (f) processFile(f); }}
            onClick={() => fileInputRef.current?.click()}
            className={"border-2 border-dashed rounded-[3rem] p-24 flex flex-col items-center justify-center cursor-pointer transition-all group " + (isDragging ? 'border-blue-500 bg-blue-500/10 scale-[1.01]' : 'border-[#1D1D26] hover:bg-white/5')}
          >
            {isParsing ? <Loader2 className="animate-spin text-blue-500 mb-4" /> : <UploadCloud size={64} className={(isDragging ? 'text-blue-500' : 'text-slate-500 group-hover:text-blue-500') + " mb-6 transition-colors"} />}
            <p className="text-white font-bold text-2xl uppercase tracking-tighter">{isDragging ? 'Release Fragment' : 'Upload Resume'}</p>
            <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => { if (e.target.files && e.target.files[0]) processFile(e.target.files[0]); }} />
          </div>
          <div className="flex justify-center">
            <button onClick={() => setStep('paste')} className="text-blue-500 font-black text-[10px] uppercase tracking-widest border border-blue-500/20 px-8 py-3 rounded-xl hover:bg-blue-500 hover:text-white transition-all">Or Paste Raw Text</button>
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
          </div>
        </div>
        <textarea
          value={resumeText}
          onChange={(e) => setResumeText(e.target.value)}
          placeholder="Paste resume text here..."
          className="w-full bg-[#0D0D12] border border-[#2D313D] rounded-2xl p-6 text-white h-96 resize-none outline-none focus:border-blue-500 transition-all font-mono text-sm leading-relaxed"
        />
        <button
          disabled={!resumeText.trim()}
          onClick={() => setStep('analyze')}
          className="w-full mt-6 bg-blue-600 hover:bg-blue-50 text-white font-black py-6 rounded-3xl flex items-center justify-center gap-4 transition-all disabled:opacity-30 uppercase tracking-[0.2em] text-xs"
        >
          Confirm Ingestion <ArrowRight size={20} />
        </button>
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
            <h2 className="text-4xl font-bold text-white mb-2 uppercase tracking-tight">Calibration</h2>
            <p className="text-slate-400 font-medium">Configure parameters for specific market signals.</p>
          </div>
        </div>

        <div className="bg-[#16161E] border border-[#1D1D26] rounded-[2.5rem] p-10 space-y-12 shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { id: 'BIG_TECH', label: 'Big Tech / FAANG', desc: 'Scale filters.', icon: <Building2 size={20} /> },
              { id: 'STARTUP_ENG', label: 'Growth Startup', desc: 'Velocity signals.', icon: <Zap size={20} /> },
              { id: 'AI_PRODUCTION', label: 'AI/ML Engineering', desc: 'Model lifecycle.', icon: <Cpu size={20} /> }
            ].map((track) => (
              <button
                key={track.id}
                onClick={() => setRoleTrack(track.id as RoleTrack)}
                className={"flex flex-col gap-4 p-6 rounded-2xl border transition-all text-left " + (roleTrack === track.id ? 'bg-blue-600/10 border-blue-500 shadow-lg' : 'bg-[#0D0D12] border-[#2D313D] hover:border-slate-700')}
              >
                <span className={"text-xs font-black uppercase tracking-widest block mb-1 " + (roleTrack === track.id ? 'text-white' : 'text-slate-400')}>{track.label}</span>
                <p className="text-[10px] text-slate-600 font-medium leading-relaxed">{track.desc}</p>
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em]">Target Role Designation</label>
            <input
              type="text"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="e.g. Senior Machine Learning Engineer"
              className="w-full bg-[#0D0D12] border border-[#2D313D] rounded-2xl p-6 text-white outline-none focus:border-blue-500 text-xl font-bold transition-all"
            />
          </div>

          {errorFeedback && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <AlertTriangle className="text-red-500 shrink-0" size={20} />
              <p className="text-red-400 text-xs font-bold">{errorFeedback}</p>
            </div>
          )}

          <button
            type="button"
            onClick={() => startAnalysis()}
            disabled={!targetRole || !resumeText}
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
          <p className="text-slate-600 text-[10px] font-black uppercase tracking-[0.4em] animate-pulse">Running in background • Safe to navigate away</p>
        </div>
      </div>
    );
  }

  return null;
}
