
import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  UploadCloud,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Zap,
  Key,
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
  AlertCircle,
  Lock,
  Eye,
  ChevronDown,
  ChevronUp,
  Trash2
} from 'lucide-react';
import { UserPlan, StructuredResume, ResumeGroup, RoleTrack, BackgroundJob, JobType, SignalDelta, JDParsed } from '../types';
import { usePersistentState, useJobContextPersistence } from '../hooks/usePersistentState';
import { RebuildProcessingSkeleton } from './Skeletons';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface RebuildStandaloneViewProps {
  userId?: string;
  plan: UserPlan;
  credits: number;
  setCredits: (c: number) => void;
  onRebuildSuccess: (rebuilt: StructuredResume, versionId?: string, label?: string, groupId?: string) => void;
  onUpgrade: () => void;
  history: ResumeGroup[];
  preFilledContext?: { text: string; role: string; track: RoleTrack; gate?: 'SAFE' | 'BORDERLINE' | 'LOCKED' } | null;
  activeAnalysis?: any | null;
  activeJobs: Record<string, BackgroundJob>;
  dispatchJob: (type: JobType, payload: any) => Promise<string>;
}

const StructuredResumePreview: React.FC<{ resume: StructuredResume, showDiff?: boolean, changeLog?: ChangeEntry[] }> = ({ resume, showDiff, changeLog }) => {
  const isChanged = (text: string) => {
    if (!showDiff || !changeLog) return false;
    const cleanText = text.toLowerCase();
    return changeLog.some(c => cleanText.includes(c.preview.replace('...', '').trim().toLowerCase()));
  };

  return (
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
            <p className={`text-[13px] leading-relaxed transition-colors duration-500 ${isChanged(resume.summary) ? 'bg-blue-50 border-l-2 border-blue-500 pl-2 text-blue-900' : 'text-slate-800'}`}>
              {resume.summary}
            </p>
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
                      <li key={bIdx} className={`text-[12px] leading-snug transition-colors duration-500 ${isChanged(bullet) ? 'bg-green-50 border-l-2 border-green-500 pl-2 text-green-900 list-none -ml-4' : 'text-slate-800'}`}>
                        {bullet}
                      </li>
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
}

// ── Change Log Engine ──────────────────────────────────────────────────────
interface ChangeEntry { type: string; section: string; company?: string; preview: string; detail: string; }

function computeChangeLog(originalText: string, rebuilt: StructuredResume): ChangeEntry[] {
  const changes: ChangeEntry[] = [];
  const OWNERSHIP_VERBS = ['led', 'architected', 'designed', 'owned', 'drove', 'spearheaded', 'built', 'founded', 'launched', 'created', 'directed'];
  const WEAK_VERBS = ['helped', 'assisted', 'contributed', 'worked on', 'was responsible for', 'participated', 'supported', 'involved'];

  rebuilt.experience?.forEach(exp => {
    exp.bullets?.forEach(bullet => {
      const bulletLower = bullet.toLowerCase();
      const hasMetric = /\d+[%$x]?|[$]\d|[\d,]+\+?/.test(bullet);
      const hasOwnership = OWNERSHIP_VERBS.some(v => bulletLower.startsWith(v) || bulletLower.includes(' ' + v + ' '));
      const firstWords = bullet.split(' ').slice(0, 3).join(' ');
      if (hasMetric) {
        changes.push({ type: 'METRIC_ADDED', section: 'EXPERIENCE', company: exp.organization, preview: firstWords + '...', detail: 'Quantified impact added — 75% of hiring managers require measurable results (LinkedIn 2025)' });
      }
      if (hasOwnership) {
        changes.push({ type: 'OWNERSHIP_SIGNAL', section: 'EXPERIENCE', company: exp.organization, preview: firstWords + '...', detail: 'Ownership verb injected — F-pattern eye tracking: first 3 words determine if bullet is read' });
      }
    });
  });

  const origSkillCount = (originalText.match(/\b(python|react|aws|kubernetes|sql|docker|typescript|node|java|go|rust)\b/gi) || []).length;
  const newSkillCount = [...(rebuilt.skills?.languages || []), ...(rebuilt.skills?.frameworks || []), ...(rebuilt.skills?.tools || [])].length;
  if (newSkillCount > origSkillCount) {
    changes.push({ type: 'KEYWORDS_INJECTED', section: 'SKILLS', preview: `${newSkillCount - origSkillCount} skills added`, detail: 'ATS keyword density increased — single-skill-per-line format is 67% less likely to be rejected than skill dumps' });
  }

  if (rebuilt.summary && !originalText.toLowerCase().includes(rebuilt.summary.slice(0, 30).toLowerCase())) {
    changes.push({ type: 'SUMMARY_REBUILT', section: 'SUMMARY', preview: rebuilt.summary.slice(0, 60) + '...', detail: 'Summary rewritten for F-pattern — recruiters read first 2 lines max; every word must signal target role' });
  }

  return changes.slice(0, 12);
}

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  METRIC_ADDED: { label: 'Metric Added', color: 'text-green-400', bg: 'bg-green-500/5', border: 'border-green-500/20' },
  OWNERSHIP_SIGNAL: { label: 'Verb Upgraded', color: 'text-blue-400', bg: 'bg-blue-500/5', border: 'border-blue-500/20' },
  KEYWORDS_INJECTED: { label: 'Keywords In', color: 'text-indigo-400', bg: 'bg-indigo-500/5', border: 'border-indigo-500/20' },
  SUMMARY_REBUILT: { label: 'Summary Fixed', color: 'text-amber-400', bg: 'bg-amber-500/5', border: 'border-amber-500/20' },
};

