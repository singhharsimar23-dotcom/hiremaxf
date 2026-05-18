import React, { useState, useEffect } from 'react';
import { Sparkles, Lock, Loader2, Phone, Users, Code2, Star, HelpCircle, Printer, RotateCcw, Check, ChevronDown } from 'lucide-react';
import { UserPlan, ResumeGroup, InterviewPrepKit } from '../types';
import { supabase } from '../lib/supabase';
import { useBackgroundJobs } from '../lib/backgroundJobs';

interface Props { plan: UserPlan; history: ResumeGroup[]; user: any; onUpgrade: () => void; setView?: (v: any) => void; dispatchJob: (type: JobType, payload: any) => Promise<string>; activeJobs: Record<string, BackgroundJob>; }

const BEHAVIORAL_QS = [
  "Tell me about a conflict with a teammate",
  "Describe a failure and what you learned",
  "Tell me about your biggest success",
  "Describe a time you led without authority",
  "Tell me about handling ambiguity",
  "Describe meeting a critical deadline",
  "Tell me about receiving difficult feedback",
  "How have you influenced a decision you disagreed with?",
  "Tell me about adapting to significant change",
  "Describe taking initiative on something not assigned to you",
  "Tell me about a complex cross-team collaboration",
  "How have you grown in the last year?",
];

const FAANG_FREQ = ['95%','90%','99%','80%','85%','88%','82%','78%','75%','83%','87%','80%'];

const hashStr = (s: string) => s.slice(0,40).replace(/\W/g,'_');

