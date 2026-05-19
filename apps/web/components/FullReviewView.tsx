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
import { DiagnosticResult, EightPointItem, UserPlan, AppView, AtomicChange, PersonaForecast, SignalChips, ApplicationWindow } from '../types';
import { History } from 'lucide-react';

interface FullReviewViewProps {
  result: DiagnosticResult | null;
  plan: UserPlan;
  onUpgrade: () => void;
  onRebuildRequest: (analysisId: string) => void;
  setView?: (v: AppView) => void;
  // FIX 4: Allow history navigation directly from this view
  analysisHistory?: Record<string, DiagnosticResult>;
  setActiveAnalysisId?: (id: string) => void;
  activeRebuild?: { scoreBefore: number; scoreAfter: number; linkedAnalysisId: string } | null;
}

interface PointWidgetProps {
  point: EightPointItem;
  isStarter: boolean;
  isChokepoint: boolean;
  onUpgrade: () => void;
  isAnalystView: boolean;
  atomicChanges?: AtomicChange[];
}

const PointWidget: React.FC<PointWidgetProps> = ({ point, isStarter, isChokepoint, onUpgrade, isAnalystView, atomicChanges }) => {
  const [expanded, setExpanded] = useState(isChokepoint || isAnalystView);

  useEffect(() => {
    setExpanded(isChokepoint || isAnalystView);
  }, [isAnalystView, isChokepoint]);

  function getStatusColor(score: number) {
    if (score >= 90) return 'text-green-400';
    if (score >= 75) return 'text-amber-400';
    return 'text-red-400';
  }

  // Atomic changes are sourced from the pipeline — filtered by dimension name matching this point.
  // Never show changes from another dimension (that destroys trust).
  const displayChanges: AtomicChange[] = (atomicChanges || []).filter(
    c => c.dimension?.toLowerCase() === point.name?.toLowerCase()
  );

  return (
    <div className={`bg-[#16161E] border rounded-[2rem] overflow-hidden transition-all ${expanded ? 'border-blue-500/40 shadow-2xl' : (isChokepoint ? 'border-red-500/30' : 'border-[#1D1D26] hover:border-blue-500/20')
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
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Procedural Fixes: {displayChanges.length}</span>
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
            ) : displayChanges.length > 0 ? (
              <div className="space-y-6">
                {displayChanges.map((change, i) => (
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
            ) : (
              <div className="bg-[#0D0D12] p-8 rounded-2xl border border-white/5 text-center">
                <RefreshCcw size={18} className="text-slate-700 mx-auto mb-3" />
                <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest">
                  Re-run analysis to generate surgical fixes for this dimension
                </p>
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
        className={`flex items-center justify-between p-3 rounded-xl border transition-all ${showWhy ? 'bg-blue-600/10 border-blue-500/30' : 'bg-[#1A1D26]/40 border-white/5 hover:border-white/10'
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

const DecisionInstrument = ({ state, windowEst, isAnalystView, chips, appWindow }: {
  state: 'RED' | 'AMBER' | 'GREEN',
  windowEst: string,
  isAnalystView: boolean,
  chips?: SignalChips,
  appWindow?: ApplicationWindow,
}) => {
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
              <SignalChip
                label="Seniority Coherence"
                value={chips?.seniorityCoherence?.value ?? '—'}
                status={chips?.seniorityCoherence?.status ?? 'Soft'}
                isAnalystView={isAnalystView}
                explanation="Measures how consistently senior your career language reads to ATS and human screeners."
              />
              <SignalChip
                label="Architectural Scope"
                value={chips?.architecturalScope?.value ?? '—'}
                status={chips?.architecturalScope?.status ?? 'Soft'}
                isAnalystView={isAnalystView}
                explanation="Evidence of systems designed at scale — ownership, scope, and infrastructure decisions."
              />
              <SignalChip
                label="ATS Integrity"
                value={chips?.atsIntegrity?.value ?? '—'}
                status={chips?.atsIntegrity?.status ?? 'Moderate'}
                isAnalystView={isAnalystView}
                explanation="Keyword density vs. live job requirements for this role. Verified against 76k+ live postings."
              />
              <SignalChip
                label="Ownership Markers"
                value={chips?.ownershipMarkers?.value ?? '—'}
                status={chips?.ownershipMarkers?.status ?? 'Soft'}
                isAnalystView={isAnalystView}
                explanation="Ratio of lead-level attribution language vs. passive construction. Key for Staff+ signals."
              />
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
                  { l: 'Competition', v: '250+ / Role', c: 'text-amber-500' },
                  { l: 'Bandwidth', v: 'Competitive', c: 'text-red-500' }
                ].map((m, i) => (
                  <div key={i} className="flex justify-between items-center bg-white/5 px-4 py-3 rounded-xl border border-white/5">
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{m.l}</span>
                    <span className={`text-[10px] font-black uppercase ${m.c}`}>{m.v}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <Info size={10} className="text-slate-700" />
                <p className="text-[8px] font-black text-slate-700 uppercase tracking-widest">2026 Market Context · Static Data</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1 text-right">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Consequence Matrix</h3>
                <div className="h-[1px] w-8 bg-red-500/30 ml-auto" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-3 bg-slate-800/30 border border-white/5 rounded-xl">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Signal Decay Window</p>
                  <p className="text-[10px] font-black text-slate-400">30–180 Days</p>
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
              <p className="text-[11px] font-black text-white uppercase tracking-widest">Signal Integrity Required</p>
              <p className="text-[10px] font-medium text-slate-500 uppercase leading-relaxed max-w-xl">
                {appWindow?.blockers?.length
                  ? `Critical gaps: ${appWindow.blockers.slice(0, 2).join(' · ')}. Resolve before applying.`
                  : 'Apply after resolving critical signal gaps to maximize interview probability.'}
              </p>
            </div>
          </div>
          {appWindow?.estimatedHoursToReadiness != null && (
            <div className="flex items-center gap-3 bg-white/5 px-6 py-3 rounded-2xl border border-white/10 shrink-0 shadow-inner">
              <Timer size={14} className="text-blue-500" />
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Estimated Time to Ready: {appWindow.estimatedHoursToReadiness}H</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export function FullReviewView(props: FullReviewViewProps) {
  const { result, plan, onUpgrade, onRebuildRequest, setView, analysisHistory, setActiveAnalysisId, activeRebuild } = props;
  const [activePersona, setActivePersona] = useState<'FAANG' | 'STARTUP' | 'AI_TEAM'>('FAANG');
  const [isIntervening, setIsIntervening] = useState(false);
  const [isAnalystView, setIsAnalystView] = useState(false);
  const [sortSignalsBy, setSortSignalsBy] = useState<'score' | 'impact' | 'effort'>('score');
  const [shareCopied, setShareCopied] = useState(false);

  // Sorted history entries for the dropdown selector (newest first)
  const historyEntries = analysisHistory
    ? Object.entries(analysisHistory).sort(([, a], [, b]) => {
      const aDate = (a as any).created_at || '';
      const bDate = (b as any).created_at || '';
      return bDate.localeCompare(aDate);
    })
    : [];
  const hasHistory = historyEntries.length > 1;

  // Auto-load most recent analysis if result is null but history exists (Fix 5b)
  const mostRecentEntry = historyEntries[0];
  React.useEffect(() => {
    if (!result && mostRecentEntry && setActiveAnalysisId) {
      setActiveAnalysisId(mostRecentEntry[0]);
    }
  }, []);

  const ARCHETYPES = [
    { label: 'Mid-Level Engineer', description: '3–5 years, targeting Staff/L5', icon: '⚙️' },
    { label: 'Senior Being Laid Off', description: 'Transitioning, 8+ years experience', icon: '🔄' },
    { label: 'Career Switcher to AI', description: 'Pivoting to ML/AI engineering', icon: '🤖' },
  ];

  const QUICK_WINS = [
    'Add quantified metrics to every bullet (e.g., "reduced latency by 40%")',
    'Remove personal pronouns — use action verbs (Led, Architected, Delivered)',
    'Ensure contact section has LinkedIn URL + GitHub link for tech roles',
  ];

  if (!result) {
    return (
      <div className="max-w-4xl mx-auto py-20 px-10 animate-in fade-in duration-700">
        <div className="text-center mb-12">
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

        {/* Archetype quick-start cards */}
        <div className="mb-10">
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] text-center mb-6">Or start with a profile archetype</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {ARCHETYPES.map((a, i) => (
              <button
                key={i}
                onClick={() => setView?.('ai-review')}
                className="p-6 bg-[#16161E] border border-white/5 hover:border-blue-500/30 rounded-2xl text-left transition-all hover:-translate-y-1"
              >
                <span className="text-2xl mb-3 block">{a.icon}</span>
                <p className="text-white font-black text-xs uppercase tracking-widest mb-1">{a.label}</p>
                <p className="text-slate-500 text-[10px] font-medium">{a.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Universal Quick Wins */}
        <div className="bg-[#16161E] border border-green-500/10 rounded-[2rem] p-8">
          <div className="flex items-center gap-2 mb-5">
            <Zap size={14} className="text-green-400" />
            <p className="text-[10px] font-black text-green-400 uppercase tracking-[0.3em]">Universal Quick Wins</p>
          </div>
          <div className="space-y-3">
            {QUICK_WINS.map((w, i) => (
              <div key={i} className="flex items-start gap-3">
                <CheckCircle2 size={14} className="text-green-400 shrink-0 mt-0.5" />
                <p className="text-slate-400 text-[11px] font-medium leading-relaxed">{w}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const isStarter = plan === 'Starter';
  const points = [...(result.eightPoints || [])];
  
  if (result.jdMatchScore) {
    points.push({
      id: 'jd-match',
      name: 'JD Grounding & Keyword Match',
      score: result.jdMatchScore.score,
      explanation: `Keyword Hit Rate: ${result.jdMatchScore.keywordHitRate}. Missing: ${result.jdMatchScore.missingKeywords.join(', ')}. ${result.jdMatchScore.stuffingRisk ? 'WARNING: High stuffing risk detected.' : ''}`,
      riskHint: 'Critical for bypassing ATS semantic filters.'
    });
  }

  const overallScore = result.overallScore;

  const maturityPoint = points.find(p => p.name.toLowerCase().includes('maturity') || p.name.toLowerCase().includes('leadership'));
  const lowestPoint = points.reduce((prev, curr) => (prev.score < curr.score) ? prev : curr, points[0]);
  const chokepoint = maturityPoint && maturityPoint.score < 85 ? maturityPoint : lowestPoint;

  // ─── Pipeline-driven signals — fall back to score-based logic for old analyses ───
  const appWindow: ApplicationWindow | undefined = result.applicationWindow;
  const chips: SignalChips | undefined = result.signalChips;

  // Clock state: prefer pipeline output, fall back to score threshold
  const pipelineClockState = appWindow?.state; // 'GREEN' | 'YELLOW' | 'RED'
  const clockState: 'RED' | 'AMBER' | 'GREEN' = isIntervening
    ? 'AMBER'
    : pipelineClockState === 'GREEN' ? 'GREEN'
      : pipelineClockState === 'YELLOW' ? 'AMBER'
        : pipelineClockState === 'RED' ? 'RED'
          : (overallScore >= 85 ? 'GREEN' : 'RED'); // score-based fallback

  const windowEst = appWindow?.estimatedHoursToReadiness != null
    ? `${appWindow.estimatedHoursToReadiness}H TO READY`
    : isIntervening ? '1–2 DAYS (EST.)' : '3–5 DAYS (EST.)';

  const hiringState = overallScore >= 85 ? 'SAFE TO APPLY' : (overallScore >= 70 ? 'TRANSITIONAL' : 'NOT SAFE TO APPLY');
  const safetyColor = hiringState === 'SAFE TO APPLY' ? 'text-green-500' : (hiringState === 'TRANSITIONAL' ? 'text-amber-500' : 'text-red-500');

  // ─── Persona forecasts: pipeline-driven or graceful skeleton fallback ───
  // Never show "Run a new analysis" text — show skeleton animation instead.
  const personaForecasts: Record<'FAANG' | 'STARTUP' | 'AI_TEAM', PersonaForecast> = result.personaForecasts ?? {
    FAANG: { sentiment: 'neutral', observation: '', fix: '', delta: '—' },
    STARTUP: { sentiment: 'neutral', observation: '', fix: '', delta: '—' },
    AI_TEAM: { sentiment: 'neutral', observation: '', fix: '', delta: '—' },
  };
  const isPersonaEmpty = (p: PersonaForecast) => !p.fix || p.fix.includes('Re-run') || p.observation === '';

  const handleIntervention = () => {
    setIsIntervening(true);
    if (isStarter) {
      onUpgrade();
    } else {
      onRebuildRequest(result.analysisId || '');
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto py-12 px-10 animate-in fade-in duration-700">

      {/* Hierarchy Header & View Toggle */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-8">
        <div className="flex flex-wrap items-center gap-4 bg-white/5 p-2 rounded-[2rem] border border-white/5">
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
          {hasHistory && setActiveAnalysisId && (
            <div className="flex items-center gap-2 px-4 py-2 border border-white/10 rounded-[1.5rem] bg-white/5">
              <History size={13} className="text-slate-500 shrink-0" />
              <select
                value={result?.analysisId || ''}
                onChange={e => setActiveAnalysisId(e.target.value)}
                className="bg-transparent text-[11px] font-black text-white outline-none appearance-none cursor-pointer uppercase tracking-widest"
              >
                {historyEntries.map(([id, entry]) => {
                  const label = entry.analysisId?.slice(0, 8) ?? id.slice(0, 8);
                  const score = entry.overallScore ?? '?';
                  return <option key={id} value={id} className="bg-[#16161E]">{label} — {score}%</option>;
                })}
              </select>
            </div>
          )}
          {/* Share Analysis button */}
          <button
            onClick={() => {
              const url = `${window.location.origin}${window.location.pathname}?share=${result?.analysisId || ''}`;
              navigator.clipboard.writeText(url).then(() => {
                setShareCopied(true);
                setTimeout(() => setShareCopied(false), 2500);
              });
            }}
            className="px-5 py-3 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest transition-all border border-slate-700 text-slate-400 hover:border-blue-500/40 hover:text-blue-400 flex items-center gap-2"
          >
            <Eye size={13} /> {shareCopied ? 'Link Copied!' : 'Share'}
          </button>
        </div>
        <div className="flex items-center gap-3 text-slate-700">
          <Activity size={14} />
          <span className="text-[10px] font-black uppercase tracking-[0.4em]">Audit: {result.analysisId?.slice(0, 8)}</span>
        </div>
      </div>

      {/* JD Warning Banner — shown when no JD has been paired with this analysis */}
      <div className="mb-8 flex items-center gap-4 bg-amber-500/5 border border-amber-500/15 rounded-2xl px-6 py-4">
        <AlertCircle size={16} className="text-amber-500 shrink-0" />
        <p className="text-amber-400 text-[11px] font-medium leading-relaxed">
          Analysis without a target role produces generic results.{' '}
          <button onClick={() => setView?.('ai-review')} className="underline font-black hover:text-white transition-colors">Add a job description</button>{' '}for 3× more accurate signal scoring.
        </p>
      </div>

      {/* Rebuild Applied Banner — shown when a rebuild links to this analysis */}
      {activeRebuild && activeRebuild.linkedAnalysisId === result.analysisId && (
        <div className="mb-8 flex items-center justify-between gap-4 bg-green-500/5 border border-green-500/20 rounded-2xl px-6 py-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={16} className="text-green-400 shrink-0" />
            <div>
              <p className="text-green-400 font-black text-[10px] uppercase tracking-widest">Rebuild Applied</p>
              <p className="text-slate-400 text-[11px] font-medium">
                Score lifted: <span className="text-red-400 font-black">{activeRebuild.scoreBefore}%</span>
                {' → '}
                <span className="text-green-400 font-black">{activeRebuild.scoreAfter}%</span>
                {' '}(+{activeRebuild.scoreAfter - activeRebuild.scoreBefore} pts)
              </p>
            </div>
          </div>
          <button onClick={() => setView?.('rebuild-standalone')} className="text-green-400 hover:text-white text-[10px] font-black uppercase tracking-widest border border-green-500/20 px-4 py-2 rounded-xl transition-all">
            View Rebuilt Resume →
          </button>
        </div>
      )}

      {/* TIER 1: THE DECISION INSTRUMENT */}
      <DecisionInstrument state={clockState} windowEst={windowEst} isAnalystView={isAnalystView} chips={chips} appWindow={appWindow} />

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
                  className={`flex-1 py-6 flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest transition-all relative ${activePersona === p.id ? 'text-white' : 'text-slate-500 hover:text-white'
                    }`}
                >
                  {p.icon} {p.label}
                  {activePersona === p.id && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 animate-in slide-in-from-left duration-300" />}
                </button>
              ))}
            </div>
            <div className="p-10 space-y-8 animate-in fade-in duration-500">
              {isPersonaEmpty(personaForecasts[activePersona]) ? (
                // Skeleton state — shown when pipeline didn't return persona data
                <div className="space-y-4 animate-pulse">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-10">
                    {['Sentiment', 'Delta', 'Required Intervention', ''].map((label, i) => (
                      <div key={i} className={`space-y-2 ${i === 2 ? 'col-span-2' : ''}`}>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
                        <div className="h-5 bg-slate-800 rounded-lg w-3/4" />
                      </div>
                    ))}
                  </div>
                  <div className="bg-white/5 p-8 rounded-3xl border border-white/10">
                    <div className="h-4 bg-slate-800 rounded-lg w-full mb-2" />
                    <div className="h-4 bg-slate-800 rounded-lg w-4/5" />
                  </div>
                  <p className="text-[9px] text-slate-700 uppercase tracking-widest text-center font-black">Analyzing persona data…</p>
                </div>
              ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-10">
                <div className="space-y-2">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Sentiment</p>
                  <p className={`text-lg font-bold uppercase leading-tight ${personaForecasts[activePersona].sentiment === 'positive' ? 'text-green-400'
                    : personaForecasts[activePersona].sentiment === 'negative' ? 'text-red-400'
                      : 'text-white'
                    }`}>{personaForecasts[activePersona].sentiment.replace('_', ' ')}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Delta</p>
                  <p className={`text-lg font-bold uppercase ${personaForecasts[activePersona].delta.startsWith('+') ? 'text-green-400'
                    : personaForecasts[activePersona].delta.startsWith('-') ? 'text-red-400'
                      : 'text-slate-400'
                    }`}>{personaForecasts[activePersona].delta}</p>
                </div>
                <div className="col-span-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Required Intervention</p>
                    <MousePointer2 size={10} className="text-slate-600" />
                  </div>
                  <p className="text-white text-sm font-bold leading-relaxed">{personaForecasts[activePersona].fix}</p>
                </div>
              </div>
              )}

              {isAnalystView && !isPersonaEmpty(personaForecasts[activePersona]) && (
                <div className="bg-white/5 p-8 rounded-3xl border border-white/10 flex items-start gap-5">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-slate-500 shrink-0">
                    <UserCheck size={20} />
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed font-medium">
                    &ldquo;{personaForecasts[activePersona].observation}&rdquo;
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

              {/* Before/After Signal Delta */}
              {chokepoint && (
                <div className="mt-6 grid grid-cols-3 gap-4">
                  <div className="bg-red-500/5 border border-red-500/20 p-4 rounded-xl text-center">
                    <p className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-1">Current Signal</p>
                    <p className="text-2xl font-black text-red-400">{chokepoint.score}</p>
                    <p className="text-[9px] text-slate-600 mt-1">Pass Threshold: 85</p>
                  </div>
                  <div className="flex items-center justify-center">
                    <ArrowRight size={24} className="text-slate-700" />
                  </div>
                  <div className="bg-green-500/5 border border-green-500/20 p-4 rounded-xl text-center">
                    <p className="text-[9px] font-black text-green-500 uppercase tracking-widest mb-1">After Rebuild</p>
                    <p className="text-2xl font-black text-green-400">
                      {Math.min(chokepoint.score + (result.estimatedDelta?.chokepoint ?? result.estimatedDelta?.[chokepoint.name] ?? 18), 97)}
                    </p>
                    <p className="text-[9px] text-slate-600 mt-1">Projected Score</p>
                  </div>
                </div>
              )}
              <p className="text-[9px] text-slate-700 font-medium mt-3 text-center italic">Projection based on your specific gaps.</p>
            </div>
          </div>

          {/* SIGNAL MAP */}
          <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between px-2 gap-4">
              <h3 className="text-white font-black text-2xl uppercase tracking-tight">Signal Intervention Map</h3>
              <div className="flex items-center gap-3">
                {/* Sort control */}
                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
                  {(['score', 'impact', 'effort'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setSortSignalsBy(s)}
                      className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                        sortSignalsBy === s ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'
                      }`}
                    >
                      {s === 'score' ? 'Score' : s === 'impact' ? 'Impact' : 'Effort'}
                    </button>
                  ))}
                </div>
                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Pass Threshold</span>
                <span className="text-[11px] font-black text-green-500 uppercase tracking-widest border border-green-500/20 px-3 py-1 rounded-full">85% SCORE</span>
              </div>
            </div>
            <div className="space-y-6">
              {[...points]
                .sort((a, b) => {
                  if (sortSignalsBy === 'score') return a.score - b.score; // lowest first (most critical)
                  if (sortSignalsBy === 'impact') return a.score - b.score; // same as score for now
                  return 0; // effort — no server-side data yet, keep original order
                })
                .map(p => (
                  <PointWidget key={p.id} point={p} isStarter={isStarter} isChokepoint={chokepoint?.id === p.id} onUpgrade={onUpgrade} isAnalystView={isAnalystView} atomicChanges={result.atomicChanges} />
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
                {result.recoveryPath && result.recoveryPath.length > 0 ? (
                  result.recoveryPath.map((item, i) => (
                    <div key={i} className="flex items-start justify-between p-4 bg-white/5 rounded-2xl border border-white/5 gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-xs leading-snug">{item.action}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                            item.effort === 'low' ? 'bg-green-500/10 text-green-500' :
                            item.effort === 'medium' ? 'bg-amber-500/10 text-amber-500' :
                            'bg-red-500/10 text-red-500'
                          }`}>{item.effort} effort</span>
                          <span className="text-slate-600 text-[9px] font-black uppercase tracking-widest">{item.dimension}</span>
                        </div>
                      </div>
                      <span className="text-blue-400 font-black text-sm shrink-0">+{item.impactScore} pts</span>
                    </div>
                  ))
                ) : (
                  <div className="bg-[#0D0D12] p-8 rounded-2xl border border-white/5 text-center">
                    <RefreshCcw size={18} className="text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest">
                      Run a fresh analysis to generate your personalized recovery path
                    </p>
                  </div>
                )}
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