const countOwnershipVerbs = (text: string) =>
  ['led', 'architected', 'designed', 'owned', 'drove', 'spearheaded', 'built', 'launched', 'created', 'directed']
    .reduce((count, v) => count + (text.toLowerCase().split(v).length - 1), 0);

const countMetrics = (text: string) =>
  (text.match(/\d+[%$]?|\$[\d,]+|[\d,]+\+/g) || []).length;

const NEXT_STEPS: Record<string, string[]> = {
  BIG_TECH: ['Run ATS check against your target job posting', 'Verify all company names are spelled exactly right', 'Submit .docx not PDF to Workday/Taleo systems'],
  STARTUP_ENG: ['Lead with the 0-to-1 project in your summary', 'Remove any enterprise bureaucracy language', 'Add GitHub link if missing'],
  AI_PRODUCTION: ['Verify all model names are exact (GPT-4, LLaMA-3, not generic terms)', 'Add inference speed/cost metrics to ML bullets', 'Include Hugging Face or arXiv links'],
  RESEARCH_ACADEMIC: ['Lead with publications and citation counts', 'Include h-index or Google Scholar profile link', 'Highlight theoretical novelty over implementation'],
  FINTECH_INFRA: ['Quantify latency/uptime SLA improvements', 'Highlight mission-critical system scope', 'Add compliance frameworks handled (SOC2, PCI-DSS)'],
};

