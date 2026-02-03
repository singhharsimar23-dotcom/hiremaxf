
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, 
  ArrowRight, 
  ArrowLeft, 
  Loader2, 
  Activity, 
  TrendingUp, 
  Zap, 
  AlertCircle, 
  ShieldAlert, 
  Fingerprint, 
  Cpu, 
  Workflow,
  BarChart3,
  Binary,
  Timer,
  Scale,
  Stamp,
  Shield,
  Gavel, 
  CheckCircle2, 
  XCircle, 
  Lock, 
  FileText, 
  AlertTriangle, 
  History, 
  ShieldX, 
  Terminal, 
  Target, 
  Send, 
  Flag, 
  CalendarDays, 
  Crosshair, 
  Key, 
  Plus,
  RefreshCw,
  Eye,
  Radar,
  ArrowDownCircle,
  AlertOctagon,
  Factory,
  FastForward,
  Clock
} from 'lucide-react';
import { DiagnosticResult, UserPlan, MarketCommandSnapshot, AppView, BackgroundJob, JobType } from '../types';

interface CareerIntelligenceViewProps {
  analysisResult: DiagnosticResult | null;
  resumeText: string;
  plan: UserPlan;
  setView: (v: AppView) => void;
  activeJobs: Record<string, BackgroundJob>;
  dispatchJob: (type: JobType, payload: any) => Promise<string>;
}

const CACHE_KEY = 'hiremax_market_snapshot';

const getRelativeTime = (timestamp: string) => {
  const now = new Date();
  const past = new Date(timestamp);
  const diffInMs = now.getTime() - past.getTime();
  const diffInMins = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMins / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInDays > 0) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  if (diffInHours > 0) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  if (diffInMins > 0) return `${diffInMins} minute${diffInMins > 1 ? 's' : ''} ago`;
  return 'just now';
};

