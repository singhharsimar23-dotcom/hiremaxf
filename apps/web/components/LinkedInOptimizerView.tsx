import React, { useState } from 'react';
import { Linkedin, Sparkles, Lock, Loader2, Copy, Check, Download, RefreshCw, AlertCircle, ArrowRight, Star } from 'lucide-react';
import { UserPlan, ResumeGroup, JobType, BackgroundJob } from '../types';

interface LinkedInResult {
  headline: { text: string; keywords: string[]; searchableKeywordCount: number };
  about: { hook: string; full: string; keywordCount: number };
  experienceBullets: Array<{ role: string; company: string; original: string; optimized: string; keywordsAdded: string[] }>;
  skills: Array<{ skill: string; searchVolume: 'HIGH'|'MEDIUM'|'LOW'; rank: number }>;
  discoverabilityScore: { before: number; after: number; delta: number };
  missingFromCurrentHeadline: string[];
}

interface Props { plan: UserPlan; history: ResumeGroup[]; user: any; onUpgrade: () => void; setView?: (v: any) => void; dispatchJob: (type: JobType, payload: any) => Promise<string>; activeJobs: Record<string, BackgroundJob>; }

const VolBadge: React.FC<{v:string}> = ({v}) => (
  <span className={`text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${v==='HIGH'?'bg-green-500/20 text-green-400':v==='MEDIUM'?'bg-amber-500/20 text-amber-400':'bg-slate-700 text-slate-400'}`}>{v}</span>
);

const ScoreGauge: React.FC<{score:number; label:string; color:string}> = ({score,label,color}) => {
  const r=36; const c=2*Math.PI*r;
  return (
    <div className="flex flex-col items-center">
      <svg width="88" height="88" className="-rotate-90">
        <circle cx="44" cy="44" r={r} fill="none" stroke="#1f2937" strokeWidth="7"/>
        <circle cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="7" strokeDasharray={c} strokeDashoffset={c*(1-score/100)} strokeLinecap="round" className="transition-all duration-1000"/>
      </svg>
      <div className="-mt-12 z-10 relative text-center">
        <p className="text-xl font-black text-white">{score}</p>
        <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest">{label}</p>
      </div>
    </div>
  );
};

