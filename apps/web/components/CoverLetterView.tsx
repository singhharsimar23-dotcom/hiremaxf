/**
 * CoverLetterView — generates traceable cover letters
 *
 * -- CREATE TABLE IF NOT EXISTS cover_letters (
 * --   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 * --   user_id uuid REFERENCES auth.users(id),
 * --   company_name text, job_title text,
 * --   content_text text, specificity_score integer,
 * --   created_at timestamptz DEFAULT now()
 * -- );
 */
import React, { useState, useEffect } from 'react';
import { FileText, Sparkles, Lock, Loader2, Copy, Check, Download, RefreshCw, Save, AlertCircle } from 'lucide-react';
import { UserPlan, ResumeGroup, CoverLetterResult, JobType, BackgroundJob } from '../types';
import { supabase } from '../lib/supabase';
import { AnalysisSkeleton } from './Skeletons';

interface Props { plan: UserPlan; history: ResumeGroup[]; user: any; onUpgrade: () => void; dispatchJob: (type: JobType, payload: any) => Promise<string>; activeJobs: Record<string, BackgroundJob>; }

const CL_COUNT_KEY = 'hiremax_cl_count';
const FREE_LIMIT = 1;

const ScoreGauge: React.FC<{score: number}> = ({ score }) => {
  const r = 40; const circ = 2 * Math.PI * r;
  const fill = circ * (1 - score / 100);
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex flex-col items-center">
      <svg width="100" height="100" className="-rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#1f2937" strokeWidth="8"/>
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8" strokeDasharray={circ} strokeDashoffset={fill} strokeLinecap="round" className="transition-all duration-1000"/>
      </svg>
      <div className="-mt-14 text-center z-10 relative">
        <p className="text-2xl font-black text-white">{score}</p>
        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">/100</p>
      </div>
    </div>
  );
};

