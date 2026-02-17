
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Sparkles,
  UploadCloud,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Zap,
  FileText,
  Key,
  ShieldX,
  Target,
  Shield,
  Building2,
  Cpu,
  Binary,
  Fingerprint,
  CheckCircle2,
  FileText as FileIcon,
  Download,
  Save,
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Link as LinkIcon,
  AlertCircle
} from 'lucide-react';
import { UserPlan, StructuredResume, ResumeGroup, RoleTrack, BackgroundJob, JobType } from '../types';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs`;

interface RebuildStandaloneViewProps {
  plan: UserPlan;
  credits: number;
  setCredits: (c: number) => void;
  onRebuildSuccess: (rebuilt: StructuredResume, versionId?: string, label?: string, groupId?: string) => void;
  onUpgrade: () => void;
  history: ResumeGroup[];
  preFilledContext?: { text: string; role: string; track: RoleTrack; gate?: 'SAFE' | 'BORDERLINE' | 'LOCKED' } | null;
  activeJobs: Record<string, BackgroundJob>;
  dispatchJob: (type: JobType, payload: any) => Promise<string>;
}

const StructuredResumePreview: React.FC<{ resume: StructuredResume }> = ({ resume }) => (
  <div className="bg-white text-slate-900 p-12 shadow-inner min-h-full font-serif" id="rebuild-preview-target">
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
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  </div>
);

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
    <button onClick={onBuy} className="w-full bg-blue-600 hover:bg-blue-50 text-white font-black py-4 rounded-2xl transition-all uppercase tracking-widest text-[11px] shadow-lg shadow-blue-900/20">
      Buy & Start Rebuild
    </button>
  </div>
);

export const RebuildStandaloneView: React.FC<RebuildStandaloneViewProps> = ({ plan, credits, setCredits, onRebuildSuccess, onUpgrade, history, preFilledContext, activeJobs, dispatchJob }) => {
  const [step, setStep] = useState<'marketing' | 'form' | 'processing' | 'result' | 'quota_error'>('form');
  const [loading, setLoading] = useState(false);
  const [resumeText, setResumeText] = useState('');
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const [isParsing, setIsParsing] = useState(false);
  const [roleTrack, setRoleTrack] = useState<RoleTrack>('BIG_TECH');
  const [rebuiltResume, setRebuiltResume] = useState<StructuredResume | null>(null);
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null);
  const [finalMeta, setFinalMeta] = useState({ role: '', label: '' });
  const [gateState, setGateState] = useState<'SAFE' | 'BORDERLINE' | 'LOCKED' | undefined>(undefined);
  const [createdIds, setCreatedIds] = useState<{ groupId: string; versionId: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    role: '',
    industry: ''
  });

  // Background Job Logic: Specific ID tracking (REL-010)
  const [trackingJobId, setTrackingJobId] = useState<string | null>(null);

  useEffect(() => {
    // SECURE: Re-hydrate tracking on mount
    const activeJob = Object.values(activeJobs).find(j => j.type === 'REBUILD' && j.status === 'RUNNING');
    if (activeJob && !trackingJobId) {
      setTrackingJobId(activeJob.id);
      setStep('processing');
      if (activeJob.payload?.role) {
        setFormData(prev => ({ ...prev, role: activeJob.payload.role }));
      }
    }
  }, []);

  useEffect(() => {
    if (!trackingJobId) return;
    const job = activeJobs[trackingJobId];

    if (job) {
      if (job.status === 'RUNNING') {
        setStep('processing');
      } else if (job.status === 'COMPLETED' && job.result) {
        const result = job.result;
        const extractedResume = result.data || result.newResume || result.resume || result;

        if (extractedResume && (extractedResume.contact || extractedResume.full_name)) {
          // Normalize structure if coming from direct version result
          const finalResume = extractedResume.contact ? extractedResume : {
            contact: { full_name: extractedResume.full_name, email: extractedResume.email, phone: extractedResume.phone, location: extractedResume.location, links: extractedResume.links || [] },
            summary: extractedResume.summary,
            experience: extractedResume.experience || [],
            education: extractedResume.education || [],
            projects: extractedResume.projects || [],
            skills: extractedResume.skills || { languages: [], frameworks: [], tools: [], specializations: [] },
            leadership: extractedResume.leadership || []
          };

          setRebuiltResume(finalResume as StructuredResume);
          setCreatedIds(result.id ? { groupId: result.resume_id, versionId: result.id } : null);
          setFinalMeta({
            role: job.payload?.role || formData.role || "Professional",
            label: `${job.payload?.role || "Rebuild"} @ ${job.payload?.roleTrack || roleTrack}`
          });
          setStep('result');
          setTrackingJobId(null);
        } else {
          console.error("Malformed rebuild result:", result);
          setErrorFeedback("The AI returned an invalid resume format. Please try again.");
          setStep('form');
          setTrackingJobId(null);
        }
      } else if (job.status === 'FAILED') {
        setErrorFeedback(job.error || "Resume reconstruction failed.");
        setStep('form');
        setTrackingJobId(null);
      }
    }
  }, [activeJobs, trackingJobId]);

  useEffect(() => {
    if (preFilledContext) {
      setResumeText(preFilledContext.text);
      setFormData({ role: preFilledContext.role, industry: '' });
      setRoleTrack(preFilledContext.track);
      setGateState(preFilledContext.gate);
      if (preFilledContext.text && preFilledContext.role && !trackingJobId) {
        startRebuild(preFilledContext.text, preFilledContext.role, preFilledContext.track, preFilledContext.gate);
      }
    }
  }, [preFilledContext]);

  const isStarter = plan === 'Starter';
  const hasUnlimited = plan !== 'Starter';
  const activeStep = (isStarter && credits <= 0 && step !== 'marketing' && step !== 'quota_error' && step !== 'result' && step !== 'processing') ? 'marketing' : step;

  const recentResumes = history.slice(0, 5);

  const handleSelectKey = async () => {
    try {
      await window.aistudio.openSelectKey();
      startRebuild();
    } catch (e) {
      console.error("Key selection failed", e);
    }
  };

  const handleBuy = (amount: number) => {
    setCredits(credits + amount);
    setStep('form');
  };

  const selectSavedResume = (group: ResumeGroup) => {
    const version = group.versions.find(v => v.type === 'original') || group.versions[0];
    if (version && version.data) {
      const contact = version.data.contact || {};
      const exp = (version.data.experience || []).map((e: any) => `${e.title} at ${e.organization}: ${e.bullets?.join(' ')}`).join('\n');
      const text = `${contact.full_name || ''}\n${version.data.summary || ''}\n${exp}`;
      setResumeText(text);
      setSelectedResumeId(group.id);
    }
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

  const startRebuild = async (overrideText?: string, overrideRole?: string, overrideTrack?: RoleTrack, overrideGate?: 'SAFE' | 'BORDERLINE' | 'LOCKED') => {
    const textToUse = overrideText || resumeText;
    const roleToUse = overrideRole || formData.role;
    const trackToUse = overrideTrack || roleTrack;
    const gateToUse = overrideGate || gateState || 'SAFE';

    if (!textToUse || !roleToUse) return;
    setErrorFeedback(null);
    setStep('processing');

    const prompt = `Architect a market-aligned resume for the "${trackToUse}" judgment track.
    TARGET ROLE: ${roleToUse}
    SOURCE CONTENT: ${textToUse}
    ELIGIBILITY GATE: ${gateToUse}
    
    RULES:
    1. Deterministic rebuild. 
    2. No hallucination. 
    3. Improve signal density for ${trackToUse} heuristics.
    4. MANDATORY CONSTRAINT - ELIGIBILITY GATE BOUNDARY:
       - The output MUST NOT exceed the seniority, scope, or authority permitted by the "${gateToUse}" Eligibility Gate.
       - If gate is "LOCKED": Operate in "signal repair mode". Do NOT make the resume appear application-ready. Do NOT inject senior architectural ownership, leadership authority, expert-level claims, or FAANG-ready framing.
       - If gate is "BORDERLINE": Improve clarity and signal strength, but remain conservative in scope. Do NOT over-project seniority.
       - If gate is "SAFE": Full rebuild behavior and seniority optimization allowed.

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

    const jobId = await dispatchJob('REBUILD', { role: roleToUse, roleTrack: trackToUse, sourceText: textToUse });
    setTrackingJobId(jobId);
  };

  const handleCommit = () => {
    if (rebuiltResume) {
      if (!hasUnlimited && !preFilledContext) setCredits(Math.max(0, credits - 1));
      onRebuildSuccess(rebuiltResume, createdIds?.versionId || "", finalMeta.label, createdIds?.groupId);
    }
  };

  const handleDownload = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const content = document.getElementById('rebuild-preview-target')?.outerHTML;
      const resumeName = rebuiltResume?.contact.full_name || 'Resume';
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
                #rebuild-preview-target { box-shadow: none !important; width: 100% !important; }
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

  if (activeStep === 'quota_error') {
    return (
      <div className="max-w-3xl mx-auto py-24 px-10 text-center animate-in fade-in zoom-in duration-500">
        <div className="relative mb-12 flex justify-center">
          <div className="absolute inset-0 bg-blue-500/20 blur-[80px] rounded-full mx-auto w-32 h-32" />
          <div className="w-24 h-24 bg-blue-600/10 border border-blue-500/20 rounded-[2.5rem] flex items-center justify-center relative z-10 text-blue-500">
            <Key size={48} strokeWidth={1.5} />
          </div>
        </div>
        <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-6 leading-none">Authorization Required</h2>
        <p className="text-slate-400 text-lg font-medium leading-relaxed mb-12 italic">
          High-fidelity AI Architecting and specialized judgment track calibration are exclusive to **Elite Tier** members.
        </p>
        <div className="flex flex-col items-center gap-6">
          <button
            onClick={onUpgrade}
            className="px-12 py-6 bg-blue-600 text-white font-black rounded-2xl uppercase tracking-[0.2em] text-xs hover:bg-blue-500 transition-all shadow-2xl shadow-blue-900/40 w-full md:w-auto flex items-center gap-3 group"
          >
            Authorize Elite Access <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
          <button
            onClick={() => setStep('form')}
            className="text-slate-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest pt-4"
          >
            Return to Editor
          </button>
        </div>
      </div>
    );
  }

  if (activeStep === 'marketing') {
    return (
      <div className="max-w-6xl mx-auto py-24 px-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          <BundleCard count={1} price="$19" total="$19" onBuy={() => handleBuy(1)} />
          <BundleCard count={3} price="$15" total="$45" onBuy={() => handleBuy(3)} popular />
          <BundleCard count={5} price="$12" total="$60" onBuy={() => handleBuy(5)} />
        </div>
      </div>
    );
  }

  if (activeStep === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-10">
        <Loader2 size={80} className="text-blue-500 animate-spin" strokeWidth={1.5} />
        <h3 className="text-3xl font-black text-white uppercase tracking-tight">Re-Architecting Profile</h3>
        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Execution continues in background...</p>
      </div>
    );
  }

  if (activeStep === 'result' && rebuiltResume) {
    return (
      <div className="max-w-[1200px] mx-auto py-12 px-10 animate-in fade-in duration-700">
        <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-8">
          <div>
            <div className="flex items-center gap-3 text-green-400 mb-4 bg-green-400/5 w-fit px-4 py-1 rounded-full border border-green-400/10">
              <CheckCircle2 size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">Rebuild Result Generated</span>
            </div>
            <h2 className="text-5xl font-black text-white tracking-tighter uppercase leading-none">Architect Preview</h2>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleDownload}
              className="bg-[#16161E] border border-[#2D313D] text-white font-black py-4 px-8 rounded-2xl shadow-xl hover:bg-[#1A1D26] transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-[10px]"
            >
              <Download size={16} /> Download PDF
            </button>
            <button
              onClick={handleCommit}
              className="bg-blue-600 text-white font-black py-4 px-10 rounded-2xl shadow-xl hover:bg-blue-500 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-[10px]"
            >
              <Save size={16} /> Save to History
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-8 bg-[#16161E] border border-blue-500/20 rounded-[3rem] overflow-hidden shadow-2xl h-[800px]">
            <div className="h-full overflow-y-auto custom-scrollbar">
              <StructuredResumePreview resume={rebuiltResume} />
            </div>
          </div>
          <div className="lg:col-span-4 space-y-8">
            <div className="bg-[#111118] border border-[#2D313D] p-10 rounded-[2.5rem]">
              <h4 className="text-white font-black uppercase text-xs tracking-widest mb-6">Execution Summary</h4>
              <div className="space-y-6">
                <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Assigned Role</p>
                  <p className="text-white font-bold">{finalMeta.role}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Target Context</p>
                  <p className="text-white font-bold">{roleTrack.replace('_', ' ')}</p>
                </div>
                {gateState && (
                  <div>
                    <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Eligibility Boundary</p>
                    <p className={`font-black uppercase text-sm ${gateState === 'SAFE' ? 'text-green-500' : gateState === 'BORDERLINE' ? 'text-amber-500' : 'text-red-500'}`}>
                      {gateState}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setStep('form')}
              className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest"
            >
              <ArrowLeft size={14} /> Back to Parameters
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto py-16 px-10 animate-in fade-in duration-700">
      <div className="mb-12">
        <h2 className="text-5xl font-black text-white tracking-tighter uppercase leading-none mb-4">Resume Rebuild</h2>
        <p className="text-slate-400 text-lg font-medium leading-relaxed max-w-2xl">
          Structurally re-architect your professional signal for specific judgment committee tracks.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8 space-y-10">

          {/* Saved Resumes Selection */}
          {recentResumes.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 px-1">
                <FileIcon className="text-blue-500" size={16} />
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em]">
                  Select Saved Resume Source (Last 5)
                </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recentResumes.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => selectSavedResume(r)}
                    className={`flex items-center gap-4 p-5 rounded-2xl border transition-all text-left ${selectedResumeId === r.id ? 'bg-blue-600/10 border-blue-500' : 'bg-[#16161E] border-[#1D1D26] hover:border-slate-700'}`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedResumeId === r.id ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                      <FileIcon size={18} />
                    </div>
                    <div className="flex-1 truncate">
                      <p className="text-white font-bold text-xs truncate uppercase tracking-widest">{r.name}</p>
                      <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mt-1">
                        {new Date(r.versions[0].createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {selectedResumeId === r.id && <CheckCircle2 size={16} className="text-blue-500" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {errorFeedback && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-[2.5rem] p-8 mb-8 flex items-start gap-6 animate-in fade-in slide-in-from-top-4">
              <AlertCircle className="w-8 h-8 text-red-500 mt-1 shrink-0" />
              <div>
                <p className="text-red-400 font-black uppercase text-xs tracking-widest">Rebuild Failure</p>
                <p className="text-red-300/70 text-sm mt-2 font-medium leading-relaxed">{errorFeedback}</p>
              </div>
            </div>
          )}

          <div className="bg-[#16161E] border border-[#1D1D26] rounded-[2.5rem] p-10 space-y-12 shadow-2xl">

            {/* Track Selection (Same as Intelligence Page) */}
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

            <div className="space-y-6">
              <div className="flex items-center gap-3 px-1">
                <Target size={16} className="text-blue-500" />
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em]">
                  Target Role Designation
                </label>
              </div>
              <div className="relative group">
                <input
                  type="text"
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                  placeholder="e.g. Senior Machine Learning Engineer"
                  className="w-full bg-[#0D0D12] border border-[#2D313D] rounded-2xl p-6 text-white outline-none focus:border-blue-500 text-xl font-bold transition-all placeholder:opacity-10 pl-14"
                />
                <Target size={20} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-700 group-focus-within:text-blue-500 transition-colors" />
              </div>
            </div>

            <div className="pt-6 border-t border-white/5">
              <button onClick={() => fileInputRef.current?.click()} className="w-full py-10 rounded-3xl border-2 border-dashed bg-[#0D0D12] border-[#1D1D26] text-slate-500 hover:border-blue-500 transition-all flex flex-col items-center justify-center gap-4 group">
                <UploadCloud size={32} className="group-hover:text-blue-500 transition-colors" />
                <div className="text-center">
                  <span className="text-[11px] font-black uppercase tracking-[0.3em] block mb-1">Upload New Source</span>
                  <p className="text-[9px] font-bold text-slate-700 uppercase tracking-widest">Replaces selected saved resume</p>
                </div>
                <input type="file" ref={fileInputRef} className="hidden" onChange={e => e.target.files?.[0] && processFile(e.target.files[0])} />
              </button>
            </div>
          </div>

          <button
            onClick={() => startRebuild()}
            disabled={!resumeText || !formData.role || loading}
            className="w-full bg-blue-600 hover:bg-blue-50 text-white font-black py-8 rounded-3xl transition-all uppercase tracking-[0.3em] text-sm shadow-2xl shadow-blue-900/30 flex items-center justify-center gap-4 disabled:opacity-50 group"
          >
            {loading ? <Loader2 className="animate-spin" /> : <><Sparkles size={24} className="group-hover:rotate-12 transition-transform" /> Execute Rebuild Pipeline</>}
          </button>
        </div>

        <div className="lg:col-span-4 space-y-8">
          <div className="bg-[#16161E] border border-[#1D1D26] p-10 rounded-[2.5rem] shadow-xl">
            <h4 className="text-white font-black uppercase tracking-tight text-xs tracking-[0.2em] mb-6">Engine Logic</h4>
            <div className="space-y-6">
              {[
                { t: "Fidelity Check", d: "Verification of artifact sources against claims." },
                { t: "Track Calibration", d: "Applying track-specific heuristic weighting." },
                { t: "ATS Shielding", d: "Guaranteeing standard machine parseability." }
              ].map((item, i) => (
                <div key={i} className="flex gap-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                  <div>
                    <p className="text-white font-bold text-xs uppercase tracking-widest">{item.t}</p>
                    <p className="text-slate-500 text-[10px] font-medium leading-relaxed mt-1">{item.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-10 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <ShieldCheck size={140} />
            </div>
            <div className="relative z-10 space-y-4">
              <h4 className="text-xl font-black uppercase tracking-tight leading-none">Safe to Execute</h4>
              <p className="text-blue-100 text-xs font-medium leading-relaxed opacity-90">
                Our system maintains the truth of your experience while optimizing for the "Committee Signal" recruiters look for.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