export const LinkedInOptimizerView: React.FC<Props> = ({ plan, history, user, onUpgrade, setView, dispatchJob, activeJobs }) => {
  const isPro = plan !== 'Starter';
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState('');
  const [result, setResult] = useState<LinkedInResult|null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string|null>(null);
  const [trackingJobId, setTrackingJobId] = useState<string | null>(null);
  const [form, setForm] = useState({ targetRole:'', currentHeadline:'', yearsExperience:5, selectedGroup:'', currentAbout:'' });

  const resumeText = (() => {
    const g = history.find(h=>h.id===form.selectedGroup)||history[0];
    const v = g?.versions?.[g.versions.length-1];
    if (!v?.data) return '';
    const d = v.data;
    return [d.contact?.full_name, d.summary, ...(d.experience||[]).map((e:any)=>`${e.title} at ${e.organization}: ${e.bullets?.join('; ')}`), ...(d.skills?Object.values(d.skills).flat():[])].filter(Boolean).join('\n');
  })();

  React.useEffect(() => {
    if (!trackingJobId) return;
    const activeJob = activeJobs[trackingJobId];
    if (!activeJob) return;

    if (activeJob.status === 'RUNNING') {
      setLoading(true);
    } else if (activeJob.status === 'COMPLETED' && activeJob.result) {
      setResult(activeJob.result);
      setTrackingJobId(null);
      setLoading(false);
    } else if (activeJob.status === 'FAILED') {
      setError(activeJob.error || 'Optimization failed.');
      setTrackingJobId(null);
      setLoading(false);
    }
  }, [activeJobs, trackingJobId]);

  const generate = async () => {
    if (!isPro) { onUpgrade(); return; }
    if (!form.targetRole.trim()) { setError('Enter your target role.'); return; }
    setLoading(true); setError('');
    const msgs = ['Analyzing LinkedIn search patterns…','Generating keyword-dense headline…','Ranking 50 skills by search volume…'];
    let i=0; const iv=setInterval(()=>setLoadMsg(msgs[i++%msgs.length]),1800);
    try {
      const jobId = await dispatchJob('LINKEDIN', {
        targetRole: form.targetRole,
        yearsExperience: form.yearsExperience,
        resumeText: resumeText || 'No resume provided.',
        currentHeadline: form.currentHeadline || 'None provided.',
        currentAbout: form.currentAbout || 'None provided.'
      });
      setTrackingJobId(jobId);
    } catch(err:any) { 
      setError(err.message||'Optimization failed. Try again.'); 
      setLoading(false);
    } finally { 
      clearInterval(iv); 
    }
  };

  const copy = (text:string, key:string) => {
    navigator.clipboard.writeText(text).then(()=>{ setCopied(key); setTimeout(()=>setCopied(null),2000); });
  };

  const exportGuide = () => {
    if (!result) return;
    const w=window.open('','_blank'); if(!w) return;
    w.document.write(`<html><head><title>LinkedIn Profile Guide — ${form.targetRole}</title><style>body{font-family:sans-serif;padding:48px;max-width:760px;margin:0 auto;font-size:13px;line-height:1.7;color:#111}h2{font-size:17px;font-weight:900;border-bottom:2px solid #e5e7eb;padding-bottom:6px;margin:28px 0 12px}p{margin:8px 0}.kw{display:inline-block;background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;margin:2px}</style></head><body>
    <h1 style="font-size:22px;font-weight:900;">LinkedIn Profile Guide — ${form.targetRole}</h1>
    <h2>Optimized Headline</h2><p>${result.headline.text}</p>
    <h2>About Section</h2><p><strong>Hook:</strong> ${result.about.hook}</p><p>${result.about.full}</p>
    <h2>Top 20 Skills to Add</h2><p>${result.skills.slice(0,20).map(s=>`<span class="kw">${s.rank}. ${s.skill} [${s.searchVolume}]</span>`).join('')}</p>
    <h2>Experience Rewrites</h2>${result.experienceBullets.map(b=>`<p><strong>${b.role} @ ${b.company}</strong><br/><del>${b.original}</del><br/>✓ ${b.optimized}</p>`).join('')}
    <script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close();
  };

  if (!isPro) return (
    <div className="max-w-[700px] mx-auto py-24 px-8 flex flex-col items-center gap-6 text-center">
      <div className="w-20 h-20 rounded-3xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center"><Linkedin size={32} className="text-blue-400"/></div>
      <div className="w-14 h-14 -mt-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center"><Lock size={24} className="text-amber-500"/></div>
      <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Pro Feature</h2>
      <p className="text-slate-400 max-w-md">LinkedIn Optimizer shows exactly which keywords recruiters search, where to place them, and ranks 50 skills by search volume. Makes Teal and Jobscan obsolete.</p>
      <button onClick={onUpgrade} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black px-10 py-4 rounded-2xl uppercase tracking-widest text-sm shadow-xl shadow-blue-500/20 hover:opacity-90 transition-all">Upgrade to Pro →</button>
    </div>
  );

  return (
    <div className="max-w-[1400px] mx-auto py-14 px-8 animate-in fade-in duration-500">
      <div className="flex items-start justify-between mb-10">
        <div>
          <div className="flex items-center gap-2 mb-3"><Linkedin size={13} className="text-blue-400"/><span className="text-[9px] font-black text-blue-400 uppercase tracking-widest bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">LinkedIn SEO Engine</span></div>
          <h2 className="text-5xl font-black tracking-tighter uppercase bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 mb-2">Profile Optimizer</h2>
          <p className="text-slate-400">LinkedIn is a search engine. We show you exactly how to rank.</p>
        </div>
        {result&&(
          <div className="flex gap-2">
            <button onClick={exportGuide} className="flex items-center gap-2 bg-[#1A1D26] border border-white/10 text-white px-4 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-white/5 transition-all"><Download size={13}/>Export Guide</button>
            <button onClick={()=>setResult(null)} className="flex items-center gap-2 bg-[#1A1D26] border border-white/10 text-slate-400 px-4 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest hover:text-white transition-all"><RefreshCw size={13}/>New Opt.</button>
          </div>
        )}
      </div>

      {!result ? (
        <div className="max-w-[900px] bg-[#111118] border border-white/5 rounded-[2rem] p-10 space-y-7">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] block mb-2">Target Role *</label>
              <input value={form.targetRole} onChange={e=>setForm(f=>({...f,targetRole:e.target.value}))} placeholder="Senior ML Engineer…" className="w-full bg-[#0A0A0F] border border-white/8 rounded-2xl p-4 text-white text-sm outline-none focus:border-blue-500/40 placeholder:text-slate-700 transition-all"/>
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] block mb-2">Years of Experience</label>
              <input type="number" min={1} max={25} value={form.yearsExperience} onChange={e=>setForm(f=>({...f,yearsExperience:parseInt(e.target.value)||1}))} className="w-full bg-[#0A0A0F] border border-white/8 rounded-2xl p-4 text-white text-sm outline-none focus:border-blue-500/40 transition-all"/>
            </div>
          </div>
          <div>
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] block mb-2">Current LinkedIn Headline <span className="normal-case font-normal text-slate-600">(220 char limit)</span></label>
            <input value={form.currentHeadline} onChange={e=>setForm(f=>({...f,currentHeadline:e.target.value.slice(0,220)}))} placeholder="Software Engineer at Acme Corp | React | Node.js" className="w-full bg-[#0A0A0F] border border-white/8 rounded-2xl p-4 text-white text-sm outline-none focus:border-blue-500/40 placeholder:text-slate-700 transition-all"/>
            <p className="text-[8px] text-slate-700 mt-1 text-right">{form.currentHeadline.length}/220</p>
          </div>
          <div>
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] block mb-2">Select Resume</label>
            <select value={form.selectedGroup} onChange={e=>setForm(f=>({...f,selectedGroup:e.target.value}))} className="w-full bg-[#0A0A0F] border border-white/8 rounded-2xl p-4 text-white text-sm outline-none focus:border-blue-500/40 transition-all">
              {history.length===0&&<option value="">No resumes saved — optimization uses target role only</option>}
              {history.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] block mb-2">Current About Section <span className="normal-case font-normal text-slate-600">(optional — for better personalization)</span></label>
            <textarea value={form.currentAbout} onChange={e=>setForm(f=>({...f,currentAbout:e.target.value}))} rows={4} placeholder="Paste your current LinkedIn about section here…" className="w-full bg-[#0A0A0F] border border-white/8 rounded-2xl p-4 text-white text-sm outline-none focus:border-blue-500/40 resize-none placeholder:text-slate-700 transition-all"/>
          </div>
          {error&&<div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl p-4"><AlertCircle size={15} className="text-red-400 shrink-0"/><p className="text-red-300 text-sm">{error}</p></div>}
          <button onClick={generate} disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-sm shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3 transition-all">
            {loading?<><Loader2 size={18} className="animate-spin"/>{loadMsg}</>:<><Linkedin size={18}/>Optimize My Profile →</>}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
            {/* SECTION 1: Headline */}
            <div className="bg-[#111118] border border-white/5 rounded-[2rem] p-8">
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-5">Section 1 — Headline</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="border border-red-500/20 bg-red-500/5 rounded-2xl p-5">
                  <p className="text-[7px] font-black text-red-400 uppercase tracking-widest mb-2">Current Headline</p>
                  <p className="text-slate-400 text-sm leading-relaxed mb-3 line-through opacity-60">{form.currentHeadline||'(none entered)'}</p>
                  <span className="text-[8px] font-black bg-red-500/10 text-red-300 px-2 py-1 rounded">{form.currentHeadline.length}/220 chars used</span>
                </div>
                <div className="border border-green-500/20 bg-green-500/5 rounded-2xl p-5">
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-[7px] font-black text-green-400 uppercase tracking-widest">Optimized Headline</p>
                    <button onClick={()=>copy(result.headline.text,'headline')} className="text-slate-600 hover:text-white transition-colors shrink-0">{copied==='headline'?<Check size={12} className="text-green-400"/>:<Copy size={12}/>}</button>
                  </div>
                  <p className="text-white font-black text-sm leading-relaxed mb-3">{result.headline.text}</p>
                  <span className="text-[8px] font-black bg-green-500/10 text-green-400 px-2 py-1 rounded">{result.headline.text.length}/220 — maximized</span>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-[7px] font-black text-blue-400 uppercase tracking-widest mb-2">Searchable Keywords ({result.headline.searchableKeywordCount})</p>
                <div className="flex flex-wrap gap-1.5">{result.headline.keywords.map(k=><span key={k} className="bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[8px] font-black px-2 py-1 rounded-lg uppercase">{k}</span>)}</div>
              </div>
              {result.missingFromCurrentHeadline?.length>0&&(
                <div className="mt-4"><p className="text-[7px] font-black text-red-400 uppercase tracking-widest mb-2">Missing From Your Headline</p><div className="flex flex-wrap gap-1.5">{result.missingFromCurrentHeadline.map(k=><span key={k} className="bg-red-500/10 border border-red-500/20 text-red-300 text-[8px] font-black px-2 py-1 rounded-lg">{k}</span>)}</div></div>
              )}
            </div>

            {/* SECTION 2: About */}
            <div className="bg-[#111118] border border-white/5 rounded-[2rem] p-8">
              <div className="flex items-center justify-between mb-5">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Section 2 — About Section</p>
                <div className="flex items-center gap-2">
                  <span className="text-[8px] font-black bg-blue-500/10 text-blue-400 px-2 py-1 rounded">{result.about.keywordCount} searchable keywords</span>
                  <button onClick={()=>copy(`${result.about.hook}\n\n${result.about.full}`,'about')} className="text-slate-600 hover:text-white transition-colors">{copied==='about'?<Check size={13} className="text-green-400"/>:<Copy size={13}/>}</button>
                </div>
              </div>
              <div className="bg-blue-500/5 border-l-4 border-blue-500 pl-5 py-3 rounded-r-2xl mb-4">
                <p className="text-[7px] font-black text-blue-400 uppercase tracking-widest mb-1">Hook — visible before "See more"</p>
                <p className="text-white text-sm font-medium leading-relaxed">{result.about.hook}</p>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">{result.about.full}</p>
            </div>

            {/* SECTION 3: Experience */}
            <div className="bg-[#111118] border border-white/5 rounded-[2rem] p-8">
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-5">Section 3 — Experience Bullet Rewrites</p>
              <div className="space-y-6">
                {result.experienceBullets.map((exp,i)=>(
                  <div key={i} className="pb-6 border-b border-white/5 last:border-0 last:pb-0">
                    <p className="text-white font-black text-sm mb-3">{exp.role} <span className="text-slate-500 font-normal">@ {exp.company}</span></p>
                    <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4 mb-2"><p className="text-[7px] font-black text-red-400 uppercase tracking-widest mb-1">Before</p><p className="text-slate-500 text-xs line-through">{exp.original}</p></div>
                    <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4">
                      <p className="text-[7px] font-black text-green-400 uppercase tracking-widest mb-1">After</p>
                      <p className="text-white text-xs leading-relaxed mb-2">{exp.optimized}</p>
                      <div className="flex flex-wrap gap-1">{exp.keywordsAdded.map(k=><span key={k} className="bg-green-500/10 text-green-300 text-[7px] font-black px-2 py-0.5 rounded uppercase tracking-widest">+{k}</span>)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION 4: Skills */}
            <div className="bg-[#111118] border border-white/5 rounded-[2rem] p-8">
              <div className="flex items-center justify-between mb-2">
                <div><p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Section 4 — Add These 50 Skills · In This Order</p><p className="text-[9px] text-slate-600">Top 3 are featured on your profile — highest search volume first</p></div>
                <button onClick={()=>copy(result.skills.map(s=>s.skill).join('\n'),'skills')} className="flex items-center gap-1.5 text-[8px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-colors">{copied==='skills'?<Check size={10} className="text-green-400"/>:<Copy size={10}/>}Copy All</button>
              </div>
              <div className="mt-5 space-y-1.5">
                {result.skills.slice(0,3).length>0&&<p className="text-[7px] font-black text-amber-400 uppercase tracking-widest mb-2">🔴 Featured Skills — Put These First</p>}
                {result.skills.slice(0,3).map((s,i)=>(
                  <div key={s.skill} className="flex items-center justify-between bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-2.5">
                    <div className="flex items-center gap-3"><span className="text-[8px] font-black text-amber-400 w-4">#{s.rank}</span><p className="text-white font-black text-sm">{s.skill}</p><Star size={10} className="text-amber-400 fill-amber-400"/><Star size={10} className="text-amber-400 fill-amber-400"/><Star size={10} className="text-amber-400 fill-amber-400"/></div>
                    <VolBadge v={s.searchVolume}/>
                  </div>
                ))}
                {result.skills.slice(3,20).length>0&&<p className="text-[7px] font-black text-green-400 uppercase tracking-widest mb-2 mt-4">🟡 High Search Volume</p>}
                {result.skills.slice(3,20).map(s=>(
                  <div key={s.skill} className="flex items-center justify-between bg-white/3 rounded-xl px-4 py-2">
                    <div className="flex items-center gap-3"><span className="text-[8px] font-black text-slate-600 w-4">#{s.rank}</span><p className="text-slate-200 text-sm">{s.skill}</p></div>
                    <VolBadge v={s.searchVolume}/>
                  </div>
                ))}
                {result.skills.slice(20).length>0&&<p className="text-[7px] font-black text-slate-600 uppercase tracking-widest mb-2 mt-4">⚪ Medium Volume — Fill to 50</p>}
                {result.skills.slice(20).map(s=>(
                  <div key={s.skill} className="flex items-center justify-between px-4 py-1.5">
                    <div className="flex items-center gap-3"><span className="text-[8px] font-black text-slate-700 w-4">#{s.rank}</span><p className="text-slate-500 text-xs">{s.skill}</p></div>
                    <VolBadge v={s.searchVolume}/>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="lg:col-span-4">
            <div className="bg-[#16161E] border border-white/5 rounded-[2rem] p-7 sticky top-24 space-y-6">
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.25em]">Discoverability Score</p>
              <div className="flex items-center justify-around">
                <ScoreGauge score={result.discoverabilityScore.before} label="Before" color="#ef4444"/>
                <div className="text-center"><p className="text-2xl font-black text-green-400">+{result.discoverabilityScore.delta}%</p><p className="text-[7px] font-black text-slate-600 uppercase tracking-widest">recruiter visibility</p></div>
                <ScoreGauge score={result.discoverabilityScore.after} label="After" color="#22c55e"/>
              </div>

              {/* Completeness */}
              <div className="border-t border-white/5 pt-5">
                <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-3">All-Star Checklist</p>
                <p className="text-[8px] text-red-400 italic mb-3">All-Star status required to appear in recruiter searches.</p>
                {[['Professional photo',true],['Optimized headline',true],['About section',true],['3+ experience entries', (history[0]?.versions?.[0]?.data?.experience?.length||0)>=3],['50 skills',false],['Education',true]].map(([item,done])=>(
                  <div key={item as string} className="flex items-center gap-2 mb-2">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] ${done?'bg-green-500/20 text-green-400':'bg-red-500/10 text-red-400'}`}>{done?'✓':'✗'}</div>
                    <p className={`text-xs ${done?'text-slate-300':'text-slate-600'}`}>{item as string}</p>
                  </div>
                ))}
              </div>

              {setView&&(
                <button onClick={()=>setView('rebuild-standalone')} className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600/10 border border-blue-500/20 text-blue-400 hover:bg-blue-600/20 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all"><ArrowRight size={12}/>Apply to Resume Rebuild</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
