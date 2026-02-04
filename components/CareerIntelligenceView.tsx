import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ArrowRight, 
  Loader2, 
  TrendingUp, 
  Zap, 
  AlertCircle, 
  Cpu, 
  Stamp,
  Shield,
  Lock, 
  AlertTriangle, 
  RefreshCw,
  Radar, 
  AlertOctagon, 
  Clock, 
  Radio, 
  Send, 
  Target, 
  ShieldAlert, 
  Fingerprint, 
  History,
  // Added Activity to the lucide-react imports
  Activity
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

export const CareerIntelligenceView: React.FC<CareerIntelligenceViewProps> = ({ analysisResult, plan, setView, activeJobs, dispatchJob }) => {
  const [viewState, setViewState] = useState<'input' | 'processing' | 'snapshot'>('input');
  const [snapshot, setSnapshot] = useState<MarketCommandSnapshot | null>(null);
  
  const [targetRole, setTargetRole] = useState(analysisResult?.role || '');
  const [geography, setGeography] = useState('Remote / North America');
  const [expBand, setExpBand] = useState('Senior (5-8 years)');

  // 1. Initial Load: Check for cached results or active background jobs
  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    const runningJob = (Object.values(activeJobs) as BackgroundJob[]).find(j => j.type === 'OUTLOOK' && j.status === 'RUNNING');
    
    if (runningJob) {
      setViewState('processing');
      if (runningJob.payload.context) {
        setTargetRole(runningJob.payload.context.role);
        setGeography(runningJob.payload.context.geography);
      }
    } else if (cached) {
      try {
        const parsed: MarketCommandSnapshot = JSON.parse(cached);
        setSnapshot(parsed);
        setViewState('snapshot');
      } catch (e) {
        localStorage.removeItem(CACHE_KEY);
      }
    }
  }, []);

  // 2. Observer: React to job completion
  useEffect(() => {
    const activeJob = (Object.values(activeJobs) as BackgroundJob[]).find(j => j.type === 'OUTLOOK');
    
    if (activeJob) {
      if (activeJob.status === 'RUNNING') {
        setViewState('processing');
      } else if (activeJob.status === 'COMPLETED' && activeJob.result) {
        const result = activeJob.result;
        const newSnapshot: MarketCommandSnapshot = {
          id: `CMD-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
          timestamp: new Date().toISOString(),
          expiry: new Date(Date.now() + 4 * 60 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          context: activeJob.payload.context,
          ...result
        };
        setSnapshot(newSnapshot);
        localStorage.setItem(CACHE_KEY, JSON.stringify(newSnapshot));
        setViewState('snapshot');
      } else if (activeJob.status === 'FAILED') {
        if (viewState === 'processing') setViewState('input');
      }
    }
  }, [activeJobs]);

  const handleGenerate = async () => {
    if (!targetRole || !geography) return;
    setViewState('processing');

    const systemPrompt = `You are the HireMax Career Elite Market Command Engine.
    ISSUE A SYNTHETIC MARKET COMMAND PROJECTION.
    
    INPUT CONTEXT:
    Role: ${targetRole}
    Geography: ${geography}
    Experience: ${expBand}

    OUTPUT RULES (STRICT JSON):
    {
      "marketStatus": { "label": string, "implication": string },
      "executionTargets": [{ "company": string, "roleTitle": string, "fitReason": string, "confidence": number, "validityWindow": string }],
      "doNotApplyZone": [{ "entityType": string, "reasoning": string }],
      "actionOrders": { 
        "next7Days": string[], 
        "next30Days": string[], 
        "positioningDirectives": string[], 
        "interviewDirectives": string[] 
      },
      "risks": { "uncertainty": string, "refreshCondition": string }
    }`;

    await dispatchJob('OUTLOOK', { 
      prompt: systemPrompt, 
      context: { role: targetRole, geography, expBand } 
    });
  };

  const handleReset = () => {
    localStorage.removeItem(CACHE_KEY);
    setSnapshot(null);
    setViewState('input');
  };

  if (plan !== 'Career Elite' && plan !== 'Automation') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-10">
        <Lock className="text-slate-700 mb-6" size={48} />
        <h2 className="text-xl font-black text-white uppercase tracking-widest">Elite Tier Authorization Required</h2>
        <p className="text-slate-500 text-sm mt-2 font-medium uppercase italic leading-relaxed">
          Institutional Market Commands are restricted to Elite accounts.
        </p>
      </div>
    );
  }

  if (viewState === 'snapshot' && snapshot) {
    return (
      <div className="max-w-[1400px] mx-auto py-12 px-10 animate-in fade-in duration-1000">
        {/* TOP HEADER SECTION */}
        <div className="flex flex-col md:flex-row justify-between items-start mb-20 gap-8">
           <div className="space-y-6">
              <div className="flex items-center gap-4">
                 <div className="bg-blue-600 px-3 py-1 rounded text-[10px] font-black text-white uppercase tracking-widest shadow-lg shadow-blue-900/40">Institutional Product</div>
                 <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">ID: {snapshot.id}</span>
              </div>
              <h2 className="text-8xl font-black text-white tracking-tighter uppercase leading-none">Market Command</h2>
              <div className="flex items-center gap-12 pt-2">
                 <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Active Perimeter</span>
                    <span className="text-sm font-bold text-white uppercase tracking-tight">{snapshot.context.role} | {snapshot.context.geography}</span>
                 </div>
                 <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Snapshot Validity</span>
                    <span className="text-sm font-bold text-amber-500 uppercase tracking-tight">Expires: {snapshot.expiry}</span>
                 </div>
              </div>
           </div>
           <button 
            onClick={handleReset}
            className="flex items-center gap-3 text-slate-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-[0.2em] bg-white/5 px-8 py-4 rounded-xl border border-white/10 group"
           >
             <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-500" /> Recalibrate Command
           </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
           {/* LEFT COLUMN: PRIMARY DIRECTIVES */}
           <div className="lg:col-span-8 space-y-20">
              
              {/* 1. MARKET STATUS */}
              <div className="space-y-10">
                 <div className="flex items-center gap-4 text-blue-500">
                    <Activity size={24} />
                    <h3 className="text-xl font-black uppercase tracking-widest">1. Market Status Directive</h3>
                 </div>
                 <div className="bg-[#111118] border-l-4 border-blue-600 p-12 rounded-r-[3.5rem] shadow-2xl space-y-8 ring-1 ring-white/5">
                    <h4 className="text-6xl font-black text-white uppercase tracking-tighter leading-none">{snapshot.marketStatus.label}</h4>
                    <p className="text-slate-400 text-2xl font-medium leading-relaxed italic pl-8 border-l border-white/10">
                      "{snapshot.marketStatus.implication}"
                    </p>
                 </div>
              </div>

              {/* 2. EXECUTION TARGETS */}
              <div className="space-y-10">
                 <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-4 text-white">
                       <h3 className="text-xl font-black uppercase tracking-widest">2. Execution Targets</h3>
                    </div>
                    <div className="flex items-center gap-2 text-green-500 bg-green-500/5 px-4 py-1.5 rounded-full border border-green-500/10">
                       <ShieldCheck size={16} />
                       <span className="text-[10px] font-black uppercase tracking-widest">Verified Headcount</span>
                    </div>
                 </div>
                 <div className="bg-[#111118] border border-white/5 rounded-[3.5rem] overflow-hidden shadow-2xl p-8 space-y-4">
                    {snapshot.executionTargets.map((target, i) => (
                       <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center p-10 bg-white/[0.02] border border-white/5 rounded-[2.5rem] group hover:border-blue-500/30 transition-all hover:bg-white/[0.04]">
                          <div className="md:col-span-4 space-y-1">
                             <p className="text-white font-black text-3xl uppercase tracking-tight leading-none">{target.company}</p>
                             <p className="text-blue-500 text-[10px] font-black uppercase tracking-widest pt-1">{target.roleTitle}</p>
                          </div>
                          <div className="md:col-span-6">
                             <p className="text-slate-500 text-sm font-medium leading-relaxed italic">"{target.fitReason}"</p>
                          </div>
                          <div className="md:col-span-2 text-right">
                             <div className="space-y-1">
                                <p className="text-white font-black text-2xl">{target.confidence}%</p>
                                <p className="text-slate-700 text-[9px] font-black uppercase tracking-widest">Signal Score</p>
                             </div>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>

              {/* 3. EXCLUSION ZONE */}
              <div className="space-y-10">
                 <div className="bg-red-600/5 border border-red-500/20 p-16 rounded-[4rem] relative overflow-hidden ring-1 ring-red-500/10 shadow-2xl">
                    <div className="absolute top-0 right-0 p-12 opacity-[0.03] text-red-500 pointer-events-none">
                       <AlertOctagon size={240} />
                    </div>
                    <div className="flex items-center gap-4 text-red-500 mb-12 relative z-10">
                       <ShieldAlert size={28} />
                       <h3 className="text-xl font-black uppercase tracking-widest">3. Exclusion Zone (No Entry)</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-16 relative z-10">
                       {snapshot.doNotApplyZone.map((zone, i) => (
                          <div key={i} className="space-y-4">
                             <p className="text-red-500 font-black text-lg uppercase tracking-tight border-b border-red-500/20 pb-2">{zone.entityType}</p>
                             <p className="text-slate-400 text-sm font-medium leading-relaxed italic">
                               {zone.reasoning}
                             </p>
                          </div>
                       ))}
                    </div>
                 </div>
              </div>
           </div>

           {/* RIGHT COLUMN: ACTION SIDEBAR */}
           <div className="lg:col-span-4 space-y-12">
              
              {/* 4. ACTION ORDERS */}
              <div className="bg-blue-600 rounded-[3.5rem] p-12 text-white shadow-[0_0_60px_rgba(59,130,246,0.15)] relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-110 transition-transform">
                    <Send size={180} />
                 </div>
                 
                 <div className="relative z-10 space-y-12">
                    <div className="flex items-center gap-4">
                       <Target size={24} />
                       <h3 className="text-2xl font-black uppercase tracking-tighter">4. Action Orders</h3>
                    </div>

                    <div className="space-y-10">
                       <div className="space-y-6">
                          <div className="flex items-center gap-3 text-blue-100/60 font-black text-[11px] uppercase tracking-widest">
                             <Clock size={14} /> Next 7 Days (Tactical)
                          </div>
                          <div className="space-y-4">
                             {snapshot.actionOrders.next7Days.map((order, i) => (
                                <div key={i} className="bg-white/10 border border-white/10 p-6 rounded-2xl flex gap-5 backdrop-blur-sm">
                                   <span className="text-blue-200 font-black text-xl leading-none">0{i+1}</span>
                                   <p className="text-blue-50 text-xs font-bold leading-relaxed">{order}</p>
                                </div>
                             ))}
                          </div>
                       </div>

                       <div className="space-y-6">
                          <div className="flex items-center gap-3 text-blue-100/60 font-black text-[11px] uppercase tracking-widest">
                             <TrendingUp size={14} /> Next 30 Days (Strategic)
                          </div>
                          <div className="space-y-4">
                             {snapshot.actionOrders.next30Days.map((order, i) => (
                                <div key={i} className="bg-white/10 border border-white/10 p-6 rounded-2xl flex gap-5 backdrop-blur-sm">
                                   <span className="text-blue-200 font-black text-xl leading-none">0{i+1}</span>
                                   <p className="text-blue-50 text-xs font-bold leading-relaxed">{order}</p>
                                </div>
                             ))}
                          </div>
                       </div>
                    </div>
                 </div>
              </div>

              {/* STRATEGIC DIRECTIVES */}
              <div className="bg-[#16161E] border border-white/5 p-12 rounded-[3.5rem] shadow-xl space-y-10">
                 <div className="space-y-8">
                    <div className="flex items-center gap-3">
                       <Fingerprint size={18} className="text-indigo-400" />
                       <h4 className="text-white font-black uppercase text-xs tracking-widest">Positioning Directives</h4>
                    </div>
                    <div className="space-y-6">
                       {snapshot.actionOrders.positioningDirectives.map((order, i) => (
                          <div key={i} className="flex gap-4 items-start">
                             <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                             <p className="text-slate-400 text-[11px] font-bold leading-relaxed uppercase">{order}</p>
                          </div>
                       ))}
                    </div>
                 </div>

                 <div className="h-[1px] bg-white/5" />

                 <div className="space-y-8">
                    <div className="flex items-center gap-3">
                       <Shield size={18} className="text-blue-500" />
                       <h4 className="text-white font-black uppercase text-xs tracking-widest">Interview Defense</h4>
                    </div>
                    <div className="space-y-6">
                       {snapshot.actionOrders.interviewDirectives.map((order, i) => (
                          <div key={i} className="flex gap-4 items-start">
                             <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                             <p className="text-slate-400 text-[11px] font-bold leading-relaxed uppercase">{order}</p>
                          </div>
                       ))}
                    </div>
                 </div>
              </div>

              {/* 5. RISK REGISTER */}
              <div className="bg-[#0D0D12] border border-white/5 p-12 rounded-[3.5rem] shadow-xl space-y-6">
                 <div className="flex items-center gap-4 text-slate-600">
                    <ShieldAlert size={20} />
                    <h3 className="text-xs font-black uppercase tracking-widest">5. Risk Register</h3>
                 </div>
                 <div className="space-y-2">
                    <p className="text-red-500 font-black text-[10px] uppercase tracking-widest">Primary Uncertainty</p>
                    <p className="text-slate-400 text-sm font-medium leading-relaxed italic">
                      "{snapshot.risks.uncertainty}"
                    </p>
                 </div>
              </div>
           </div>
        </div>
      </div>
    );
  }

  if (viewState === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-10">
        <Loader2 size={80} className="text-blue-500 animate-spin" strokeWidth={1.5} />
        <div className="text-center space-y-4">
          <h3 className="text-3xl font-black text-white uppercase tracking-tight">Synthesizing Market Command</h3>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">Targeting {targetRole} Signal Maps</p>
          <p className="text-slate-600 text-[10px] font-black uppercase tracking-[0.4em] animate-pulse">Running in background • Session Persistent</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-24 px-10 space-y-12 animate-in fade-in duration-700">
      <div className="space-y-4">
         <div className="flex items-center gap-3 text-amber-500 bg-amber-500/5 w-fit px-4 py-1.5 rounded-full border border-amber-500/10">
            <Radio size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">Synthetic Directive Terminal</span>
         </div>
         <h2 className="text-6xl font-black text-white tracking-tighter uppercase leading-none">Market Outlook</h2>
         <p className="text-slate-500 text-xl font-medium leading-relaxed max-w-2xl">
           Generates a high-fidelity synthetic market snapshot for strategic document calibration. 
           Assists in mapping your experience against current hiring patterns.
         </p>
      </div>

      <div className="bg-[#16161E] border border-[#1D1D26] rounded-[4rem] p-16 space-y-12 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-[0.02] text-white pointer-events-none">
           <Radar size={320} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">Target Designation</label>
            <input 
              value={targetRole} 
              onChange={e => setTargetRole(e.target.value)} 
              className="w-full bg-[#0D0D12] border border-[#2D313D] rounded-2xl p-6 text-white outline-none focus:border-blue-500 font-bold text-xl placeholder:text-slate-900 transition-all"
              placeholder="e.g. Lead ML Engineer" 
            />
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">Geography Perimeter</label>
            <input 
              value={geography} 
              onChange={e => setGeography(e.target.value)} 
              className="w-full bg-[#0D0D12] border border-[#2D313D] rounded-2xl p-6 text-white outline-none focus:border-blue-500 font-bold text-xl placeholder:text-slate-900 transition-all"
              placeholder="e.g. Remote / North America" 
            />
          </div>
        </div>
        <button 
          onClick={handleGenerate} 
          // Removed redundant check for 'processing' as it is handled by early return
          disabled={!targetRole} 
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-8 rounded-3xl transition-all uppercase tracking-[0.3em] text-sm shadow-2xl shadow-blue-900/40 flex items-center justify-center gap-4 group disabled:opacity-30 relative z-10"
        >
          Synthesize Market Command <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" />
        </button>
      </div>
      
      <div className="p-12 border border-white/5 bg-[#0D0D12] rounded-[3rem] text-center">
         <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.6em] mb-4">Simulation Logic</p>
         <p className="text-slate-600 text-xs max-w-xl mx-auto leading-relaxed font-bold uppercase">
           Outlook data is synthetic and derived from LLM heuristic patterns. 
           Strategic runs are atomic and session-persistent.
         </p>
      </div>
    </div>
  );
};
