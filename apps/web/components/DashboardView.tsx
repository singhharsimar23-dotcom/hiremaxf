import React, { useMemo, useState, useEffect } from 'react';
import { AppView, DiagnosticResult, UserPlan } from '../types';
import { supabase } from '../lib/supabase';
import {
  Sparkles, ShieldCheck, Briefcase, Linkedin, Mail, FileText,
  TrendingUp, Zap, ChevronRight, Clock, AlertTriangle, Check,
  BarChart2, Target, ArrowRight, Star, Activity, Instagram
} from 'lucide-react';

interface Props {
  currentAnalysis: DiagnosticResult | null;
  plan: UserPlan;
  onNavigate: (view: AppView) => void;
  user?: any;
  history?: any[];
}

const daysAgo = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000);

const ScoreRing: React.FC<{ score: number; size?: number }> = ({ score, size = 80 }) => {
  const r = size / 2 - 7; const c = 2 * Math.PI * r;
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#3b82f6';
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1f2937" strokeWidth="6"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} strokeLinecap="round"
        className="transition-all duration-1000"/>
    </svg>
  );
};

const JOURNEY: Array<{ id: string; step: number; label: string; desc: string; view: AppView; checkFn: (a: DiagnosticResult | null, apps: any[], hist: any[]) => boolean }> = [
  { id:'upload',   step:1, label:'Upload Resume',      desc:'Your foundation',                  view:'dashboard', checkFn:(a)=>!!a },
  { id:'rebuild',  step:2, label:'AI Rebuild',         desc:'FAANG-level rewrite',              view:'rebuild-standalone', checkFn:(a,_,h)=>h.length>0 },
  { id:'prep',     step:3, label:'Interview Prep Kit', desc:'Dominate every round',             view:'interview-prep', checkFn:()=>!!localStorage.getItem('hiremax_prep_kit') },
  { id:'letter',   step:4, label:'Cover Letter',       desc:'Evidence-based writing',           view:'cover-letter', checkFn:()=>false },
  { id:'tracker',  step:5, label:'Track Applications', desc:'Pipeline intelligence',            view:'tracker', checkFn:(_,apps)=>apps.length>0 },
  { id:'linkedin', step:6, label:'LinkedIn Optimize',  desc:'Rank in recruiter searches',      view:'linkedin-optimizer', checkFn:()=>false },
];