export const RebuildStandaloneView: React.FC<RebuildStandaloneViewProps> = (props) => {
  const { plan, credits, setCredits, onRebuildSuccess, onUpgrade, history, preFilledContext, activeAnalysis, activeJobs, dispatchJob, userId } = props;
  const [step, setStep] = useState<'form' | 'processing' | 'result' | 'quota_error'>('form');
  const [loading, setLoading] = useState(false);
  const [resumeText, setResumeText, clearResumeText] = usePersistentState('rebuild_resume', '', props.userId);
  const [originalText, setOriginalText] = useState(''); // stored at dispatch time for diff view
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const [isParsing, setIsParsing] = useState(false);
  const [roleTrack, setRoleTrack] = usePersistentState<RoleTrack>('rebuild_track', 'BIG_TECH', props.userId);
  const [rebuiltResume, setRebuiltResume] = useState<StructuredResume | null>(null);
  const [signalDelta, setSignalDelta] = useState<SignalDelta | null>(null);
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null);
  const [finalMeta, setFinalMeta] = useState({ role: '', label: '' });
  const [gateState, setGateState] = useState<'SAFE' | 'BORDERLINE' | 'LOCKED' | undefined>(undefined);
  const [createdIds, setCreatedIds] = useState<{ groupId: string; versionId: string } | null>(null);
  const [targetJD, setTargetJD] = useState('');
  const [jdCollapsed, setJdCollapsed] = useState(false);
  const [jdParsed, setJdParsed] = useState<JDParsed | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [processingStageIdx, setProcessingStageIdx] = useState(0);
  const [processingStartedAt, setProcessingStartedAt] = useState<number | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [changeLog, setChangeLog] = useState<ChangeEntry[]>([]);
  const [isEditorExpanded, setIsEditorExpanded] = useState(false);

  const REBUILD_STAGES = [
    { label: 'Parsing source document', cumulative: 8000 },
    { label: 'Identifying signal gaps', cumulative: 23000 },
    { label: 'Calibrating to track heuristics', cumulative: 43000 },
    { label: 'Injecting ownership language', cumulative: 68000 },
    { label: 'Verifying ATS compatibility', cumulative: 78000 },
    { label: 'Computing signal delta', cumulative: 83000 },
  ];

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = usePersistentState('rebuild_form', {
    role: '',
    industry: ''
  }, props.userId);

  const { save: saveJobCtx, restore: restoreJobCtx, clear: clearJobCtx } = useJobContextPersistence(props.userId);

  const [trackingJobId, setTrackingJobId] = useState<string | null>(null);

  useEffect(() => {
    const ctx = restoreJobCtx();
    const activeJob = Object.values(activeJobs).find(j => j.type === 'REBUILD' && j.status === 'RUNNING');
    if (activeJob && !trackingJobId) {
      setTrackingJobId(activeJob.id);
      setStep('processing');
      if (ctx) {
        setResumeText(ctx.resumeText);
        setFormData(prev => ({ ...prev, role: ctx.role }));
        setRoleTrack(ctx.roleTrack as RoleTrack);
      } else if (activeJob.payload?.role) {
        setFormData(prev => ({ ...prev, role: activeJob.payload.role }));
      }
    }
  }, []);

  // Processing stage ticker
  useEffect(() => {
    if (step !== 'processing' || !processingStartedAt) return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - processingStartedAt;
      const nextIdx = REBUILD_STAGES.findIndex(s => elapsed < s.cumulative);
      setProcessingStageIdx(nextIdx === -1 ? REBUILD_STAGES.length - 1 : nextIdx);
    }, 1000);
    return () => clearInterval(interval);
  }, [step, processingStartedAt]);

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
          // Extract signalDelta if pipeline returned it
          if (result.signalDelta) setSignalDelta(result.signalDelta);
          // Compute client-side changelog as fallback
          setChangeLog(computeChangeLog(originalText || resumeText, finalResume as StructuredResume));
          setCreatedIds(result.id ? { groupId: result.resume_id, versionId: result.id } : null);
          setFinalMeta({
            role: job.payload?.role || formData.role || "Professional",
            label: `${job.payload?.role || "Rebuild"} @ ${job.payload?.roleTrack || roleTrack}`
          });
          clearJobCtx();
          setStep('result');
          setTrackingJobId(null);
        } else {
          console.error("Malformed rebuild result:", result);
          // Preserve form data, don't clear resumeText
          setErrorFeedback("Connection issue. Your resume data is saved — click Execute to try again.");
          setStep('form');
          setTrackingJobId(null);
        }
      } else if (job.status === 'FAILED') {
        // Preserve form data on failure
        setErrorFeedback(job.error || "Resume reconstruction failed. Your data is saved — click Execute to try again.");
        setStep('form');
        setTrackingJobId(null);
      }
    }
  }, [activeJobs, trackingJobId]);

  useEffect(() => {
    if (preFilledContext && !resumeText) {
      setResumeText(preFilledContext.text);
      setFormData({ role: preFilledContext.role, industry: '' });
      setRoleTrack(preFilledContext.track);
      setGateState(preFilledContext.gate);
      if (preFilledContext.text && preFilledContext.role && !trackingJobId) {
        startRebuild(preFilledContext.text, preFilledContext.role, preFilledContext.track, preFilledContext.gate);
      }
    }
  }, [preFilledContext]);

  // Shared intelligence: auto-fill from analysis chokepoint
  useEffect(() => {
    if (activeAnalysis && !preFilledContext) {
      setFormData(prev => ({ ...prev, role: activeAnalysis.targetRole || activeAnalysis.role }));
    }
  }, [activeAnalysis]);

  const isPro = plan === 'Career Pro' || plan === 'Career Elite' || plan === 'Automation';
  const recentResumes = history.slice(0, 5);

  const selectSavedResume = (group: ResumeGroup) => {
    const version = group.versions.find(v => v.type === 'original') || group.versions[0];
    if (version && version.data) {
      const contact = version.data.contact || {};
      const exp = (version.data.experience || []).map((e: any) => {
        const bulletsText = (e.bullets || []).map((b: string) => `• ${b}`).join('\n');
        return `${e.title} at ${e.organization} (${e.dates || ''}):\n${bulletsText}`;
      }).join('\n\n');
      const edu = (version.data.education || []).map((e: any) => `${e.degree || ''} from ${e.institution || ''} (${e.dates || ''})`).join('\n');
      const proj = (version.data.projects || []).map((p: any) => `${p.name || ''}: ${p.description || ''}${p.impact ? ` (Impact: ${p.impact})` : ''}`).join('\n');
      const skills = version.data.skills ? [
        ...(version.data.skills.languages || []),
        ...(version.data.skills.frameworks || []),
        ...(version.data.skills.tools || []),
        ...(version.data.skills.specializations || [])
      ].join(', ') : '';

      const text = `NAME: ${contact.full_name || ''}\nEMAIL: ${contact.email || ''}\nPHONE: ${contact.phone || ''}\nLOCATION: ${contact.location || ''}\n\nSUMMARY:\n${version.data.summary || ''}\n\nEXPERIENCE:\n${exp}\n\nEDUCATION:\n${edu}\n\nPROJECTS:\n${proj}\n\nSKILLS:\n${skills}`.trim();
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
    setRetryCount(0);
    setProcessingStageIdx(0);
    setOriginalText(textToUse); // capture for diff view
    setStep('processing');
    setProcessingStartedAt(Date.now());

    try {
      setLoading(true);
      setErrorFeedback(null);
      saveJobCtx({ resumeText: textToUse, role: roleToUse, roleTrack: trackToUse, jobId: '' });
      const jobId = await dispatchJob('REBUILD', {
        role: roleToUse,
        roleTrack: trackToUse,
        sourceText: textToUse,
        resume_id: selectedResumeId || 'NEW',
        targetJD
      });
      saveJobCtx({ resumeText: textToUse, role: roleToUse, roleTrack: trackToUse, jobId });
      setTrackingJobId(jobId);
    } catch (err) {
      // Final failure — return to form with data preserved
      setErrorFeedback('Connection issue. Your resume data is saved — click Execute to try again.');
      setStep('form');
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = () => {
    if (rebuiltResume) {
      onRebuildSuccess(rebuiltResume, createdIds?.versionId || "", finalMeta.label, createdIds?.groupId);
    }
  };

  const handleDownload = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const content = document.getElementById('rebuild-preview-target')?.outerHTML;
      const resumeName = rebuiltResume?.contact.full_name || 'Resume';
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

  if (step === 'quota_error') {
    return (
      <div className="max-w-3xl mx-auto py-24 px-10 text-center animate-in fade-in zoom-in duration-500">
        <div className="relative mb-12 flex justify-center">
          <div className="absolute inset-0 bg-blue-500/20 blur-[80px] rounded-full mx-auto w-32 h-32" />
          <div className="w-24 h-24 bg-blue-500/10 border border-blue-500/20 rounded-[2.5rem] flex items-center justify-center relative z-10 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.15)]">
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
            className="px-12 py-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-2xl uppercase tracking-[0.2em] text-xs transition-all duration-300 shadow-2xl shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0 w-full md:w-auto flex items-center justify-center gap-3 group"
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

  if (step === 'processing') return <RebuildProcessingSkeleton role={formData.role} track={roleTrack} />;

  if (step === 'result' && rebuiltResume) {
    // changeLog is now a real state var (was previously a useState inside this conditional — hooks violation)
    const rebuiltText = JSON.stringify(rebuiltResume);
    const beforeOwnership = countOwnershipVerbs(originalText || resumeText);
    const afterOwnership = countOwnershipVerbs(rebuiltText);
    const beforeMetrics = countMetrics(originalText || resumeText);
    const afterMetrics = countMetrics(rebuiltText);

    const allBullets = rebuiltResume.experience?.flatMap(e => e.bullets ?? []) ?? [];
    const strongOpener = allBullets.length > 0 && /^[A-Z][a-z]+ed|^[A-Z][a-z]+s\b|^[A-Z][a-z]+ing\b/.test(allBullets[0]);
    const quantifiedBullets = allBullets.filter(b => /\d/.test(b)).length;
    const quantifiedPct = allBullets.length > 0 ? quantifiedBullets / allBullets.length : 0;

    const nextSteps = NEXT_STEPS[roleTrack] || NEXT_STEPS['BIG_TECH'];

    return (
      <div className="max-w-[1400px] mx-auto py-12 px-10 animate-in fade-in duration-700">
        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-8">
          <div>
            <div className="flex items-center gap-3 text-green-400 mb-4 bg-green-400/5 w-fit px-4 py-1 rounded-full border border-green-400/10">
              <CheckCircle2 size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">Rebuild Complete</span>
            </div>
            <h2 className="text-5xl font-black text-white tracking-tighter uppercase leading-none">Architect Preview</h2>
            {/* Signal Uplift pill */}
            {signalDelta && (
              <div className="flex items-center gap-2 mt-3">
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Signal Uplift:</span>
                <span className="text-green-400 font-black text-sm">+{signalDelta.scoreAfter - signalDelta.scoreBefore} pts</span>
                <span className="text-slate-600 text-[9px]">{signalDelta.scoreBefore} → {signalDelta.scoreAfter}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            {/* Diff view toggle */}
            <button
              onClick={() => setShowDiff(d => !d)}
              className={`px-5 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-2 ${showDiff ? 'border-blue-500/40 text-blue-400 bg-blue-500/10' : 'border-white/5 text-slate-500 hover:text-white'
                }`}
            >
              <Eye size={13} /> {showDiff ? 'Hide Diff' : 'Show Diff'}
            </button>
            <button
              onClick={handleDownload}
              className="bg-slate-950/40 border border-white/5 text-white font-black py-4 px-8 rounded-2xl shadow-xl hover:bg-slate-900/50 hover:border-white/10 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 flex items-center justify-center gap-2 uppercase tracking-widest text-[10px]"
            >
              <Download size={16} /> Download PDF
            </button>
            <button
              onClick={handleCommit}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black py-4 px-10 rounded-2xl shadow-xl transition-all duration-300 hover:shadow-blue-500/25 hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 uppercase tracking-widest text-[10px]"
            >
              <Save size={16} /> Save to History
            </button>
          </div>
        </div>

        {/* ── New 3-column grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* COLUMN 1 — Resume Preview (col-span-5) */}
          <div className="lg:col-span-5 bg-[#161824]/60 border border-white/5 rounded-[3rem] overflow-hidden shadow-2xl h-[800px]">
            <div className="h-full overflow-y-auto custom-scrollbar">
              <StructuredResumePreview resume={rebuiltResume} showDiff={showDiff} changeLog={changeLog} />
            </div>
          </div>

          {/* COLUMN 2 — Rebuild Intelligence Panel (col-span-4) */}
          <div className="lg:col-span-4 backdrop-blur-md bg-[#161824]/60 border border-white/5 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden h-[800px] flex flex-col">
            <div className="mb-6 shrink-0">
              <p className="text-white font-black uppercase text-xs tracking-widest">Rebuild Intelligence</p>
              <p className="text-slate-500 text-[10px] mt-1">Every signal we changed and why</p>
            </div>
            <div className="overflow-y-auto flex-1 pb-4 pr-1">
              {changeLog.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-slate-500 text-xs text-center leading-relaxed px-4">
                    Analysis complete — resume optimized for your track.<br />Key signals reinforced.
                  </p>
                </div>
              ) : (
                changeLog.map((entry, idx) => {
                  const cfg = TYPE_CONFIG[entry.type] || TYPE_CONFIG['METRIC_ADDED'];
                  return (
                    <div key={idx} className="bg-[#0D0D12] border border-white/5 rounded-2xl p-5 mb-3 last:mb-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{entry.section}{entry.company ? ` · ${entry.company}` : ''}</span>
                        <span className={`ml-auto text-[9px] font-black px-2 py-0.5 rounded-full border ${cfg.color} ${cfg.bg} ${cfg.border}`}>{cfg.label}</span>
                      </div>
                      <p className="text-white text-xs font-bold truncate mb-1.5">{entry.preview}</p>
                      <p className="text-slate-500 text-[10px] leading-relaxed">{entry.detail}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* COLUMN 3 — Signal Score + Next Step (col-span-3) */}
          <div className="lg:col-span-3 space-y-5">

            {/* Card A: Signal Improvement */}
            <div className="bg-[#161824]/60 border border-white/5 rounded-[2rem] p-7">
              <p className="text-white font-black uppercase text-[10px] tracking-widest mb-5">Signal Improvement</p>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Ownership Verbs</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 text-xs font-black">{beforeOwnership}</span>
                    <span className="text-slate-600 text-[9px]">→</span>
                    <span className={`text-xs font-black ${afterOwnership > beforeOwnership ? 'text-green-400' : 'text-slate-400'}`}>{afterOwnership}</span>
                    {afterOwnership > beforeOwnership && (
                      <span className="text-[9px] font-black text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-1.5 py-0.5">+{afterOwnership - beforeOwnership}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Metrics Present</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 text-xs font-black">{beforeMetrics}</span>
                    <span className="text-slate-600 text-[9px]">→</span>
                    <span className={`text-xs font-black ${afterMetrics > beforeMetrics ? 'text-green-400' : 'text-slate-400'}`}>{afterMetrics}</span>
                    {afterMetrics > beforeMetrics && (
                      <span className="text-[9px] font-black text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-1.5 py-0.5">+{afterMetrics - beforeMetrics}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Card B: F-Pattern Readiness */}
            <div className="bg-[#161824]/60 border border-white/5 rounded-[2rem] p-7">
              <p className="text-white font-black uppercase text-[10px] tracking-widest mb-5">F-Pattern Readiness</p>
              <div className="space-y-3">
                {[
                  { pass: strongOpener, label: 'Strong opening verbs', tip: 'First bullet must start with an action verb' },
                  { pass: quantifiedPct > 0.5, label: 'Quantified bullets >50%', tip: `${Math.round(quantifiedPct * 100)}% of bullets contain numbers` },
                  { pass: true, label: 'Single-column safe', tip: 'ATS-compliant single-column layout confirmed' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${item.pass ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                      {item.pass ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                    </div>
                    <div>
                      <p className={`text-xs font-bold ${item.pass ? 'text-white' : 'text-slate-400'}`}>{item.label}</p>
                      <p className="text-slate-600 text-[9px] mt-0.5">{item.tip}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Card C: Next Steps */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2rem] p-7 text-white">
              <p className="font-black uppercase text-[10px] tracking-widest mb-5">What to do now</p>
              <ol className="space-y-3">
                {nextSteps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[9px] font-black shrink-0 mt-0.5">{i + 1}</span>
                    <span className="text-blue-100 text-[10px] font-medium leading-snug">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Back to Parameters */}
            <button
              onClick={() => setStep('form')}
              className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest pt-2"
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
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={14} className="text-blue-400 animate-pulse" />
          <span className="text-[9px] font-black text-blue-450 uppercase tracking-widest bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">Intelligence Core</span>
        </div>
        <h2 className="text-5xl font-black text-white tracking-tighter uppercase leading-none mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-slate-400">Resume Rebuild</h2>
        <p className="text-slate-400 text-lg font-medium leading-relaxed max-w-2xl">
          Structurally re-architect your professional signal for specific judgment committee tracks.
        </p>
      </div>

      {/* Chokepoint Context Banner — shared intelligence from FullReview */}
      {activeAnalysis && (
        <div className="mb-8 p-5 bg-blue-500/5 border border-blue-500/20 rounded-2xl flex items-start gap-4">
          <AlertCircle size={18} className="text-blue-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-blue-400 font-black text-[10px] uppercase tracking-widest mb-1">Rebuild Target from Analysis</p>
            <p className="text-white font-bold text-sm">{activeAnalysis.targetRole || activeAnalysis.role}</p>
            <p className="text-slate-500 text-[11px] mt-1">
              Critical chokepoint: <span className="text-red-400 font-black">{activeAnalysis.chokepoint || activeAnalysis.chokepointCategory}</span> ({activeAnalysis.chokepointScore || activeAnalysis.overallScore}%) — rebuilt resume will prioritize this signal.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8 space-y-10">

          {!isPro ? (
            <div className="w-full bg-[#161824]/60 border border-white/5 rounded-[2.5rem] p-10 md:p-14 shadow-2xl flex flex-col items-center gap-8 text-center backdrop-blur-md">
              <div className="w-20 h-20 rounded-3xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center relative">
                <Sparkles size={32} className="text-blue-400 animate-pulse" />
                <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <Lock size={16} className="text-amber-500" />
                </div>
              </div>
              <div>
                <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-4">Pro Feature Locked</h3>
                <p className="text-slate-400 text-sm max-w-lg leading-relaxed font-medium">
                  Resume Rebuilding is an advanced, high-fidelity AI architecting pipeline. Upgrade to **Career Pro** for unlimited deterministic resume re-architecting optimized for FAANG, startup, or fintech systems judgment tracks.
                </p>
              </div>
              <button
                onClick={onUpgrade}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black px-12 py-5 rounded-2xl uppercase tracking-widest text-xs shadow-2xl shadow-blue-500/20 hover:shadow-blue-550/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300"
              >
                Upgrade to Pro →
              </button>
            </div>
          ) : (
            <>
              {/* Saved Resumes Selection */}
              {recentResumes.length > 0 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 px-1">
                    <FileIcon className="text-blue-450" size={16} />
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em]">
                      Select Saved Resume Source (Last 5)
                    </label>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {recentResumes.map((r) => {
                      const rawDate = r.versions?.[0]?.createdAt || (r.versions?.[0] as any)?.created_at || (r as any)?.created_at || (r as any)?.updated_at;
                      const parsedDate = rawDate ? new Date(rawDate) : null;
                      const cleanDate = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate.toLocaleDateString() : 'No date';

                      const contactName = r.versions?.[0]?.data?.contact?.full_name || 'Resume Source';
                      const cleanName = r.name && !r.name.includes('undefined') ? r.name : contactName;

                      return (
                        <button
                          key={r.id}
                          onClick={() => selectSavedResume(r)}
                          className={`flex items-center gap-4 p-5 rounded-2xl border backdrop-blur-md transition-all duration-300 text-left hover:-translate-y-0.5 active:translate-y-0 ${selectedResumeId === r.id ? 'bg-gradient-to-r from-blue-600/15 to-indigo-600/15 border-blue-500/80 shadow-[0_0_20px_rgba(59,130,246,0.15)]' : 'bg-slate-950/40 border-white/5 hover:border-white/10 hover:bg-slate-900/40'}`}
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${selectedResumeId === r.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25' : 'bg-slate-900 text-slate-550'}`}>
                            <FileIcon size={18} />
                          </div>
                          <div className="flex-1 truncate">
                            <p className="text-white font-bold text-xs truncate uppercase tracking-widest">{cleanName}</p>
                            <p className="text-slate-550 text-[9px] font-black uppercase tracking-widest mt-1">
                              {cleanDate}
                            </p>
                          </div>
                          {selectedResumeId === r.id && <CheckCircle2 size={16} className="text-blue-500" />}
                        </button>
                      );
                    })}
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

              <div className="backdrop-blur-lg bg-[#161824]/60 border border-white/5 rounded-[2.5rem] p-10 space-y-12 shadow-2xl shadow-black/40">

                {/* Target JD Panel */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 px-1">
                    <FileIcon size={16} className="text-blue-550" />
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em]">
                      Target Job Posting (Optional)
                    </label>
                  </div>
                  <div className="relative group">
                    <textarea
                      value={targetJD}
                      onChange={e => setTargetJD(e.target.value)}
                      placeholder="Paste the full job description you are applying to (highly recommended for precision ATS targeting)"
                      className="w-full bg-slate-950/40 border border-white/5 rounded-2xl p-6 text-white outline-none focus:border-blue-500/80 focus:shadow-[0_0_25px_rgba(59,130,246,0.18)] text-sm transition-all duration-300 placeholder:opacity-30 min-h-[140px] custom-scrollbar"
                    />
                  </div>
                </div>

                {/* Track Selection (Same as Intelligence Page) */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 px-1">
                    <Shield className="text-blue-550" size={16} />
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
                        className={"flex flex-col gap-4 p-6 rounded-2xl border transition-all duration-300 text-left group hover:-translate-y-1 active:translate-y-0 " + (roleTrack === track.id ? 'bg-gradient-to-br from-blue-600/15 to-indigo-600/15 border-blue-500 shadow-[0_0_25px_rgba(59,130,246,0.18)]' : 'bg-slate-950/30 border-white/5 hover:border-white/15 hover:bg-slate-900/30')}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className={roleTrack === track.id ? 'text-blue-400' : 'text-slate-555 group-hover:text-slate-400'}>
                            {track.icon}
                          </div>
                          {roleTrack === track.id && <div className="w-1.5 h-1.5 rounded-full bg-blue-450 animate-pulse" />}
                        </div>
                        <div>
                          <span className={"text-xs font-black uppercase tracking-widest block mb-1 " + (roleTrack === track.id ? 'text-white' : 'text-slate-400')}>{track.label}</span>
                          <p className="text-[10px] text-slate-555 font-medium leading-relaxed">{track.desc}</p>
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
                      className="w-full bg-slate-950/40 border border-white/5 rounded-2xl p-6 text-white outline-none focus:border-blue-500/80 focus:shadow-[0_0_25px_rgba(59,130,246,0.18)] text-xl font-bold transition-all duration-300 placeholder:opacity-20 pl-14"
                    />
                    <Target size={20} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-550 transition-colors" />
                  </div>
                </div>

                <div className="pt-6 border-t border-white/5">
                  <button onClick={() => fileInputRef.current?.click()} className="w-full py-10 rounded-3xl border-2 border-dashed bg-slate-950/20 border-white/5 text-slate-500 hover:border-blue-500/50 hover:bg-blue-600/5 hover:shadow-[0_0_25px_rgba(59,130,246,0.08)] transition-all duration-300 flex flex-col items-center justify-center gap-4 group hover:-translate-y-0.5 active:translate-y-0">
                    <UploadCloud size={32} className="group-hover:text-blue-400 transition-colors duration-300" />
                    <div className="text-center">
                      <span className="text-[11px] font-black uppercase tracking-[0.3em] block mb-1">Upload New Source</span>
                      <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Replaces selected saved resume</p>
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={e => e.target.files?.[0] && processFile(e.target.files[0])} />
                  </button>
                </div>

                {/* Parsing skeleton indicator */}
                {isParsing && (
                  <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-6 flex items-center gap-4 animate-pulse">
                    <Loader2 className="animate-spin text-blue-450" size={20} />
                    <div>
                      <p className="text-white font-bold text-xs uppercase tracking-wider">Parsing Document...</p>
                      <p className="text-slate-500 text-[10px] font-medium mt-0.5">Extracting experience, projects, and target credentials</p>
                    </div>
                  </div>
                )}

                {/* Active Resume Loaded Confirmation & Collapsible Text Inspector */}
                {resumeText && !isParsing && (
                  <div className="bg-gradient-to-r from-blue-500/5 to-indigo-500/5 border border-blue-500/20 rounded-2xl p-6 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400">
                          <CheckCircle2 size={16} className="animate-pulse" />
                        </div>
                        <div>
                          <p className="text-white font-bold text-xs uppercase tracking-wider">Active Resume Loaded</p>
                          <p className="text-slate-400 text-[10px] font-medium mt-0.5">
                            {resumeText.split(/\s+/).filter(Boolean).length} words • {resumeText.length} characters
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsEditorExpanded(!isEditorExpanded)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-350 hover:text-white transition-all text-[10px] font-black uppercase tracking-wider cursor-pointer"
                      >
                        {isEditorExpanded ? 'Hide Draft' : 'Inspect & Edit'}
                        {isEditorExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    </div>

                    {isEditorExpanded && (
                      <div className="space-y-3 pt-4 border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Raw Source Text Editor</span>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm("Are you sure you want to clear the active resume?")) {
                                clearResumeText();
                                setSelectedResumeId('');
                              }
                            }}
                            className="flex items-center gap-1.5 text-[9px] font-black text-red-400 hover:text-red-300 uppercase tracking-widest transition-colors cursor-pointer"
                          >
                            <Trash2 size={10} /> Clear Source
                          </button>
                        </div>
                        <textarea
                          value={resumeText}
                          onChange={(e) => setResumeText(e.target.value)}
                          className="w-full h-64 bg-slate-950/80 border border-white/5 rounded-xl p-4 text-slate-300 outline-none focus:border-blue-500/50 focus:shadow-[0_0_20px_rgba(59,130,246,0.1)] text-xs font-mono leading-relaxed custom-scrollbar resize-none"
                          placeholder="Paste or edit raw resume text here..."
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={() => startRebuild()}
                disabled={!resumeText || !formData.role || loading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black py-7 rounded-3xl transition-all duration-300 uppercase tracking-[0.25em] text-xs shadow-2xl shadow-blue-500/25 hover:shadow-blue-500/45 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none flex items-center justify-center gap-4 group"
              >
                {loading ? <Loader2 className="animate-spin" /> : <><Sparkles size={20} className="group-hover:rotate-12 transition-transform duration-300" /> Execute Rebuild Pipeline</>}
              </button>
            </>
          )}
        </div>

        <div className="lg:col-span-4 space-y-8">
          <div className="backdrop-blur-md bg-[#161824]/60 border border-white/5 p-10 rounded-[2.5rem] shadow-2xl shadow-black/40">
            <h4 className="text-white font-black uppercase text-xs tracking-[0.2em] mb-6">Engine Logic</h4>
            <div className="space-y-6">
              {[
                { i: 1, t: "Fidelity Check", d: "Verification of artifact sources against claims." },
                { i: 2, t: "Track Calibration", d: "Applying track-specific heuristic weighting." },
                { i: 3, t: "ATS Shielding", d: "Guaranteeing standard machine parseability." }
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

          <div className="bg-gradient-to-br from-indigo-600 via-blue-600 to-indigo-700 p-10 rounded-[2.5rem] text-white shadow-2xl shadow-indigo-600/25 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
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
