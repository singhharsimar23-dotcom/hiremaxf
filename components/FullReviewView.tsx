import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Zap, 
  ChevronDown, 
  ChevronUp,
  Target,
  Lock,
  ArrowRight,
  Activity,
  ShieldAlert,
  Clock as ClockIcon,
  ShieldX,
  FastForward,
  Scale,
  CheckCircle2,
  AlertCircle,
  Terminal,
  Cpu,
  Building2,
  UserCheck,
  ZapOff,
  Split,
  Eye,
  Info,
  RefreshCcw,
  Timer,
  BarChart3,
  Workflow,
  MousePointer2,
  Settings2,
  LayoutTemplate,
  Plus
} from 'lucide-react';
import { DiagnosticResult, EightPointItem, UserPlan, AppView } from '../types';

interface FullReviewViewProps {
  result: DiagnosticResult | null;
  plan: UserPlan;
  onUpgrade: () => void;
  onRebuildRequest: (analysisId: string) => void;
  setView?: (v: AppView) => void;
}

interface PointWidgetProps {
  point: EightPointItem;
  isStarter: boolean;
  isChokepoint: boolean;
  onUpgrade: () => void;
  isAnalystView: boolean;
}

const PointWidget: React.FC<PointWidgetProps> = ({ point, isStarter, isChokepoint, onUpgrade, isAnalystView }) => {
  const [expanded, setExpanded] = useState(isChokepoint || isAnalystView);

  useEffect(() => {
    setExpanded(isChokepoint || isAnalystView);
  }, [isAnalystView, isChokepoint]);

  function getStatusColor(score: number) {
    if (score >= 90) return 'text-green-400';
    if (score >= 75) return 'text-amber-400';
    return 'text-red-400';
  }

  const getAtomicChanges = (pointName: string) => {
    const name = pointName.toLowerCase();
    if (name.includes('maturity') || name.includes('leadership')) {
      return [{
        before: "Led a team of 4 engineers to build a new feature for the user dashboard.",
        after: "Directed architectural migration of core dashboard services; implemented a shared-kernel pattern reducing deployment collisions by 60%.",
        logic: "Recruiters at the Staff/Lead tier skip 'management' tasks. They search for 'Architectural Intervention' and 'Systemic Collision Mitigation'."
      }];
    }
    if (name.includes('technical') || name.includes('skill')) {
      return [{
        before: "Implemented various machine learning models using PyTorch and Scikit-learn.",
        after: "Deployed production transformer models for real-time inference; optimized CUDA kernel utilization reducing latency from 240ms to 45ms.",
        logic: "Generic library mentions trigger 'Junior/Tactical' heuristics. Quantified hardware-level optimization is the mandatory senior signal."
      }];
    }
    return [{
      before: "Responsible for maintaining internal data pipelines.",
      after: "Managed multi-terabyte ETL orchestration; re-indexed legacy Snowflake clusters reducing compute overhead by $4k/mo.",
      logic: "Responsibility is a passive signal. Cost-to-compute reduction is a lead-level executive signal required for this role."
    }];
  };

  const atomicChanges = getAtomicChanges(point.name);

  return (
    <div className={`bg-[#16161E] border rounded-[2rem] overflow-hidden transition-all ${
      expanded ? 'border-blue-500/40 shadow-2xl' : (isChokepoint ? 'border-red-500/30' : 'border-[#1D1D26] hover:border-blue-500/20')
    }`}>
      <div 
        onClick={() => setExpanded(!expanded)}
        className="p-6 flex items-center justify-between cursor-pointer group"
      >
        <div className="flex items-center gap-6">
          <div className={`text-4xl font-black ${getStatusColor(point.score)} w-16`}>
            {point.score}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-white font-bold text-lg tracking-tight group-hover:text-blue-400 transition-colors uppercase">{point.name}</h3>
              {isChokepoint && <span className="text-[9px] font-black bg-red-600 text-white px-2 py-0.5 rounded uppercase tracking-widest animate-pulse">Critical Chokepoint</span>}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
                Screening Layer: {point.id === 'ats_parseability' ? 'Technical Ingestion' : 'Heuristic Alignment'}
              </p>
              <div className="w-[1px] h-3 bg-slate-800" />
              <p className="text-blue-500/60 text-[9px] font-black uppercase tracking-widest">Affects Eligibility Clock</p>
            </div>
          </div>
        </div>
        <div className="text-slate-500">
          {expanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
        </div>
      </div>

      {expanded && (
        <div className="px-8 pb-8 space-y-8 animate-in slide-in-from-top-2 duration-300">
          {!isAnalystView && (
             <div className="p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10">
                <p className="text-[11px] text-slate-400 font-medium leading-relaxed italic">
                   {isStarter ? point.riskHint : point.explanation}
                </p>
             </div>
          )}

          <div className="h-[1px] bg-white/5" />
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em]">Atomic Change Map (Surgical Intervention)</h4>
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Procedural Fixes: {atomicChanges.length}</span>
            </div>

            {isStarter ? (
              <div className="bg-[#0D0D12] p-10 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center gap-4">
                <Lock className="text-slate-700" size={28} />
                <div>
                  <p className="text-white font-black text-xs uppercase tracking-widest mb-1">Intervention Logic Redacted</p>
                  <p className="text-slate-500 text-[11px] font-medium max-w-xs mx-auto">
                    Pro access required to view exact line-level rejections and high-fidelity rewrites.
                  </p>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); onUpgrade(); }}
                  className="mt-2 text-blue-500 font-black text-[10px] uppercase tracking-widest hover:text-white transition-colors"
                >
                  Unlock Intervention Layer →
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {atomicChanges.map((change, i) => (
                  <div key={i} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-red-500/5 border border-red-500/20 p-5 rounded-2xl relative">
                        <div className="absolute top-2 right-3 text-[8px] font-black text-red-500/40 uppercase tracking-widest">Current Signal (REJECT)</div>
                        <p className="text-slate-400 text-xs font-mono leading-relaxed line-through decoration-red-900/50">"{change.before}"</p>
                      </div>
                      <div className="bg-green-500/5 border border-green-500/20 p-5 rounded-2xl relative">
                        <div className="absolute top-2 right-3 text-[8px] font-black text-green-500/40 uppercase tracking-widest">Inject Signal (PASS)</div>
                        <p className="text-white text-xs font-mono leading-relaxed">"{change.after}"</p>
                      </div>
                    </div>
                    {isAnalystView && (
                      <div className="bg-blue-600/5 p-5 rounded-2xl border border-blue-500/10 flex gap-4">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                          <Terminal size={14} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Committee Heuristic Logic</p>
                          <p className="text-slate-400 text-[11px] font-medium leading-relaxed">{change.logic}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const SignalChip: React.FC<{ 
  label: string; 
  value: string; 
  status: string; 
  explanation: string;
  isAnalystView: boolean;
}> = ({ label, value, status, explanation, isAnalystView }) => {
  const [showWhy, setShowWhy] = useState(false);
  const isOptimal = status.toLowerCase() === 'optimal';
  const isCritical = status.toLowerCase() === 'critical';

  return (
    <div className="space-y-2">
      <div 
        className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
          showWhy ? 'bg-blue-600/10 border-blue-500/30' : 'bg-[#1A1D26]/40 border-white/5 hover:border-white/10'
        }`}
      >
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">{label}</span>
          <span className={`text-[8px] font-black uppercase ${isOptimal ? 'text-green-500' : isCritical ? 'text-red-500' : 'text-amber-500'}`}>
            {status}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-black text-white">{value}</span>
          <button 
            onClick={() => setShowWhy(!showWhy)}
            className="text-[8px] font-black text-blue-500 uppercase tracking-widest border border-blue-500/20 px-1.5 py-0.5 rounded hover:bg-blue-500 hover:text-white transition-colors"
          >
            {showWhy ? 'Close' : 'Why?'}
          </button>
        </div>
      </div>
      {(showWhy || isAnalystView) && (
        <div className="px-3 pb-1 animate-in slide-in-from-top-1 duration-200">
          <p className="text-[10px] text-slate-400 font-medium leading-relaxed border-l-2 border-blue-500/30 pl-3">
            {explanation}
          </p>
        </div>
      )}
    </div>
  );
};

const DecisionInstrument = ({ state, windowEst, isAnalystView }: { state: 'RED' | 'AMBER' | 'GREEN', windowEst: string, isAnalystView: boolean }) => {
  const isRed = state === 'RED';
  const isAmber = state === 'AMBER';
  const isGreen = state === 'GREEN';
  const rotation = isRed ? 60 : (isAmber ? 150 : 300);

  return (
    <div className="mb-20 space-y-6">
      {/* Tier 1: Decision Hub */}
      <div className="flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Workflow size={20} className="text-blue-500" />
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Hiring Eligibility Clock</h2>
        </div>
        <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border transition-colors ${isRed ? 'bg-red-600/10 border-red-500/20 text-red-500' : 'bg-green-600/10 border-green-500/20 text-green-500'}`}>
           <div className={`w-2 h-2 rounded-full ${isRed ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
           <span className="text-[10px] font-black uppercase tracking-widest">System Gate: {isRed ? 'LOCKED' : 'BYPASS READY'}</span>
        </div>
      </div>

      <div className="bg-[#111118] border border-[#2D313D] rounded-[4rem] p-12 shadow-2xl relative overflow-hidden ring-1 ring-white/5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center w-full relative z-10">
          
          {/* Internal Signals (Tier 2/3) */}
          <div className="lg:col-span-3 space-y-8">
            <div className="space-y-1">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Internal Signal Weighting</h3>
              <div className="h-[1px] w-8 bg-blue-500/30" />
            </div>
            <div className="space-y-4">
              <SignalChip label="Seniority Coherence" value="42%" status="Degraded" isAnalystView={isAnalystView} explanation="Structural drift detected between career length and technical depth markers." />
              <SignalChip label="Architectural Scope" value="18%" status="Critical" isAnalystView={isAnalystView} explanation="System lacks specific evidence of 100M+ record distributed scale ownership." />
              <SignalChip label="ATS Integrity" value="98%" status="Optimal" isAnalystView={isAnalystView} explanation="Document layers verified for zero-loss ingestion across Tier-1 screening systems." />
              <SignalChip label="Ownership Markers" value="31%" status="Soft" isAnalystView={isAnalystView} explanation="Signal contains high density of passive verbs; lacks lead-level 'Spearheaded' attribution." />
            </div>
          </div>

          {/* Clock (Tier 1 Focus) */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center">
            <div className="relative group">
              <svg width="340" height="340" viewBox="0 0 240 240" className="drop-shadow-[0_0_50px_rgba(59,130,246,0.1)] transition-transform duration-700 group-hover:scale-[1.02]">
                <circle cx="120" cy="120" r="100" fill="none" stroke="#1D1D26" strokeWidth="20" />
                <path d="M 120 20 A 100 100 0 0 1 206.6 70" fill="none" stroke="#EF4444" strokeWidth="20" opacity={isRed ? 1 : 0.2} strokeLinecap="round" />
                <path d="M 206.6 170 A 100 100 0 0 1 33.4 170" fill="none" stroke="#F59E0B" strokeWidth="20" opacity={isAmber ? 1 : 0.2} strokeLinecap="round" />
                <path d="M 33.4 70 A 100 100 0 0 1 120 20" fill="none" stroke="#10B981" strokeWidth="20" opacity={isGreen ? 1 : 0.2} strokeLinecap="round" />
                <circle cx="120" cy="120" r="8" fill="white" />
                <g transform={`rotate(${rotation}, 120, 120)`} className="transition-transform duration-[2000ms] cubic-bezier(0.4, 0, 0.2, 1)">
                  <line x1="120" y1="120" x2="120" y2="40" stroke="white" strokeWidth="4" strokeLinecap="round" />
                </g>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="mt-48 bg-[#0D0D12] border border-[#2D313D] px-10 py-3 rounded-2xl text-center shadow-2xl ring-1 ring-white/10">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1">Current State</p>
                  <p className={`text-2xl font-black uppercase tracking-widest ${isRed ? 'text-red-500' : (isAmber ? 'text-amber-500' : 'text-green-500')}`}>
                    {isRed ? 'NOT SAFE' : (isAmber ? 'RECOVERY' : 'SAFE')}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-12 text-center space-y-2">
              <p className="text-[11px] font-black text-slate-600 uppercase tracking-[0.4em]">Submission Readiness Window</p>
              <h2 className="text-6xl font-black text-white tracking-tighter uppercase leading-none">
                {isRed ? 'GATE CLOSED' : (isAmber ? 'INTERVENTION' : 'SAFE TO APPLY')}
              </h2>
              {isAnalystView && (
                <p className="text-[10px] font-bold text-slate-500 uppercase pt-4 max-w-sm mx-auto leading-relaxed">
                  Weighted interaction: Readiness (40%) + Volatility (25%) + Risk Model (35%)
                </p>
              )}
            </div>
          </div>

          {/* Market & Risks (Tier 2) */}
          <div className="lg:col-span-3 space-y-10">
            <div className="space-y-4">
              <div className="space-y-1 text-right">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Market Pressure</h3>
                <div className="h-[1px] w-8 bg-indigo-500/30 ml-auto" />
              </div>
              <div className="grid grid-cols-1 gap-2">
                 {[
                   { l: 'Competition', v: 'High Density', c: 'text-amber-500' },
                   { l: 'Bandwidth', v: 'Saturated', c: 'text-red-500' }
                 ].map((m, i) => (
                    <div key={i} className="flex justify-between items-center bg-white/5 px-4 py-3 rounded-xl border border-white/5">
                       <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{m.l}</span>
                       <span className={`text-[10px] font-black uppercase ${m.c}`}>{m.v}</span>
                    </div>
                 ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1 text-right">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Consequence Matrix</h3>
                <div className="h-[1px] w-8 bg-red-500/30 ml-auto" />
              </div>
              <div className="space-y-2">
                 <div className="flex justify-between items-center p-3 bg-red-600/5 border border-red-500/10 rounded-xl">
                    <p className="text-[9px] font-black text-red-500 uppercase tracking-widest">Rejection Persistence</p>
                    <p className="text-[10px] font-black text-white">180D</p>
                 </div>
                 <div className="flex justify-between items-center p-3 bg-blue-600/5 border border-blue-500/10 rounded-xl">
                    <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Next Open Window</p>
                    <p className="text-[10px] font-black text-white">{windowEst}</p>
                 </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-start gap-4">
            <ShieldAlert size={24} className="text-red-500 shrink-0 mt-1" />
            <div className="space-y-1">
              <p className="text-[11px] font-black text-white uppercase tracking-widest">Irreversible Rejection Risk</p>
              <p className="text-[10px] font-medium text-slate-500 uppercase leading-relaxed max-w-xl">
                Submission during RED state triggers persistent cooling periods in Tier-1 databases. HireMax protocols explicitly prohibit applying until the signal integrity is restored.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white/5 px-6 py-3 rounded-2xl border border-white/10 shrink-0 shadow-inner">
             <Timer size={14} className="text-blue-500" />
             <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Recalibration in: 14H 22M</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export function FullReviewView(props: FullReviewViewProps) {
  const { result, plan, onUpgrade, onRebuildRequest, setView } = props;
  const [activePersona, setActivePersona] = useState<'FAANG' | 'STARTUP' | 'AI_TEAM'>('FAANG');
  const [isIntervening, setIsIntervening] = useState(false);
  const [isAnalystView, setIsAnalystView] = useState(false);

  if (!result) {
    return (
      <div className="max-w-4xl mx-auto py-40 text-center">
        <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-8 border border-slate-800">
          <ShieldCheck className="text-slate-600" size={32} />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2 uppercase tracking-tight">System Loop Inactive</h2>
        <p className="text-slate-500 font-medium mb-8">Initialize outcome control to generate deterministic hiring forecasts.</p>
        <button 
          onClick={() => setView?.('ai-review')}
          className="bg-blue-600 text-white font-black py-4 px-10 rounded-2xl transition-all shadow-xl shadow-blue-900/20 uppercase tracking-widest text-xs flex items-center gap-3 mx-auto"
        >
          <Plus size={18} /> Initialize Assessment
        </button>
      </div>
    );
  }

  const isStarter = plan === 'Starter';
  const points = result.eightPoints || [];
  const overallScore = result.overallScore;

  const maturityPoint = points.find(p => p.name.toLowerCase().includes('maturity') || p.name.toLowerCase().includes('leadership'));
  const lowestPoint = points.reduce((prev, curr) => (prev.score < curr.score) ? prev : curr, points[0]);
  const chokepoint = maturityPoint && maturityPoint.score < 85 ? maturityPoint : lowestPoint;

  const clockState = (isIntervening) ? 'AMBER' : (overallScore >= 85 ? 'GREEN' : 'RED');
  const windowEst = isIntervening ? '1–2 DAYS (EST.)' : '3–5 DAYS (EST.)';

  const hiringState = overallScore >= 85 ? 'SAFE TO APPLY' : (overallScore >= 70 ? 'TRANSITIONAL' : 'NOT SAFE TO APPLY');
  const safetyColor = hiringState === 'SAFE TO APPLY' ? 'text-green-500' : (hiringState === 'TRANSITIONAL' ? 'text-amber-500' : 'text-red-500');

  const personaForecasts = {
    FAANG: {
      sentiment: 'Indifferent / Automatic Skip',
      observation: 'Architectural scope is unverified. Scale markers are missing from the last 24 months of data.',
      fix: 'Quantify distributed systems impact at 100M+ record scale.',
      delta: '+22% Probability'
    },
    STARTUP: {
      sentiment: 'Cautiously Interested',
      observation: 'Technical depth is visible, but velocity signals (0 to 1) are buried under generic corporate jargon.',
      fix: 'Highlight prototype-to-production cycles and deployment speed.',
      delta: '+18% Probability'
    },
    AI_TEAM: {
      sentiment: 'Technical Match / Strategic Hold',
      observation: 'RAG and LLM lifecycle knowledge is clear. However, senior leadership bits are flipped to "OFF".',
      fix: 'Emphasize architectural trade-offs over simple implementation.',
      delta: '+31% Probability'
    }
  };

  const handleIntervention = () => {
    setIsIntervening(true);
    if(isStarter) {
      onUpgrade();
    } else {
      onRebuildRequest(result.analysisId || '');
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto py-12 px-10 animate-in fade-in duration-700">
      
      {/* Hierarchy Header & View Toggle */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-8">
        <div className="flex items-center gap-4 bg-white/5 p-2 rounded-[2rem] border border-white/5">
           <button 
             onClick={() => setIsAnalystView(false)}
             className={`px-8 py-3 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest transition-all ${!isAnalystView ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}
           >
             Decision View
           </button>
           <button 
             onClick={() => setIsAnalystView(true)}
             className={`px-8 py-3 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest transition-all ${isAnalystView ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}
           >
             Analyst View
           </button>
           <div className="w-[1px] h-6 bg-white/10 mx-2" />
           <button 
             onClick={() => setView?.('ai-review')}
             className="px-6 py-3 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest transition-all border border-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white flex items-center gap-2"
           >
             <Plus size={14} /> Run New Analysis
           </button>
        </div>
        <div className="flex items-center gap-3 text-slate-700">
           <Activity size={14} />
           <span className="text-[10px] font-black uppercase tracking-[0.4em]">Audit: {result.analysisId?.slice(0,8)}</span>
        </div>
      </div>

      {/* TIER 1: THE DECISION INSTRUMENT */}
      <DecisionInstrument state={clockState} windowEst={windowEst} isAnalystView={isAnalystView} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-20">
        {/* TIER 2: PRIMARY SIGNALS (LEFT) */}
        <div className="lg:col-span-8 space-y-12">
          
          {/* HIRING PERSONA SIMULATION */}
          <div className="bg-[#16161E] border border-[#1D1D26] rounded-[3.5rem] overflow-hidden shadow-xl">
            <div className="flex border-b border-white/5 bg-white/5">
              {[
                { id: 'FAANG', label: 'FAANG Recruiter', icon: <Building2 size={14} /> },
                { id: 'STARTUP', label: 'Startup CTO', icon: <Zap size={14} /> },
                { id: 'AI_TEAM', label: 'Applied AI Lead', icon: <Cpu size={14} /> }
              ].map(p => (
                <button 
                  key={p.id}
                  onClick={() => setActivePersona(p.id as any)}
                  className={`flex-1 py-6 flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest transition-all relative ${
                    activePersona === p.id ? 'text-white' : 'text-slate-500 hover:text-white'
                  }`}
                >
                  {p.icon} {p.label}
                  {activePersona === p.id && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 animate-in slide-in-from-left duration-300" />}
                </button>
              ))}
            </div>
            <div className="p-10 space-y-8 animate-in fade-in duration-500">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-10">
                <div className="space-y-2">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Sentiment</p>
                  <p className="text-white text-lg font-bold uppercase leading-tight">{personaForecasts[activePersona].sentiment}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Delta</p>
                  <p className="text-green-400 text-lg font-bold uppercase">{personaForecasts[activePersona].delta}</p>
                </div>
                <div className="col-span-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Required Intervention</p>
                    <MousePointer2 size={10} className="text-slate-600" />
                  </div>
                  <p className="text-white text-sm font-bold leading-relaxed">{personaForecasts[activePersona].fix}</p>
                </div>
              </div>
              
              {isAnalystView && (
                <div className="bg-white/5 p-8 rounded-3xl border border-white/10 flex items-start gap-5">
                   <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-slate-500 shrink-0">
                      <UserCheck size={20} />
                   </div>
                   <p className="text-slate-400 text-sm leading-relaxed font-medium">
                     "Observed Behavior: {personaForecasts[activePersona].observation}"
                   </p>
                </div>
              )}
            </div>
          </div>

          {/* CHOKEPOINT */}
          <div className="bg-blue-600/5 border border-blue-500/20 p-10 rounded-[3rem] shadow-xl relative overflow-hidden group">
             <div className="relative z-10">
                <div className="flex items-center gap-3 text-blue-500 mb-6">
                   <Target size={24} />
                   <h3 className="text-[10px] font-black uppercase tracking-[0.4em]">Decision Chokepoint</h3>
                </div>
                <div className="flex flex-col md:flex-row items-center gap-10">
                   <div className="text-center md:text-left space-y-4">
                      <h4 className="text-white text-3xl font-black uppercase tracking-tight">{chokepoint?.name || 'Maturity & Timeline'}</h4>
                      <div className="space-y-2">
                        <p className="text-red-400 text-sm font-black uppercase tracking-widest italic flex items-center gap-2">
                          <AlertCircle size={14} /> This signal alone blocks eligibility
                        </p>
                        {isAnalystView && (
                          <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-lg">
                            Document projections violate committee seniority heuristics. Procedural correction required to reset 'Rejection' bit.
                          </p>
                        )}
                      </div>
                   </div>
                   <div className="bg-[#0D0D12] border border-red-500/30 px-10 py-6 rounded-3xl text-center shrink-0 shadow-2xl">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Status</p>
                      <p className="text-4xl font-black text-red-500 uppercase">Blocked</p>
                   </div>
                </div>
             </div>
          </div>

          {/* SIGNAL MAP */}
          <div className="space-y-8">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-white font-black text-2xl uppercase tracking-tight">Signal Intervention Map</h3>
              <div className="flex items-center gap-3">
                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Pass Threshold</span>
                <span className="text-[11px] font-black text-green-500 uppercase tracking-widest border border-green-500/20 px-3 py-1 rounded-full">85% SCORE</span>
              </div>
            </div>
            <div className="space-y-6">
              {points.map(p => (
                <PointWidget key={p.id} point={p} isStarter={isStarter} isChokepoint={chokepoint?.id === p.id} onUpgrade={onUpgrade} isAnalystView={isAnalystView} />
              ))}
            </div>
          </div>
        </div>

        {/* TIER 3: INTERVENTION SIDEBAR (RIGHT) */}
        <div className="lg:col-span-4 space-y-12">
          
          {/* RECOVERY PATH */}
          <div className="bg-[#16161E] border border-blue-500/20 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5 text-blue-500 pointer-events-none">
              <Split size={140} />
            </div>
            <div className="relative z-10 space-y-8">
              <div className="flex items-center gap-3 text-blue-500">
                <Settings2 size={20} />
                <h3 className="text-white font-black uppercase tracking-tight text-xs tracking-[0.2em]">Viable Recovery Path</h3>
              </div>
              
              <div className="space-y-4">
                {[
                  { label: "Architectural Injection", impact: "+22%" },
                  { label: "Seniority Calibration", impact: "+12%" },
                  { label: "ATS Layer Hardening", impact: "+6%" }
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div>
                      <p className="text-white font-bold text-xs">{item.label}</p>
                      <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mt-1">Action Required</p>
                    </div>
                    <span className="text-blue-400 font-black text-sm">{item.impact}</span>
                  </div>
                ))}
              </div>

              <div className="pt-6 border-t border-white/5">
                <div className="flex justify-between items-end mb-4">
                   <div className="flex flex-col">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Recovery Window</p>
                      <p className="text-xl font-black text-white uppercase tracking-tighter">{windowEst}</p>
                   </div>
                  <p className="text-2xl font-black text-green-400">{overallScore}% → 88%</p>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full bg-blue-500 animate-pulse transition-all duration-1000 ${isIntervening ? 'w-[88%]' : 'w-[72%]'}`} />
                </div>
                <p className="text-[10px] font-medium text-slate-500 mt-5 leading-relaxed italic">
                  Projection assumes mandatory signal hardening is completed via rebuild.
                </p>
              </div>
            </div>
          </div>

          {/* EXECUTE ACTION */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-10 rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-110 transition-transform">
              <ShieldCheck size={180} />
            </div>
            <div className="relative z-10">
              <h3 className="text-3xl font-black uppercase tracking-tight mb-4 leading-none">Execute Rebuild</h3>
              <p className="text-blue-100 text-sm font-medium leading-relaxed mb-8 opacity-90">
                Unlock hiring eligibility by structurally rebuilding lead signals.
              </p>
              
              <div className="space-y-3 mb-10">
                {['Signal Injection', 'Scale Surfacing', 'Bypass Mapping'].map(item => (
                  <div key={item} className="flex items-center gap-3 text-[10px] font-black uppercase text-white/80">
                    <Zap size={14} className="text-green-300" /> {item}
                  </div>
                ))}
              </div>

              <button 
                onClick={handleIntervention}
                className="w-full bg-white text-blue-900 font-black py-6 rounded-2xl shadow-2xl hover:bg-blue-50 transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em] text-xs"
              >
                {isStarter ? "Unlock Access" : (isIntervening ? "Initializing..." : "Restore Eligibility")} <ArrowRight size={18} />
              </button>
            </div>
          </div>

          {/* SYSTEM FOOTER WARNING */}
          <div className="p-8 border border-red-500/20 bg-red-500/5 rounded-[3rem] text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-red-500">
              <ShieldX size={20} />
              <p className="text-[10px] font-black uppercase tracking-[0.3em]">Critical Cooldown Risk</p>
            </div>
            <p className="text-slate-400 text-xs font-medium leading-relaxed">
              Applying before eligibility increases rejection risk. Calibration recalibrates upon content change.
            </p>
            <div className="h-[1px] bg-red-500/10" />
            <div className="flex items-center justify-center gap-3 text-slate-800">
               <RefreshCcw size={12} />
               <p className="text-[9px] font-black uppercase tracking-widest">Valid: 24H Audit Window</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}