export const CoverLetterView: React.FC<Props> = ({ plan, history, user, onUpgrade, dispatchJob, activeJobs }) => {
  const isPro = plan !== 'Starter';
  const [clCount] = useState(() => { try { return parseInt(localStorage.getItem(CL_COUNT_KEY)||'0'); } catch { return 0; } });
  const canGenerate = isPro || clCount < FREE_LIMIT;

  const [trackingJobId, setTrackingJobId] = useState<string | null>(null);

  const [step, setStep] = useState<'input'|'loading'|'result'>('input');
  const [loadMsg, setLoadMsg] = useState('');
  const [result, setResult] = useState<CoverLetterResult & { evidenceChain?: any; specificityScore?: number } | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [form, setForm] = useState({
    companyName: '', jobTitle: '', jobDescription: '', hiringManagerName: '',
    tone: 'Professional' as 'Professional'|'Conversational'|'Direct & Confident',
    selectedGroup: '', pastedResume: ''
  });

  const resumeText = (() => {
    if (pasteMode) return form.pastedResume;
    const g = history.find(h => h.id === form.selectedGroup) || history[0];
    const v = g?.versions?.[g.versions.length-1];
    if (!v?.data) return '';
    const d = v.data;
    return [d.contact?.full_name, d.summary, ...(d.experience||[]).map((e:any)=>`${e.title} at ${e.organization}: ${e.bullets?.join('; ')}`), ...(d.skills?Object.values(d.skills).flat():[])].filter(Boolean).join('\n');
  })();

  const selectedGroupObj = history.find(h => h.id === form.selectedGroup) || history[0];
  const previewBullets = selectedGroupObj?.versions?.[selectedGroupObj.versions.length-1]?.data?.experience?.[0]?.bullets?.slice(0,3) || [];

  useEffect(() => {
    if (!trackingJobId) return;
    const activeJob = activeJobs[trackingJobId];
    if (!activeJob) return;

    if (activeJob.status === 'COMPLETED' && activeJob.result) {
      setResult(activeJob.result);
      setStep('result');
      if (!isPro) { try { localStorage.setItem(CL_COUNT_KEY, String(clCount+1)); } catch {} }
      setTrackingJobId(null);
    } else if (activeJob.status === 'FAILED') {
      setError(activeJob.error || 'Generation failed.');
      setStep('input');
      setTrackingJobId(null);
    }
  }, [activeJobs, trackingJobId, isPro, clCount]);

  const generate = async (toneOverride?: string) => {
    if (!canGenerate) { onUpgrade(); return; }
    if (!form.jobDescription.trim() || !form.companyName.trim()) { setError('Company name and job description are required.'); return; }
    setStep('loading'); setError('');
    const msgs = ['Crafting your letter…','Extracting JD pain points…','Mapping to your experience…'];
    let i = 0; const iv = setInterval(() => setLoadMsg(msgs[i++%msgs.length]), 1600);
    try {
      const jobId = await dispatchJob('COVER_LETTER', { 
        job_description: form.jobDescription, 
        company_name: form.companyName, 
        job_title: form.jobTitle, 
        resume_text: resumeText, 
        hiring_manager_name: form.hiringManagerName, 
        tone: toneOverride||form.tone 
      });
      setTrackingJobId(jobId);
    } catch (err: any) { 
      setError(err.message||'Generation failed.'); 
      setStep('input'); 
    } finally { 
      clearInterval(iv); 
    }
  };

  const copy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.letterText).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),2000); });
  };

  const download = () => {
    if (!result) return;
    const w = window.open('','_blank'); if (!w) return;
    const name = history.find(h=>h.id===form.selectedGroup)?.versions?.[0]?.data?.contact?.full_name || 'Your Name';
    w.document.write(`<html><head><title>Cover Letter</title><style>body{font-family:Georgia,serif;padding:60px;max-width:680px;margin:0 auto;font-size:14px;line-height:1.9;color:#111}p{margin:18px 0}.hook{border-left:4px solid #3b82f6;padding-left:16px}.evidence{border-left:4px solid #22c55e;padding-left:16px}.signal{border-left:4px solid #f59e0b;padding-left:16px}.close{border-left:4px solid #94a3b8;padding-left:16px}</style></head><body><p>${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</p><p>${form.hiringManagerName?`Dear ${form.hiringManagerName},`:'Dear Hiring Team,'}</p><p class="hook">${result.paragraphs?.hook||''}</p><p class="evidence">${result.paragraphs?.evidence||''}</p><p class="signal">${result.paragraphs?.companySignal||''}</p><p class="close">${result.paragraphs?.close||''}</p><p>Sincerely,<br/><strong>${name}</strong></p><script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close();
  };

  const saveToDb = async () => {
    if (!result||!user) return;
    await supabase.from('cover_letters').insert({ user_id: user.id, company_name: form.companyName, job_title: form.jobTitle, content_text: result.letterText, specificity_score: result.specificityScore||0 });
    setSaved(true); setTimeout(()=>setSaved(false),2500);
  };

  const PARA_CFG = [
    { key: 'hook' as const, label: 'Hook', border: 'border-l-blue-500', evLabel: 'Hook — your strongest relevant signal', evColor: 'blue' },
    { key: 'evidence' as const, label: 'Evidence', border: 'border-l-green-500', evLabel: 'Evidence — specific proof mapped to JD', evColor: 'green' },
    { key: 'companySignal' as const, label: 'Company Signal', border: 'border-l-amber-500', evLabel: 'Company signal — proves you researched', evColor: 'amber' },
    { key: 'close' as const, label: 'Close', border: 'border-l-slate-500', evLabel: 'Close — specific ask', evColor: 'slate' },
  ];

  const wc = result?.wordCount || result?.letterText?.split(/\s+/).filter(Boolean).length || 0;

  if (step === 'loading') return (
    <div className="max-w-[1200px] mx-auto py-14 px-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col items-center gap-4 text-center max-w-[600px] mx-auto mb-8">
        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <Loader2 size={24} className="text-blue-400 animate-spin" />
        </div>
        <p className="text-white font-black text-xl tracking-tight uppercase">{loadMsg}</p>
        <div className="flex gap-2 justify-center mt-2 flex-wrap">
          {['Analyzing JD Keywords…', 'Parsing Resume Signals…', 'Synthesizing Paragraphs…'].map(m => (
            <span key={m} className="text-[8px] font-black text-blue-400 uppercase tracking-widest bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full">{m}</span>
          ))}
        </div>
      </div>
      <AnalysisSkeleton />
    </div>
  );

  if (!canGenerate) return (
    <div className="max-w-[700px] mx-auto py-24 px-8 flex flex-col items-center gap-6 text-center">
      <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center"><Lock size={32} className="text-amber-500"/></div>
      <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Free Limit Reached</h2>
      <p className="text-slate-400 max-w-md">You've used your 1 free cover letter. Upgrade to Pro for unlimited generations with evidence chain analysis.</p>
      <button onClick={onUpgrade} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black px-10 py-4 rounded-2xl uppercase tracking-widest text-sm shadow-xl shadow-blue-500/20 hover:opacity-90 transition-all">Upgrade to Pro →</button>
    </div>
  );

  return (
    <div className="max-w-[1400px] mx-auto py-14 px-8 animate-in fade-in duration-500">
      <div className="flex items-start justify-between mb-10">
        <div>
          <div className="flex items-center gap-2 mb-3"><Sparkles size={13} className="text-blue-400 animate-pulse"/><span className="text-[9px] font-black text-blue-400 uppercase tracking-widest bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">AI Writing Engine</span></div>
          <h2 className="text-5xl font-black tracking-tighter uppercase bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 mb-2">Cover Letter</h2>
          <p className="text-slate-400">Every sentence traced to a source. Never generic.</p>
        </div>
        {!isPro && <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl px-5 py-3 text-center"><p className="text-[8px] font-black text-amber-400 uppercase tracking-widest">{clCount<FREE_LIMIT?'1 free generation':'Free limit reached'}</p></div>}
      </div>

      {step === 'input' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7">
            <div className="bg-[#111118] border border-white/5 rounded-[2rem] p-10 space-y-7">
              <div className="grid grid-cols-2 gap-5">
                <div><label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] block mb-2">Company Name *</label><input value={form.companyName} onChange={e=>setForm(f=>({...f,companyName:e.target.value}))} placeholder="Google, Stripe…" className="w-full bg-[#0A0A0F] border border-white/8 rounded-2xl p-4 text-white text-sm outline-none focus:border-blue-500/40 transition-all placeholder:text-slate-700"/></div>
                <div><label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] block mb-2">Job Title *</label><input value={form.jobTitle} onChange={e=>setForm(f=>({...f,jobTitle:e.target.value}))} placeholder="Senior Engineer…" className="w-full bg-[#0A0A0F] border border-white/8 rounded-2xl p-4 text-white text-sm outline-none focus:border-blue-500/40 transition-all placeholder:text-slate-700"/></div>
              </div>
              <div><label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] block mb-2">Hiring Manager (optional)</label><input value={form.hiringManagerName} onChange={e=>setForm(f=>({...f,hiringManagerName:e.target.value}))} placeholder="Sarah Chen" className="w-full bg-[#0A0A0F] border border-white/8 rounded-2xl p-4 text-white text-sm outline-none focus:border-blue-500/40 transition-all placeholder:text-slate-700"/></div>
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] block mb-3">Tone</label>
                <div className="flex gap-2">{(['Professional','Conversational','Direct & Confident'] as const).map(t=>(
                  <button key={t} onClick={()=>setForm(f=>({...f,tone:t}))} className={`flex-1 py-3 rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all border ${form.tone===t?'bg-blue-600 border-blue-600 text-white':'bg-[#0A0A0F] border-white/8 text-slate-500 hover:border-white/15 hover:text-white'}`}>{t}</button>
                ))}</div>
              </div>
              <div><label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] block mb-2">Job Description *</label><textarea value={form.jobDescription} onChange={e=>setForm(f=>({...f,jobDescription:e.target.value}))} rows={9} placeholder="Paste the full job description…" className="w-full bg-[#0A0A0F] border border-white/8 rounded-2xl p-5 text-white text-sm outline-none focus:border-blue-500/40 resize-none placeholder:text-slate-700 transition-all"/></div>
              {error && <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl p-4"><AlertCircle size={15} className="text-red-400 shrink-0"/><p className="text-red-300 text-sm">{error}</p></div>}
              <button onClick={()=>generate()} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-sm shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3 transition-all"><Sparkles size={18}/>Generate Cover Letter →</button>
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="bg-[#16161E] border border-white/5 rounded-[2rem] p-7 space-y-5">
              <div className="flex items-center justify-between"><p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Resume Source</p><button onClick={()=>setPasteMode(!pasteMode)} className="text-[9px] font-black text-blue-400 hover:text-white transition-colors uppercase tracking-widest">{pasteMode?'← Select':'Paste manually'}</button></div>
              {pasteMode ? (
                <textarea value={form.pastedResume} onChange={e=>setForm(f=>({...f,pastedResume:e.target.value}))} rows={12} placeholder="Paste your resume text here…" className="w-full bg-[#0A0A0F] border border-white/8 rounded-2xl p-4 text-white text-sm outline-none focus:border-blue-500/40 resize-none placeholder:text-slate-700 transition-all"/>
              ) : (
                <>
                  <select value={form.selectedGroup} onChange={e=>setForm(f=>({...f,selectedGroup:e.target.value}))} className="w-full bg-[#0A0A0F] border border-white/8 rounded-2xl p-4 text-white text-sm outline-none focus:border-blue-500/40 transition-all">
                    {history.length===0&&<option value="">No saved resumes</option>}
                    {history.map(g=><option key={g.id} value={g.id}>{g.name} ({g.versions?.length||0} versions)</option>)}
                  </select>
                  {previewBullets.length>0 && (
                    <div className="bg-[#0A0A0F] border border-white/5 rounded-2xl p-5">
                      <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest mb-3">Preview — top bullets</p>
                      {previewBullets.map((b:string,i:number)=><p key={i} className="text-slate-400 text-[10px] mb-1.5">• {b}</p>)}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {step === 'result' && result && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Letter */}
          <div className="lg:col-span-5">
            <div className="flex items-center justify-between mb-4">
              <span className={`text-[10px] font-black px-3 py-1.5 rounded-full border ${wc<=250?'bg-green-500/10 border-green-500/20 text-green-400':'bg-red-500/10 border-red-500/20 text-red-400'}`}>{wc} words {wc<=250?'✓':'⚠'}</span>
              <button onClick={()=>setStep('input')} className="text-[9px] font-black text-slate-600 hover:text-slate-400 uppercase tracking-widest transition-colors">← Edit</button>
            </div>
            <div className="bg-white rounded-[2rem] p-10 shadow-2xl text-slate-900 font-serif">
              <p className="text-sm text-slate-500 mb-6">{new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</p>
              <p className="text-sm font-bold mb-7">{form.hiringManagerName?`Dear ${form.hiringManagerName},`:'Dear Hiring Team,'}</p>
              {PARA_CFG.map(({key,border})=>(
                <p key={key} className={`text-sm leading-relaxed mb-5 pl-4 border-l-4 ${border}`}>{result.paragraphs?.[key]}</p>
              ))}
              <p className="text-sm mt-8">Sincerely,<br/><strong>{history.find(h=>h.id===form.selectedGroup)?.versions?.[0]?.data?.contact?.full_name||'Your Name'}</strong></p>
            </div>
            <div className="flex gap-2 mt-4 flex-wrap">
              {PARA_CFG.map(({label,border})=><div key={label} className="flex items-center gap-1.5 text-[8px] font-black text-slate-600 uppercase tracking-widest"><div className={`w-3 h-0.5 ${border.replace('border-l-','bg-')}`}/>{label}</div>)}
            </div>
          </div>

          {/* Evidence Chain */}
          <div className="lg:col-span-4 space-y-4">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2">Why Each Paragraph Works</p>
            {PARA_CFG.map(({key,evLabel,evColor})=>{
              const ev = result.evidenceChain?.[key];
              const colorMap: Record<string,string> = { blue:'bg-blue-500/5 border-blue-500/20', green:'bg-green-500/5 border-green-500/20', amber:'bg-amber-500/5 border-amber-500/20', slate:'bg-slate-500/5 border-slate-500/20' };
              const textMap: Record<string,string> = { blue:'text-blue-400', green:'text-green-400', amber:'text-amber-400', slate:'text-slate-400' };
              return (
                <div key={key} className={`${colorMap[evColor]} border rounded-2xl p-5`}>
                  <p className={`text-[7px] font-black uppercase tracking-widest mb-3 ${textMap[evColor]}`}>{evLabel}</p>
                  {ev?.resumeSource && <p className="text-slate-300 text-xs mb-2"><span className="text-slate-600 font-black">Used: </span>"{ev.resumeSource}"</p>}
                  {ev?.jdSignal && <p className="text-slate-300 text-xs mb-2"><span className="text-slate-600 font-black">JD says: </span>"{ev.jdSignal}"</p>}
                  {ev?.why && <p className="text-slate-500 text-[10px] italic">{ev.why}</p>}
                  {!ev && <p className="text-slate-600 text-xs italic">Evidence data available after AI generation.</p>}
                </div>
              );
            })}
          </div>

          {/* Actions + Score */}
          <div className="lg:col-span-3">
            <div className="bg-[#16161E] border border-white/5 rounded-[2rem] p-7 sticky top-24 space-y-5">
              <div className="flex flex-col items-center">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-4">Specificity Score</p>
                <ScoreGauge score={result.specificityScore||75}/>
                <p className="text-[10px] font-black text-slate-400 mt-2 text-center">{(result.specificityScore||75)>=80?'Highly personalized':(result.specificityScore||75)>=60?'Good — could be more specific':'Generic — needs more detail'}</p>
              </div>
              <div className="space-y-2 pt-4 border-t border-white/5">
                <button onClick={copy} className="w-full flex items-center justify-center gap-2 py-3 bg-[#0A0A0F] border border-white/8 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest hover:border-white/15 transition-all">{copied?<><Check size={12} className="text-green-400"/>Copied</>:<><Copy size={12}/>Copy Text</>}</button>
                <button onClick={download} className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all"><Download size={12}/>Download PDF</button>
                <button onClick={saveToDb} disabled={saved} className="w-full flex items-center justify-center gap-2 py-3 bg-[#0A0A0F] border border-white/8 text-slate-400 hover:text-white rounded-2xl font-black text-[9px] uppercase tracking-widest hover:border-white/15 transition-all disabled:opacity-60"><Save size={12}/>{saved?'Saved!':'Save to History'}</button>
              </div>
              <div className="pt-4 border-t border-white/5">
                <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest mb-2">Regenerate with Tone</p>
                {(['Professional','Conversational','Direct & Confident'] as const).filter(t=>t!==form.tone).map(t=>(
                  <button key={t} onClick={()=>generate(t)} className="w-full flex items-center justify-center gap-1.5 py-2.5 mb-1.5 bg-[#0A0A0F] border border-white/5 text-slate-500 hover:text-white hover:border-white/10 rounded-xl font-black text-[8px] uppercase tracking-widest transition-all"><RefreshCw size={10}/>{t}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