const LBadge: React.FC<{pct: number}> = ({pct}) => (
  <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${pct>=85?'bg-green-500/20 text-green-400':pct>=60?'bg-amber-500/20 text-amber-400':'bg-slate-700 text-slate-400'}`}>
    {pct>=85?'Very Likely':pct>=60?'Likely':'Possible'} ({pct}%)
  </span>
);

export const InterviewPrepView: React.FC<Props> = ({ plan, history, user, onUpgrade, setView, dispatchJob, activeJobs }) => {
  const isPro = plan !== 'Starter';
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState('');
  const [kit, setKit] = useState<InterviewPrepKit | null>(null);
  const [error, setError] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [form, setForm] = useState({ jobDescription: '', companyStage: 'FAANG / Big Tech', roleLevel: 'Senior (IC5)' });
  const [stars, setStar] = useState<Record<number,{action:string;result:string}>>({});
  const [savedKeys, setSavedKeys] = useState<Set<number>>(new Set());
  const [trackingJobId, setTrackingJobId] = useState<string | null>(null);

  const resumeText = (() => {
    const g = history.find(h => h.id === selectedGroup) || history[0];
    const v = g?.versions?.[g.versions.length-1];
    if (!v?.data) return '';
    const d = v.data;
    return [d.contact?.full_name, d.summary, ...(d.experience||[]).map((e:any)=>`${e.title} at ${e.organization}: ${e.bullets?.join('; ')}`), ...(d.skills?Object.values(d.skills).flat():[])].filter(Boolean).join('\n');
  })();

  const jdHash = hashStr(form.jobDescription);

  useEffect(() => {
    if (!form.jobDescription) return;
    try {
      const cached = localStorage.getItem(`hiremax_prep_${jdHash}`);
      if (cached) {
        const { kit: k, ts } = JSON.parse(cached);
        if (Date.now() - ts < 4 * 3600000) { setKit(k); }
      }
    } catch {}
  }, [form.jobDescription]);

  useEffect(() => {
    if (!user) return;
    try {
      const saved = localStorage.getItem(`hiremax_star_${user.id}`);
      if (saved) setStar(JSON.parse(saved));
    } catch {}
  }, [user]);

  useEffect(() => {
    if (!trackingJobId) return;
    const activeJob = activeJobs[trackingJobId];
    if (!activeJob) return;

    if (activeJob.status === 'RUNNING') {
      setLoading(true);
    } else if (activeJob.status === 'COMPLETED' && activeJob.result) {
      setKit(activeJob.result);
      localStorage.setItem(`hiremax_prep_${jdHash}`, JSON.stringify({ kit: activeJob.result, ts: Date.now() }));
      setTab(0);
      setTrackingJobId(null);
      setLoading(false);
    } else if (activeJob.status === 'FAILED') {
      setError(activeJob.error || 'Generation failed.');
      setTrackingJobId(null);
      setLoading(false);
    }
  }, [activeJobs, trackingJobId, jdHash]);

  const generate = async () => {
    if (!isPro) { onUpgrade(); return; }
    if (!form.jobDescription.trim()) { setError('Paste a job description to continue.'); return; }
    setLoading(true); setError('');
    const msgs = ['Generating Prep Kit…', 'Building from your resume…', 'Calibrating for company stage…'];
    let i = 0; const iv = setInterval(() => { setLoadMsg(msgs[i++ % msgs.length]); }, 1800);
    
    try {
      const jobId = await dispatchJob('PREP', {
        job_description: form.jobDescription, 
        resume_text: resumeText, 
        company_stage: form.companyStage, 
        role_level: form.roleLevel
      });
      setTrackingJobId(jobId);
    } catch (err: any) { 
      setError(err.message || 'Generation failed.'); 
      setLoading(false);
    } finally {
      clearInterval(iv);
    }
  };

  const saveStar = (idx: number, field: 'action'|'result', val: string) => {
    setStar(prev => {
      const next = { ...prev, [idx]: { ...prev[idx], [field]: val } };
      if (user) localStorage.setItem(`hiremax_star_${user.id}`, JSON.stringify(next));
      return next;
    });
  };

  const markSaved = (idx: number) => setSavedKeys(prev => new Set([...prev, idx]));

  const doneCount = Object.entries(stars).filter(([,v]) => v.action && v.result).length;

  const exportKit = () => {
    const w = window.open('','_blank'); if (!w) return;
    const c = document.getElementById('prep-export')?.innerHTML || '';
    w.document.write(`<html><head><title>Interview Prep Kit</title><style>body{font-family:sans-serif;padding:40px;max-width:800px;margin:0 auto;font-size:13px;line-height:1.7}h2{font-size:16px;font-weight:900;margin:28px 0 10px;border-bottom:2px solid #e5e7eb;padding-bottom:6px}</style></head><body>${c}<script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close();
  };

  if (!isPro) return (
    <div className="max-w-[700px] mx-auto py-24 px-8 flex flex-col items-center gap-6 text-center">
      <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center"><Lock size={32} className="text-amber-500" /></div>
      <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Pro Feature</h2>
      <p className="text-slate-400 max-w-md">Interview Prep builds personalized answers from YOUR resume — not generic templates. Pre-fills STAR with your actual bullets. Available on Career Pro+.</p>
      <button onClick={onUpgrade} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black px-10 py-4 rounded-2xl uppercase tracking-widest text-sm shadow-xl shadow-blue-500/20 hover:opacity-90 transition-all">Upgrade to Pro →</button>
    </div>
  );

  return (
    <div className="max-w-[1400px] mx-auto py-14 px-8 animate-in fade-in duration-500">
      <div className="flex items-start justify-between mb-10">
        <div>
          <div className="flex items-center gap-2 mb-3"><Sparkles size={13} className="text-blue-400 animate-pulse" /><span className="text-[9px] font-black text-blue-400 uppercase tracking-widest bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">AI Interview Engine</span></div>
          <h2 className="text-5xl font-black tracking-tighter uppercase bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 mb-2">Interview Prep Kit</h2>
          <p className="text-slate-400">Answers built from your actual resume. Not templates.</p>
        </div>
        {kit && <div className="flex gap-2">
          <button onClick={exportKit} className="flex items-center gap-2 bg-[#1A1D26] border border-white/10 text-white px-4 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-white/5 transition-all"><Printer size={13} />Export</button>
          <button onClick={() => setKit(null)} className="flex items-center gap-2 bg-[#1A1D26] border border-white/10 text-slate-400 px-4 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest hover:text-white transition-all"><RotateCcw size={13} />New Kit</button>
        </div>}
      </div>

      {!kit ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8">
            <div className="bg-[#111118] border border-white/5 rounded-[2rem] p-10 space-y-7">
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] block mb-2">Job Description *</label>
                <textarea value={form.jobDescription} onChange={e => setForm(f=>({...f,jobDescription:e.target.value}))} rows={10} placeholder="Paste the full job description…" className="w-full bg-[#0A0A0F] border border-white/8 rounded-2xl p-5 text-white text-sm outline-none focus:border-blue-500/40 resize-none placeholder:text-slate-700 transition-all" />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] block mb-2">Select Resume</label>
                <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)} className="w-full bg-[#0A0A0F] border border-white/8 rounded-2xl p-4 text-white text-sm outline-none focus:border-blue-500/40 transition-all">
                  {history.length === 0 && <option value="">No resumes — paste job description only</option>}
                  {history.map(g => <option key={g.id} value={g.id}>{g.name} ({g.versions?.length||0} versions)</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] block mb-3">Company Stage</label>
                <div className="flex flex-wrap gap-2">{['FAANG / Big Tech','Growth Startup (Series A-C)','Enterprise','Early Stage / Pre-seed'].map(s=>(
                  <button key={s} onClick={()=>setForm(f=>({...f,companyStage:s}))} className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border ${form.companyStage===s?'bg-blue-600 border-blue-600 text-white':'bg-[#0A0A0F] border-white/8 text-slate-500 hover:border-white/15 hover:text-white'}`}>{s}</button>
                ))}</div>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] block mb-3">Role Level</label>
                <div className="flex flex-wrap gap-2">{['Junior (IC3)','Mid (IC4)','Senior (IC5)','Staff+ (IC6)','Manager'].map(s=>(
                  <button key={s} onClick={()=>setForm(f=>({...f,roleLevel:s}))} className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border ${form.roleLevel===s?'bg-indigo-600 border-indigo-600 text-white':'bg-[#0A0A0F] border-white/8 text-slate-500 hover:border-white/15 hover:text-white'}`}>{s}</button>
                ))}</div>
              </div>
              {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-2xl p-4">{error}</p>}
              <button onClick={generate} disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-sm shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3 transition-all">
                {loading ? <><Loader2 size={18} className="animate-spin" />{loadMsg}</> : <><Sparkles size={18} />Generate Prep Kit</>}
              </button>
            </div>
          </div>
          <div className="lg:col-span-4">
            <div className="bg-[#16161E] border border-white/5 rounded-[2rem] p-7">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6">What You Get</p>
              {[['📞 Recruiter Screen','5 questions + salary anchor script'],['🧑 HM Screen','6 JD-extracted questions + resume anchors'],['⚙️ Technical','Detected round type + calibrated questions'],['⭐ Behavioral (STAR)','12 questions pre-filled from YOUR resume'],['❓ Ask Them','10 smart questions that signal preparation']].map(([t,d])=>(
                <div key={t} className="flex gap-3 mb-5 last:mb-0">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0"/>
                  <div><p className="text-white font-black text-xs">{t}</p><p className="text-slate-600 text-[10px] mt-0.5">{d}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div id="prep-export">
          <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-1">
            {[`📞 Recruiter Screen`,`🧑 HM Screen`,`⚙️ Technical`,`⭐ Behavioral (${doneCount}/12)`,`❓ Ask Them`].map((label,i)=>(
              <button key={i} onClick={()=>setTab(i)} className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest whitespace-nowrap transition-all ${tab===i?'bg-blue-600 text-white shadow-lg shadow-blue-500/20':'bg-[#16161E] text-slate-400 border border-white/5 hover:text-white hover:border-white/10'}`}>{label}</button>
            ))}
          </div>

          {/* TAB 0 — Recruiter Screen */}
          {tab===0 && <div className="space-y-5">
            {kit.salaryAnchor && (
              <div className="bg-violet-500/10 border border-violet-500/30 rounded-[2rem] p-7">
                <p className="text-[8px] font-black text-violet-400 uppercase tracking-widest mb-2">💰 Salary Anchor — Say This Exactly</p>
                <p className="text-white font-black text-lg mb-1">{kit.salaryAnchor.range}</p>
                <p className="text-slate-300 text-sm leading-relaxed italic">"{kit.salaryAnchor.script}"</p>
              </div>
            )}
            {kit.recruiterScreen?.map((q,i)=>(
              <div key={i} className="bg-[#16161E] border border-white/5 rounded-[2rem] p-8 hover:border-white/10 transition-all">
                <p className="text-white font-black text-base mb-5">{q.question}</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="border-l-4 border-amber-500 pl-4 py-2"><p className="text-[7px] font-black text-amber-400 uppercase tracking-widest mb-1">Why They Ask</p><p className="text-slate-300 text-xs leading-relaxed italic">{q.whyAsked}</p></div>
                  <div className="border-l-4 border-blue-500 pl-4 py-2"><p className="text-[7px] font-black text-blue-400 uppercase tracking-widest mb-1">Coached Answer</p>{q.framework?.map((f,j)=><p key={j} className="text-slate-300 text-xs">• {f}</p>)}</div>
                  <div className="border-l-4 border-red-500 pl-4 py-2"><p className="text-[7px] font-black text-red-400 uppercase tracking-widest mb-1">Do Not Say</p>{q.avoid?.map((a,j)=><p key={j} className="text-slate-400 text-xs line-through">✗ {a}</p>)}</div>
                </div>
              </div>
            ))}
          </div>}

          {/* TAB 1 — HM Screen */}
          {tab===1 && <div className="space-y-5">
            {kit.hmScreen?.map((q,i)=>(
              <div key={i} className="bg-[#16161E] border border-white/5 rounded-[2rem] p-8 hover:border-white/10 transition-all">
                <p className="text-white font-black text-base mb-2">{q.question}</p>
                {q.followUp && <p className="text-indigo-300 text-[10px] font-bold bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-3 py-1.5 inline-block mb-4">Follow-up: "{q.followUp}"</p>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4"><p className="text-[7px] font-black text-amber-400 uppercase tracking-widest mb-2">📌 Reference From Your Resume</p><p className="text-slate-300 text-xs leading-relaxed">{q.resumeAnchor}</p></div>
                  <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4"><p className="text-[7px] font-black text-blue-400 uppercase tracking-widest mb-2">Answer Framework</p>{q.framework?.map((f,j)=><p key={j} className="text-slate-300 text-xs">• {f}</p>)}</div>
                </div>
              </div>
            ))}
          </div>}

          {/* TAB 2 — Technical */}
          {tab===2 && <div className="space-y-5">
            {kit.technical && (
              <div className={`rounded-[2rem] p-7 border flex items-center gap-5 ${kit.technical.detectedType==='CODING'?'bg-blue-500/10 border-blue-500/30':kit.technical.detectedType==='SYSTEM_DESIGN'?'bg-indigo-500/10 border-indigo-500/30':kit.technical.detectedType==='TAKE_HOME'?'bg-amber-500/10 border-amber-500/30':'bg-green-500/10 border-green-500/30'}`}>
                <span className="text-4xl">{kit.technical.detectedType==='CODING'?'💻':kit.technical.detectedType==='SYSTEM_DESIGN'?'🏗️':kit.technical.detectedType==='TAKE_HOME'?'🏠':'📊'}</span>
                <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Detected Interview Type</p><p className="text-white font-black text-2xl">{kit.technical.detectedType?.replace('_',' ')}</p></div>
              </div>
            )}
            {kit.technical?.questions?.map((q,i)=>(
              <div key={i} className="bg-[#16161E] border border-white/5 rounded-[2rem] p-7 hover:border-white/10 transition-all">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <p className="text-white font-black text-sm">{q.question}</p>
                  <LBadge pct={q.likelihood} />
                </div>
                {q.keyPoints?.length>0 && <div className="mb-3"><p className="text-[7px] font-black text-blue-400 uppercase tracking-widest mb-2">Key Points to Cover</p>{q.keyPoints.map((k,j)=><p key={j} className="text-slate-300 text-xs">• {k}</p>)}</div>}
                {q.tradeoffs?.length>0 && <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-4 mt-2"><p className="text-[7px] font-black text-indigo-400 uppercase tracking-widest mb-2">Tradeoffs to Mention</p>{q.tradeoffs.map((t,j)=><p key={j} className="text-slate-300 text-xs">⇄ {t}</p>)}</div>}
              </div>
            ))}
          </div>}

          {/* TAB 3 — Behavioral STAR */}
          {tab===3 && <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">S+T pre-filled from your resume — you fill A+R</p>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5"><span className="text-[10px] font-black text-blue-400">{doneCount}/12 complete</span></div>
            </div>
            {BEHAVIORAL_QS.map((q,i)=>{
              const pf = kit.behavioral?.[i]?.preFilled || { situation: '', task: '' };
              const ans = stars[i] || { action:'', result:'' };
              const done = !!(ans.action && ans.result);
              const saved = savedKeys.has(i);
              return (
                <div key={i} className={`bg-[#16161E] border rounded-[2rem] p-7 transition-all ${done?'border-green-500/30':saved?'border-blue-500/20':'border-white/5 hover:border-white/10'}`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${done?'bg-green-500/20 text-green-400':'bg-violet-500/10 text-violet-400'}`}>{done?'✓':i+1}</div>
                    <p className="text-white font-black text-sm">{q}</p>
                    <span className="ml-auto text-[7px] font-black bg-white/5 text-slate-500 px-2 py-0.5 rounded uppercase">FAANG {FAANG_FREQ[i]}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4"><p className="text-[7px] font-black text-blue-400 uppercase tracking-widest mb-1">S — Situation (AI)</p><p className="text-slate-300 text-xs leading-relaxed">{pf.situation || 'Will be pre-filled from your resume after generation.'}</p></div>
                    <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4"><p className="text-[7px] font-black text-blue-400 uppercase tracking-widest mb-1">T — Task (AI)</p><p className="text-slate-300 text-xs leading-relaxed">{pf.task || 'Will be pre-filled from your resume after generation.'}</p></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div><p className="text-[7px] font-black text-green-400 uppercase tracking-widest mb-1.5">A — Your Action</p><textarea value={ans.action} onChange={e=>saveStar(i,'action',e.target.value)} rows={3} placeholder="What specific actions did YOU take?" className="w-full bg-[#0A0A0F] border border-white/8 rounded-xl p-3 text-white text-xs outline-none focus:border-green-500/30 resize-none placeholder:text-slate-700"/></div>
                    <div><p className="text-[7px] font-black text-amber-400 uppercase tracking-widest mb-1.5">R — Your Result</p><textarea value={ans.result} onChange={e=>saveStar(i,'result',e.target.value)} rows={3} placeholder="What was the measurable outcome?" className="w-full bg-[#0A0A0F] border border-white/8 rounded-xl p-3 text-white text-xs outline-none focus:border-amber-500/30 resize-none placeholder:text-slate-700"/></div>
                  </div>
                  <button onClick={()=>markSaved(i)} className={`flex items-center gap-2 py-2 px-4 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${saved?'bg-green-500/10 text-green-400 border border-green-500/20':'bg-white/5 text-slate-500 border border-white/5 hover:border-white/10 hover:text-white'}`}><Check size={12}/>{saved?'Saved':'Save Answer'}</button>
                </div>
              );
            })}
          </div>}

          {/* TAB 4 — Questions to Ask */}
          {tab===4 && <div className="space-y-4">
            {['Role Clarity','Team Dynamics','Culture','Technical Direction','Growth'].map(cat=>{
              const qs = kit.questionsToAsk?.filter(q=>q.category===cat)||[];
              if(!qs.length) return null;
              return (
                <div key={cat} className="bg-[#16161E] border border-white/5 rounded-[2rem] p-7 hover:border-white/10 transition-all">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.25em] mb-4">{cat}</p>
                  <div className="space-y-4">
                    {qs.map((q,i)=>(
                      <div key={i}>
                        <div className="flex items-start gap-3">
                          {q.mustAsk && <span className="text-[7px] font-black bg-amber-500/20 text-amber-400 px-2 py-1 rounded uppercase tracking-widest shrink-0 mt-0.5">Must Ask</span>}
                          <p className="text-slate-200 text-sm">{q.question}</p>
                        </div>
                        {q.whyItWorks && <p className="text-slate-600 text-[10px] mt-1.5 ml-0 italic">{q.whyItWorks}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>}
        </div>
      )}
    </div>
  );
};