export const DashboardView: React.FC<Props> = ({ currentAnalysis, plan, onNavigate, user, history = [] }) => {
  const isPro = plan !== 'Starter';
  const [greeting, setGreeting] = useState('');
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [apps, setApps] = useState<any[]>([]);

  // Derive first name from user metadata
  const firstName = user?.user_metadata?.full_name?.split(' ')[0]
    || user?.user_metadata?.name?.split(' ')[0]
    || user?.email?.split('@')[0]
    || null;

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
    if (user) {
      // Fetch applications
      supabase.from('job_applications').select('*').eq('user_id', user.id).order('applied_at', { ascending: false }).then(({ data }) => setApps(data || []));
      
      // Fetch recent execution runs to build a live activity feed
      supabase.from('execution_runs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)
        .then(({ data }) => setRecentActivity(data || []));
    }
  }, [user]);

  const score = currentAnalysis?.overallScore || 0;
  const stepsCompleted = JOURNEY.filter(j => j.checkFn(currentAnalysis, apps, history)).length;
  const pct = Math.round((stepsCompleted / JOURNEY.length) * 100);

  // Calculate real streak based on consecutive days of activity (from apps or runs)
  const calculateStreak = () => {
    if (!apps.length && !recentActivity.length) return 0;
    // For now, return a derived heuristic based on recent activity volume
    return Math.min(7, Math.max(1, Math.floor((apps.length + recentActivity.length) / 2)));
  };
  const streak = calculateStreak();

  const activeApps = apps.filter(a => !['closed'].includes(a.status));
  const interviews = apps.filter(a => ['screening', 'interviewing', 'offer'].includes(a.status));
  const overdueFollowUps = apps.filter(a => { if (!a.follow_up_due_at) return false; return new Date(a.follow_up_due_at).getTime() < Date.now() && !['closed', 'offer'].includes(a.status); });
  const interviewRate = apps.length > 0 ? Math.round(interviews.length / apps.length * 100) : 0;

  const nextStep = JOURNEY.find(j => !j.checkFn(currentAnalysis, apps, history));

  const TOOLS = [
    { label: 'AI Rebuild', desc: 'Rewrite your resume to FAANG standard', view: 'rebuild-standalone' as AppView, icon: Sparkles, color: 'from-blue-600/20 to-blue-900/5', border: 'border-blue-500/20', iconColor: 'text-blue-400', locked: !isPro },
    { label: 'Interview Prep', desc: '5-tab kit built from your JD', view: 'interview-prep' as AppView, icon: ShieldCheck, color: 'from-violet-600/20 to-violet-900/5', border: 'border-violet-500/20', iconColor: 'text-violet-400', locked: !isPro },
    { label: 'Cover Letter', desc: 'Evidence-traced, never generic', view: 'cover-letter' as AppView, icon: FileText, color: 'from-emerald-600/20 to-emerald-900/5', border: 'border-emerald-500/20', iconColor: 'text-emerald-400', locked: false },
    { label: 'Job Tracker', desc: 'Kanban pipeline + follow-up AI', view: 'tracker' as AppView, icon: Briefcase, color: 'from-amber-600/20 to-amber-900/5', border: 'border-amber-500/20', iconColor: 'text-amber-400', locked: false },
    { label: 'LinkedIn Optimizer', desc: 'Rank in recruiter Boolean searches', view: 'linkedin-optimizer' as AppView, icon: Linkedin, color: 'from-sky-600/20 to-sky-900/5', border: 'border-sky-500/20', iconColor: 'text-sky-400', locked: !isPro },
    { label: 'Market Insights', desc: 'Real-time salary & hiring trends', view: 'career-intelligence' as AppView, icon: TrendingUp, color: 'from-indigo-600/20 to-indigo-900/5', border: 'border-indigo-500/20', iconColor: 'text-indigo-400', locked: true },
  ];

  return (
    <div className="max-w-[1400px] mx-auto px-8 py-10 animate-in fade-in duration-500">

      {/* Hero row */}
      <div className="flex items-start justify-between mb-10 gap-8">
        <div>
          <p className="text-slate-400 font-semibold text-sm mb-1">{greeting}{firstName ? `, ${firstName}` : ''} 👋</p>
          <h1 className="text-4xl font-black tracking-tighter text-white mb-3">
            {firstName ? `${firstName}'s` : 'Your'} Career <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">Command Center</span>
          </h1>
          {/* Momentum nudge */}
          {nextStep && (
            <button onClick={() => onNavigate(nextStep.view)} className="group flex items-center gap-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-2xl px-5 py-3 transition-all">
              <Zap size={14} className="text-blue-400 shrink-0"/>
              <p className="text-blue-300 text-sm font-bold">Next: <span className="text-white">{nextStep.label}</span> — {nextStep.desc}</p>
              <ChevronRight size={14} className="text-blue-400 group-hover:translate-x-1 transition-transform"/>
            </button>
          )}
        </div>
        {/* Score ring */}
        {score > 0 && (
          <div className="bg-[#16161E] border border-white/5 rounded-3xl p-6 flex items-center gap-5 shrink-0">
            <div className="relative">
              <ScoreRing score={score}/>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-white font-black text-xl leading-none">{score}</p>
                <p className="text-slate-600 text-[8px] font-black uppercase tracking-widest">/100</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Resume Score</p>
              <p className={`font-black text-lg ${score>=80?'text-green-400':score>=60?'text-amber-400':'text-blue-400'}`}>
                {score>=80?'FAANG-Ready':score>=60?'Competitive':'Needs Work'}
              </p>
              <button onClick={() => onNavigate('full-review')} className="text-xs font-semibold text-slate-500 hover:text-blue-400 transition-colors mt-1">View Analysis →</button>
            </div>
          </div>
        )}
      </div>

      {/* Journey progress */}
      <div className="bg-[#111118] border border-white/5 rounded-[2rem] p-7 mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Target size={16} className="text-blue-400"/>
            <p className="text-white font-black">Career Launch Journey</p>
            <span className="text-[8px] font-black bg-blue-500/10 text-blue-400 px-2 py-1 rounded-full border border-blue-500/20">{stepsCompleted}/{JOURNEY.length} complete</span>
          </div>
          <div className="flex items-center gap-2">
            <Activity size={12} className="text-amber-400"/>
            <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest">{streak}-day streak</p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-2 bg-white/5 rounded-full mb-6 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${pct}%` }}/>
        </div>
        {/* Steps */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {JOURNEY.map(j => {
            const done = j.checkFn(currentAnalysis, apps, history);
            const isNext = !done && JOURNEY.find(x => !x.checkFn(currentAnalysis, apps, history))?.id === j.id;
            return (
              <button key={j.id} onClick={() => onNavigate(j.view)}
                className={`flex flex-col items-start p-4 rounded-2xl border transition-all text-left group ${done ? 'bg-green-500/5 border-green-500/20' : isNext ? 'bg-blue-500/10 border-blue-500/30 hover:border-blue-500/50' : 'bg-white/2 border-white/5 hover:border-white/10'}`}>
                <div className={`w-7 h-7 rounded-xl flex items-center justify-center mb-3 ${done ? 'bg-green-500/20' : isNext ? 'bg-blue-500/20' : 'bg-white/5'}`}>
                  {done ? <Check size={12} className="text-green-400"/> : <span className="text-xs font-bold text-slate-400">{j.step}</span>}
                </div>
                <p className={`text-[10px] font-bold mb-0.5 ${done ? 'text-green-400' : isNext ? 'text-blue-300' : 'text-slate-400'}`}>{j.label}</p>
                <p className="text-[10px] text-slate-500 group-hover:text-slate-400 transition-colors">{j.desc}</p>
                {isNext && <p className="text-[10px] font-bold text-blue-400 mt-2">Start now →</p>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Pipeline + Urgency row */}
      {apps.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-[#111118] border border-white/5 rounded-[2rem] p-7">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2"><Briefcase size={14} className="text-amber-400"/><p className="text-white font-black">Job Pipeline</p></div>
              <button onClick={() => onNavigate('tracker')} className="text-sm font-semibold text-slate-400 hover:text-blue-400 transition-colors">Open Tracker →</button>
            </div>
            <div className="grid grid-cols-4 gap-3 mb-5">
              {[['Active',activeApps.length,'text-blue-400'],['Interviews',interviews.length,'text-amber-400'],['Offers',apps.filter(a=>a.status==='offer').length,'text-green-400'],['Interview Rate',`${interviewRate}%`,interviewRate>=20?'text-green-400':interviewRate>=10?'text-amber-400':'text-slate-400']].map(([l,v,c])=>(
                <div key={l as string} className="bg-[#0A0A0F] rounded-2xl p-4 text-center">
                  <p className={`font-black text-2xl ${c}`}>{v}</p>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mt-1">{l}</p>
                </div>
              ))}
            </div>
            {/* Recent apps */}
            <div className="space-y-2">
              {apps.slice(0, 3).map(a => (
                <div key={a.id} className="flex items-center gap-3 py-2 border-t border-white/5 first:border-0">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-[9px] ${['bg-blue-600','bg-violet-600','bg-emerald-600'][a.company_name.charCodeAt(0)%3]}`}>{a.company_name.slice(0,2).toUpperCase()}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm truncate">{a.company_name}</p>
                    <p className="text-slate-400 text-xs truncate">{a.role_title}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${a.status==='offer'?'bg-green-500/20 text-green-400':a.status==='interviewing'?'bg-amber-500/20 text-amber-400':a.status==='screening'?'bg-indigo-500/20 text-indigo-400':'bg-blue-500/20 text-blue-400'}`}>{a.status}</span>
                  <p className="text-slate-500 text-xs">{daysAgo(a.applied_at)}d</p>
                </div>
              ))}
            </div>
          </div>

          {/* Urgency panel & Activity */}
          <div className="bg-[#111118] border border-white/5 rounded-[2rem] p-7 flex flex-col gap-6">
            <div>
              <div className="flex items-center gap-2 mb-4"><AlertTriangle size={14} className="text-red-400"/><p className="text-white font-black">Action Required</p></div>
              {overdueFollowUps.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-4">
                  <div className="w-10 h-10 rounded-2xl bg-green-500/10 flex items-center justify-center mb-2"><Check size={16} className="text-green-400"/></div>
                  <p className="text-slate-400 text-xs mt-1">No overdue follow-ups</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {overdueFollowUps.slice(0, 2).map(a => (
                    <div key={a.id} className="bg-red-500/5 border border-red-500/15 rounded-2xl p-3 flex justify-between items-center">
                      <div>
                        <p className="text-white font-bold text-xs">{a.company_name}</p>
                        <p className="text-red-400 text-[8px] font-black uppercase mt-1">{daysAgo(a.follow_up_due_at||'')}d late</p>
                      </div>
                      <button onClick={() => onNavigate('tracker')} className="text-[9px] font-black text-red-400 hover:text-white uppercase">Open</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Live Activity Feed */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-4"><Activity size={14} className="text-blue-400"/><p className="text-white font-black">Engine Activity</p></div>
              {recentActivity.length === 0 ? (
                 <p className="text-slate-500 text-xs italic">No recent jobs executed.</p>
              ) : (
                <div className="space-y-3">
                  {recentActivity.slice(0, 3).map(run => (
                    <div key={run.id} className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${run.status === 'completed' ? 'bg-green-500' : run.status === 'failed' ? 'bg-red-500' : 'bg-blue-500 animate-pulse'}`} />
                      <div className="flex-1">
                        <p className="text-white text-xs font-semibold">{run.target_role || 'System Analysis'}</p>
                        <p className="text-slate-500 text-[9px] font-bold uppercase">{new Date(run.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md ${run.status === 'completed' ? 'bg-green-500/10 text-green-400' : run.status === 'failed' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>{run.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Instagram Community Banner */}
      <div className="bg-gradient-to-r from-[#180F2B] via-[#2A1137] to-[#2E1815] border border-pink-500/20 rounded-[2rem] p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-pink-500/5 rounded-full blur-3xl -z-10 group-hover:bg-pink-500/10 transition-colors duration-500" />
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center shrink-0 border border-purple-500/30 bg-[#0B0F1A] p-0.5">
            <img src="/favicon.png" alt="HireMax Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <span className="text-[9px] font-black uppercase tracking-widest text-pink-400 bg-pink-500/10 px-2.5 py-1 rounded-full border border-pink-500/25">Join the Community</span>
            <h3 className="text-xl font-black text-white tracking-tight mt-2 flex items-center gap-2">
              Follow HireMax on Instagram
            </h3>
            <p className="text-slate-400 text-xs mt-1 max-w-xl">
              Get daily resume rewrite secrets, Boolean search keywords for recruiters, salary negotiation scripts, and modern career OS updates!
            </p>
          </div>
        </div>
        <a
          href="https://www.instagram.com/hiremax.ai/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 hover:from-purple-500 hover:to-orange-400 text-white text-sm font-black transition-all transform hover:scale-[1.03] shadow-lg shadow-pink-500/25 shrink-0"
        >
          <Instagram size={16} />
          Follow @hiremax.ai
        </a>
      </div>

      {/* Tool grid */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Career Intelligence Tools</p>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{isPro ? 'Pro' : 'Starter'} Plan</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TOOLS.map(tool => {
          const Icon = tool.icon;
          return (
            <button key={tool.label} onClick={() => onNavigate(tool.view)}
              className={`group bg-gradient-to-br ${tool.color} border ${tool.border} rounded-[1.75rem] p-6 text-left transition-all hover:shadow-xl hover:-translate-y-1 relative overflow-hidden`}>
              <div className={`w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <Icon size={18} className={tool.iconColor}/>
              </div>
              <p className="text-white font-black text-base mb-1">{tool.label}</p>
              <p className="text-slate-400 text-sm">{tool.desc}</p>
              {tool.locked && <div className="absolute top-4 right-4 bg-amber-500/20 border border-amber-500/30 rounded-lg px-2 py-1"><p className="text-xs font-bold text-amber-400">Pro</p></div>}
              <div className="flex items-center gap-1 mt-4"><p className="text-xs font-semibold text-slate-500 group-hover:text-slate-300 transition-colors">Open</p><ArrowRight size={12} className="text-slate-500 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all"/></div>
            </button>
          );
        })}
      </div>

      {/* Upload CTA if no resume */}
      {!currentAnalysis && (
        <div className="mt-8 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 border border-blue-500/20 rounded-[2rem] p-10 text-center">
          <div className="w-16 h-16 rounded-3xl bg-blue-500/20 flex items-center justify-center mx-auto mb-4"><Sparkles size={28} className="text-blue-400"/></div>
          <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">Start Your Career Launch</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">Upload your resume to unlock a full AI diagnostic, score, and personalized career intelligence across all 6 modules.</p>
          <button onClick={() => onNavigate('ai-review')} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black px-10 py-4 rounded-2xl uppercase tracking-widest text-sm shadow-xl shadow-blue-500/20 hover:opacity-90 transition-all">Upload Resume & Get Score →</button>
        </div>
      )}
    </div>
  );
};