export const CareerIntelligenceView: React.FC<CareerIntelligenceViewProps> = ({ analysisResult, plan, setView, activeJobs, dispatchJob }) => {
  const [viewState, setViewState] = useState<'input' | 'processing' | 'snapshot' | 'quota_error'>('input');
  const [snapshot, setSnapshot] = useState<MarketCommandSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [targetRole, setTargetRole] = useState(analysisResult?.role || '');
  const [geography, setGeography] = useState('Remote / North America');
  const [expBand, setExpBand] = useState('Senior (5-8 years)');

  // Background Job Logic
  const runningJobId = useMemo(() => {
    return Object.keys(activeJobs).find(id => activeJobs[id].type === 'OUTLOOK' && activeJobs[id].status === 'RUNNING');
  }, [activeJobs]);

  useEffect(() => {
    if (runningJobId) {
      setViewState('processing');
    }
  }, [runningJobId]);

  useEffect(() => {
    if (runningJobId) {
      const job = activeJobs[runningJobId];
      if (job.status === 'COMPLETED' && job.result) {
        const result = job.result;
        const newSnapshot: MarketCommandSnapshot = {
          id: `CMD-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
          timestamp: new Date().toISOString(),
          expiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          context: job.payload.context,
          ...result
        };
        setSnapshot(newSnapshot);
        localStorage.setItem(CACHE_KEY, JSON.stringify(newSnapshot));
        setViewState('snapshot');
      } else if (job.status === 'FAILED') {
        setViewState('input');
      }
    }
  }, [activeJobs, runningJobId]);

  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed: MarketCommandSnapshot = JSON.parse(cached);
        setSnapshot(parsed);
        setViewState('snapshot');
      } catch (e) {
        localStorage.removeItem(CACHE_KEY);
      }
    }
  }, []);

  const handleGenerate = async (isRefresh = false) => {
    if (!targetRole || !geography) return;
    
    setViewState('processing');
    setErrorMessage(null);

    const systemPrompt = `You are the HireMax Career Elite Market Command Engine.
    ISSUE A MARKET COMMAND SNAPSHOT.
    
    INPUT CONTEXT:
    Role: ${targetRole}
    Geography: ${geography}
    Experience: ${expBand}

    OUTPUT RULES (STRICT):
    1. MARKET STATUS: Decisive climate label (AGGRESSIVE, SELECTIVE, CAUTIOUS, or STAGNANT).
    2. EXECUTION TARGETS: 5-10 specific, real-world companies hiring for this role now. Include EXACT public role titles.
    3. DO NOT APPLY ZONE: Company types or roles to avoid based on current saturation or volatility.
    4. ACTION ORDERS: Strict 7-day and 30-day non-negotiable execution steps.
    5. NO ADVICE: No learning paths, no general career tips, no fluff. Execution only.

    Return JSON in exactly this structure:
    {
      "marketStatus": { "label": string, "implication": string },
      "executionTargets": [{ "company": string, "roleTitle": string, "fitReason": string, "confidence": number, "validityWindow": string }],
      "doNotApplyZone": [{ "entityType": string, "reasoning": string }],
      "actionOrders": { "next7Days": string[], "next30Days": string[], "positioningDirectives": string[], "interviewDirectives": string[] },
      "risks": { "uncertainty": string, "refreshCondition": string }
    }`;

    await dispatchJob('OUTLOOK', { prompt: systemPrompt, context: { role: targetRole, geography, expBand } });
  };

  const handleClearCache = () => {
    localStorage.removeItem(CACHE_KEY);
    setViewState('input');
  };

  if (plan !== 'Career Elite' && plan !== 'Automation') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-10">
        <Lock className="text-slate-700 mb-6" size={48} />
        <h2 className="text-xl font-black text-white uppercase tracking-widest">Elite Tier Authorization Required</h2>
        <p className="text-slate-500 text-sm mt-2 font-medium uppercase">Institutional Market Commands are restricted to Elite accounts.</p>
      </div>
    );
  }

  if (viewState === 'quota_error') {
    return (
      <div className="max-w-3xl mx-auto py-24 px-10 text-center">
        <Key size={48} className="text-amber-500 mx-auto mb-6" />
        <h2 className="text-3xl font-black text-white uppercase">Quota Exhausted</h2>
        <p className="text-slate-500 mt-4 mb-8">Shared infrastructure bandwidth reached. Authenticate with a private API key to maintain priority execution.</p>
        <button onClick={() => setViewState('input')} className="text-blue-500 font-black uppercase tracking-widest text-xs">Return to Terminal</button>
      </div>
    );
  }

  if (viewState === 'input') {
    return (
      <div className="max-w-4xl mx-auto py-24 px-10 space-y-12 animate-in fade-in duration-700">
        <div className="space-y-4">
           <div className="flex items-center gap-3 text-blue-500 bg-blue-500/5 w-fit px-4 py-1.5 rounded-full border border-blue-500/10">
              <Radar size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Directive Terminal</span>
           </div>
           <h2 className="text-5xl font-black text-white tracking-tighter uppercase leading-none">Operational Context</h2>
           <p className="text-slate-500 text-lg font-medium leading-relaxed max-w-2xl">
             Define your target perimeter. The system will generate a time-bound execution snapshot for the next 24 hours.
           </p>
        </div>

        <div className="bg-[#16161E] border border-[#1D1D26] rounded-[3rem] p-12 space-y-10 shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Target Designation</label>
              <input value={targetRole} onChange={e => setTargetRole(e.target.value)} placeholder="e.g. Senior Staff Backend Engineer" className="w-full bg-[#0D0D12] border border-[#2D313D] rounded-xl p-4 text-white outline-none focus:border-blue-500 font-bold" />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Geographic Focus</label>
              <input value={geography} onChange={e => setGeography(e.target.value)} placeholder="e.g. London / EMEA" className="w-full bg-[#0D0D12] border border-[#2D313D] rounded-xl p-4 text-white outline-none focus:border-blue-500 font-bold" />
            </div>
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Experience Tier</label>
            <select value={expBand} onChange={e => setExpBand(e.target.value)} className="w-full bg-[#0D0D12] border border-[#2D313D] rounded-xl p-4 text-white outline-none focus:border-blue-500 font-bold appearance-none">
              <option>Junior (0-2 years)</option>
              <option>Mid-Level (3-5 years)</option>
              <option>Senior (5-8 years)</option>
              <option>Staff / Lead (8+ years)</option>
            </select>
          </div>
          <button onClick={() => handleGenerate()} disabled={!targetRole || runningJobId !== undefined} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-6 rounded-3xl transition-all uppercase tracking-[0.2em] text-xs shadow-2xl flex items-center justify-center gap-3">
            Generate Market Command <ArrowRight size={18} />
          </button>
        </div>
      </div>
    );
  }

  if (viewState === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-10">
        <div className="relative">
          <Loader2 size={80} className="text-blue-500 animate-spin" strokeWidth={1.5} />
          <Target size={24} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white" />
        </div>
        <div className="text-center space-y-3">
          <h3 className="text-2xl font-black text-white uppercase tracking-tight">Synthesizing Market Signals</h3>
          <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Bypassing generic data layers...</p>
          <p className="text-slate-600 text-[10px] font-black uppercase tracking-[0.3em] mt-4">Execution continues in background...</p>
        </div>
      </div>
    );
  }

  if (viewState === 'snapshot' && snapshot) {
    const isExpired = new Date().getTime() > new Date(snapshot.expiry).getTime();

    return (
      <div className="max-w-[1200px] mx-auto py-12 px-10 animate-in fade-in duration-1000">
        {/* Command Header */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
           <div className="space-y-4">
              <div className="flex items-center gap-3">
                 <div className="bg-blue-600 px-3 py-1 rounded text-[10px] font-black text-white uppercase tracking-widest">Institutional Product</div>
                 <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">ID: {snapshot.id}</span>
                 <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    <Clock size={10} className="text-blue-500" />
                    Generated {getRelativeTime(snapshot.timestamp)}
                 </div>
              </div>
              <h2 className="text-6xl font-black text-white tracking-tighter uppercase leading-none">Market Command</h2>
              <div className="flex items-center gap-6">
                 <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Active Perimeter</span>
                    <span className="text-sm font-bold text-white uppercase">{snapshot.context.role} | {snapshot.context.geography}</span>
                 </div>
                 <div className="w-[1px] h-8 bg-white/10" />
                 <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Snapshot Validity</span>
                    <span className={`text-sm font-bold uppercase tracking-tight ${isExpired ? 'text-red-500' : 'text-amber-500'}`}>
                       {isExpired ? `EXPIRED: ${new Date(snapshot.expiry).toLocaleTimeString()}` : `EXPIRES: ${new Date(snapshot.expiry).toLocaleTimeString()}`}
                    </span>
                 </div>
              </div>
           </div>
           <button 
             onClick={() => handleGenerate(true)}
             className="flex items-center gap-2 text-slate-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest bg-[#16161E] border border-white/5 px-6 py-3 rounded-xl shadow-xl"
           >
             <RefreshCw size={14} /> Recalibrate Command
           </button>
        </div>

        {isExpired && (
          <div className="mb-12 p-6 bg-red-500/5 border border-red-500/20 rounded-[2rem] flex items-center justify-between animate-in fade-in duration-500">
             <div className="flex items-center gap-4">
                <AlertCircle className="text-red-500" size={24} />
                <div>
                   <p className="text-white font-black text-sm uppercase tracking-tight">Market Snapshot Stale</p>
                   <p className="text-slate-500 text-xs font-medium">This command perimeter has exceeded the 24H validity window. Recalibration is recommended for live accuracy.</p>
                </div>
             </div>
             <button onClick={() => setViewState('input')} className="text-blue-500 font-black text-[10px] uppercase tracking-widest hover:text-white transition-colors">
                Refresh Analysis →
             </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
           {/* Primary Intelligence (LEFT) */}
           <div className="lg:col-span-8 space-y-12">
              
              {/* 1. MARKET STATUS */}
              <div className="bg-[#111118] border-l-4 border-blue-600 p-10 rounded-r-[3rem] shadow-2xl space-y-6">
                 <div className="flex items-center gap-3 text-blue-500">
                    <Activity size={20} />
                    <h3 className="text-[11px] font-black uppercase tracking-[0.3em]">1. Market Status Directive</h3>
                 </div>
                 <div className="space-y-4">
                    <p className="text-4xl font-black text-white uppercase tracking-tighter">{snapshot.marketStatus.label} CLIMATE</p>
                    <p className="text-slate-400 text-lg font-medium leading-relaxed italic border-l-2 border-white/10 pl-6">
                      "{snapshot.marketStatus.implication}"
                    </p>
                 </div>
              </div>

              {/* 2. EXECUTION TARGETS */}
              <div className="space-y-6">
                 <div className="flex items-center justify-between px-2">
                    <h3 className="text-white font-black text-2xl uppercase tracking-tight">2. Execution Targets</h3>
                    <div className="flex items-center gap-3 text-green-500 bg-green-500/5 px-4 py-1.5 rounded-full border border-green-500/10">
                       <ShieldCheck size={14} />
                       <span className="text-[9px] font-black uppercase tracking-widest">Verified Headcount</span>
                    </div>
                 </div>
                 <div className="bg-[#111118] border border-[#1D1D26] rounded-[3rem] overflow-hidden shadow-2xl">
                    <div className="bg-[#16161E] px-10 py-4 border-b border-white/5 grid grid-cols-12 gap-4">
                       <div className="col-span-4 text-[9px] font-black text-slate-600 uppercase tracking-widest">Company / Role</div>
                       <div className="col-span-5 text-[9px] font-black text-slate-600 uppercase tracking-widest">Strategic Alignment</div>
                       <div className="col-span-3 text-right text-[9px] font-black text-slate-600 uppercase tracking-widest">Confidence</div>
                    </div>
                    <div className="p-4 space-y-2">
                       {snapshot.executionTargets.map((target, i) => (
                          <div key={i} className="grid grid-cols-12 gap-4 items-center p-8 bg-white/[0.02] border border-white/5 rounded-2xl group hover:bg-white/[0.04] transition-all">
                             <div className="col-span-4">
                                <p className="text-white font-black text-lg uppercase tracking-tight">{target.company}</p>
                                <p className="text-blue-500 text-[10px] font-bold uppercase tracking-widest mt-1">{target.roleTitle}</p>
                             </div>
                             <div className="col-span-5">
                                <p className="text-slate-400 text-xs font-medium leading-relaxed">"{target.fitReason}"</p>
                             </div>
                             <div className="col-span-3 text-right">
                                <div className="text-2xl font-black text-white">{target.confidence}%</div>
                                <p className="text-[9px] font-bold text-slate-600 uppercase">SIGNAL SCORE</p>
                             </div>
                          </div>
                       ))}
                    </div>
                 </div>
              </div>

              {/* 3. DO NOT APPLY ZONE */}
              <div className="bg-red-600/5 border border-red-500/20 p-12 rounded-[3rem] shadow-xl space-y-10 relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-10 opacity-[0.03] text-red-500 rotate-12">
                    <AlertOctagon size={200} />
                 </div>
                 <div className="relative z-10">
                    <div className="flex items-center gap-3 text-red-500 mb-8">
                       <ShieldX size={20} />
                       <h3 className="text-[11px] font-black uppercase tracking-[0.3em]">3. Exclusion Zone (No Entry)</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       {snapshot.doNotApplyZone.map((zone, i) => (
                          <div key={i} className="space-y-3">
                             <p className="text-red-500 font-black text-xs uppercase tracking-[0.1em] underline decoration-red-900 underline-offset-4">{zone.entityType}</p>
                             <p className="text-slate-400 text-sm font-medium leading-relaxed italic">
                                {zone.reasoning}
                             </p>
                          </div>
                       ))}
                    </div>
                 </div>
              </div>
           </div>

           {/* Execution Sidebar (RIGHT) */}
           <div className="lg:col-span-4 space-y-12">
              
              {/* RUN NEW ANALYSIS WIDGET */}
              <div className="bg-[#16161E] border border-white/5 p-10 rounded-[3rem] shadow-xl space-y-6 group hover:border-blue-500/30 transition-all">
                 <div className="flex items-center gap-3 text-blue-500">
                    <Target size={20} />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em]">Target Perimeter</h3>
                 </div>
                 <div className="space-y-4">
                    <p className="text-slate-400 text-xs font-medium leading-relaxed">Currently monitoring market deltas for Staff/Senior roles in your region.</p>
                    <button 
                      onClick={() => setViewState('input')}
                      className="w-full flex items-center justify-center gap-2 py-4 bg-[#0D0D12] border border-white/5 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-blue-600 hover:border-blue-500 transition-all group/btn"
                    >
                      <Plus size={14} /> Run New Market Analysis
                    </button>
                 </div>
              </div>

              {/* 4. ACTION ORDERS */}
              <div className="bg-blue-600 border border-blue-500 p-10 rounded-[3.5rem] shadow-2xl space-y-12 text-white relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                    <Send size={160} />
                 </div>
                 <div className="relative z-10 space-y-10">
                    <div className="flex items-center gap-3">
                       <Gavel size={24} />
                       <h3 className="text-xl font-black uppercase tracking-tighter">4. Action Orders</h3>
                    </div>

                    <div className="space-y-8">
                       <div className="space-y-4">
                          <p className="text-[10px] font-black text-blue-100 uppercase tracking-widest flex items-center gap-2">
                             <CalendarDays size={14} /> Next 7 Days (Tactical)
                          </p>
                          <div className="space-y-3">
                             {snapshot.actionOrders.next7Days.map((order, i) => (
                                <div key={i} className="flex gap-4 p-4 bg-white/10 rounded-2xl border border-white/5">
                                   <span className="font-black text-blue-200">0{i+1}</span>
                                   <p className="text-xs font-bold leading-relaxed">{order}</p>
                                </div>
                             ))}
                          </div>
                       </div>

                       <div className="space-y-4">
                          <p className="text-[10px] font-black text-blue-100 uppercase tracking-widest flex items-center gap-2">
                             <TrendingUp size={14} /> Next 30 Days (Strategic)
                          </p>
                          <div className="space-y-3">
                             {snapshot.actionOrders.next30Days.map((order, i) => (
                                <div key={i} className="flex gap-4 p-4 bg-white/5 rounded-2xl">
                                   <span className="font-black text-blue-300">0{i+1}</span>
                                   <p className="text-xs font-medium leading-relaxed opacity-80">{order}</p>
                                </div>
                             ))}
                          </div>
                       </div>
                    </div>
                 </div>
              </div>

              {/* SIGNAL DIRECTIVES */}
              <div className="bg-[#16161E] border border-white/5 p-10 rounded-[3rem] shadow-xl space-y-8">
                 <div className="flex items-center gap-3 text-indigo-500">
                    <Binary size={20} />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em]">Positioning Directives</h3>
                 </div>
                 <div className="space-y-6">
                    <div className="space-y-3">
                       <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Resume Layering</p>
                       {snapshot.actionOrders.positioningDirectives.map((dir, i) => (
                          <div key={i} className="flex items-start gap-3">
                             <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                             <p className="text-xs text-slate-300 font-bold leading-relaxed">{dir}</p>
                          </div>
                       ))}
                    </div>
                    <div className="h-[1px] bg-white/5" />
                    <div className="space-y-3">
                       <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Interview Defense</p>
                       {snapshot.actionOrders.interviewDirectives.map((dir, i) => (
                          <div key={i} className="flex items-start gap-3">
                             <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                             <p className="text-xs text-slate-300 font-bold leading-relaxed">{dir}</p>
                          </div>
                       ))}
                    </div>
                 </div>
              </div>

              {/* 5. RISK & EXPIRY */}
              <div className="p-10 border border-white/5 bg-[#0D0D12] rounded-[3rem] space-y-6">
                 <div className="flex items-center gap-3 text-slate-500">
                    <AlertTriangle size={20} />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em]">5. Risk Register</h3>
                 </div>
                 <div className="space-y-4">
                    <div>
                       <p className="text-[9px] font-black text-red-500/60 uppercase tracking-widest mb-1">Primary Uncertainty</p>
                       <p className="text-sm font-bold text-slate-400 italic">"{snapshot.risks.uncertainty}"</p>
                    </div>
                    <div className="pt-6 border-t border-white/5 flex items-center gap-4">
                       <Timer size={14} className="text-amber-500" />
                       <div>
                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Recalibrate if:</p>
                          <p className="text-[10px] font-black text-white">{snapshot.risks.refreshCondition}</p>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>

        {/* System Transition Widget */}
        <div className="mt-24 p-12 bg-[#111118] border border-blue-500/20 rounded-[3.5rem] shadow-2xl relative overflow-hidden group ring-1 ring-white/5">
          <div className="absolute top-0 right-0 p-10 opacity-[0.03] text-blue-500 pointer-events-none">
            <Factory size={160} />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
            <div className="max-w-2xl space-y-4 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-3 text-blue-500 mb-2">
                <FastForward size={18} />
                <h3 className="text-[10px] font-black uppercase tracking-[0.4em]">System Transition: Insight to Execution</h3>
              </div>
              <p className="text-white text-3xl font-black uppercase tracking-tight leading-none">Market Outlook Directive Complete</p>
              <p className="text-slate-500 text-base font-medium leading-relaxed">
                Market Outlook provided intelligence on role-level conditions. Automation Factory is the next logical step in the pipeline, utilizing your specific resume artifacts to orchestrate personalized applying, document rebuilding, and autonomous deployment loops.
              </p>
            </div>
            <button 
              onClick={() => setView('transformation-factory')}
              className="bg-blue-600 hover:bg-blue-500 text-white font-black py-6 px-12 rounded-2xl transition-all uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-blue-900/40 flex items-center justify-center gap-4 shrink-0 group-hover:scale-[1.02]"
            >
              Initialize Automation Factory <ArrowRight size={18} />
            </button>
          </div>
        </div>

        {/* Footer Terminal Stamp */}
        <div className="mt-20 pt-10 border-t border-white/5 flex justify-between items-center text-slate-800">
           <p className="text-[10px] font-black uppercase tracking-[0.8em]">Career Elite Command Terminal v5.2</p>
           <button onClick={handleClearCache} className="text-[9px] font-black uppercase tracking-widest hover:text-red-500 transition-colors">Clear Decision Cache</button>
        </div>
      </div>
    );
  }

  return null;
};
