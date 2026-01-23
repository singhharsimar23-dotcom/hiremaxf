
import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Zap, 
  ChevronDown, 
  ChevronUp,
  Target,
  Lock,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { DiagnosticResult, EightPointItem, UserPlan } from '../types';

interface FullReviewViewProps {
  result: DiagnosticResult | null;
  plan: UserPlan;
  onUpgrade: () => void;
  onRebuildRequest: (analysisId: string) => void;
}

const PointWidget: React.FC<{ point: EightPointItem }> = ({ point }) => {
  const [expanded, setExpanded] = useState(false);

  const getStatusColor = (score: number) => {
    if (score >= 90) return 'text-green-400';
    if (score >= 75) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div className={`bg-[#16161E] border border-[#1D1D26] rounded-3xl overflow-hidden transition-all ${expanded ? 'border-blue-500/30' : 'hover:border-blue-500/20'}`}>
      <div 
        onClick={() => setExpanded(!expanded)}
        className="p-8 flex items-center justify-between cursor-pointer group"
      >
        <div className="flex items-center gap-6">
          <div className={`text-3xl font-black ${getStatusColor(point.score)}`}>
            {point.score}
          </div>
          <div>
            <h3 className="text-white font-bold text-lg tracking-tight group-hover:text-blue-400 transition-colors">{point.name}</h3>
            <p className="text-slate-500 text-xs font-medium uppercase tracking-widest">Mechanical Assessment</p>
          </div>
        </div>
        <div className="text-slate-500">
          {expanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
        </div>
      </div>

      {expanded && (
        <div className="px-8 pb-8 space-y-8 animate-in slide-in-from-top-2 duration-300">
          <div className="h-[1px] bg-white/5" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Detailed Explanation</h4>
              <p className="text-slate-400 text-sm leading-relaxed font-medium">
                {point.explanation || "System generated analysis of structural and content signals."}
              </p>
            </div>
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Evidence & Flags</h4>
              <ul className="space-y-2">
                {point.evidence?.map((e, i) => (
                  <li key={i} className="text-xs text-slate-300 flex gap-2">
                    <span className="text-slate-600">•</span> {e}
                  </li>
                )) || <li className="text-xs text-slate-500">No specific flags detected.</li>}
              </ul>
            </div>
          </div>
          <div className="p-6 bg-blue-600/5 border border-blue-500/10 rounded-2xl">
             <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">Market Implications</h4>
             <p className="text-slate-300 text-xs font-medium leading-relaxed italic">
                {point.implications || "Recruiters in high-volume environments may filter based on this specific threshold."}
             </p>
          </div>
        </div>
      )}
    </div>
  );
};

export const FullReviewView: React.FC<FullReviewViewProps> = ({ result, plan, onUpgrade, onRebuildRequest }) => {
  if (!result) {
    return (
      <div className="max-w-4xl mx-auto py-40 text-center">
        <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-8 border border-slate-800">
          <ShieldCheck className="text-slate-600" size={32} />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2 uppercase tracking-tight">Report Not Generated</h2>
        <p className="text-slate-500">Initialize a foundation assessment to unlock the Intelligence Report.</p>
      </div>
    );
  }

  const tsScore = result?.eightPoints?.find(p => p.id === 'ats_parseability')?.score || 100;
  const tsSafe = tsScore >= 75;

  return (
    <div className="max-w-[1200px] mx-auto py-12 px-10">
      <div className="mb-16">
        <div className="flex items-center gap-3 text-amber-500 mb-4 bg-amber-500/5 w-fit px-4 py-1 rounded-full border border-amber-500/10">
          <Zap size={14} />
          <span className="text-[10px] font-black uppercase tracking-widest">Resume Intelligence Report</span>
        </div>
        <h2 className="text-5xl font-bold text-white mb-4 tracking-tighter uppercase">Detailed Evaluation</h2>
        <p className="text-slate-500 text-lg font-medium">Mechanical audit of hiring signals for {result?.role}.</p>
      </div>

      {!tsSafe && (
        <div className="mb-12 p-8 bg-red-600/5 border border-red-500/20 rounded-[2.5rem] flex items-center gap-8">
           <div className="w-16 h-16 rounded-2xl bg-red-600/10 flex items-center justify-center text-red-500 shrink-0">
              <ShieldCheck size={32} />
           </div>
           <div>
              <h4 className="text-white font-bold text-xl mb-1">ATS Parseability Warning (TS &lt; 75)</h4>
              <p className="text-slate-400 text-sm font-medium">
                Your resume layout poses a high auto-reject risk. The following evaluation points are informational only until the structure is fixed.
              </p>
           </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-12 mb-20">
        <div className="lg:col-span-3 space-y-6">
          {result?.eightPoints?.map(point => (
            <PointWidget key={point.id} point={point} />
          ))}
        </div>

        <div className="space-y-8">
          <div className="bg-[#16161E] border border-[#1D1D26] rounded-3xl p-8 shadow-xl">
             <h3 className="text-white font-bold text-lg mb-6 flex items-center gap-2">
                <Target size={20} className="text-blue-500" /> Focus Areas
             </h3>
             <div className="space-y-6">
                <div className="space-y-2">
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Critical Blocker</p>
                   <p className="text-sm font-bold text-white">{tsSafe ? "None Detected" : "Structure Refactoring"}</p>
                </div>
                <div className="space-y-2">
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Top Leverage</p>
                   <p className="text-sm font-bold text-white">Value Density Improvement</p>
                </div>
             </div>
          </div>
        </div>
      </div>

      <div className="space-y-12 pb-20">
        {plan === 'Career Pro' && (
          <div className="bg-[#16161E] border border-[#1D1D26] rounded-[3rem] p-12">
            <h3 className="text-2xl font-bold text-white mb-8 tracking-tight">Career Improvement</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
              {['Skill Gap Guidance', 'Skill Trend Intelligence', 'Extended Career Longevity', 'Recruiter Skepticism Layer'].map((label, idx) => (
                <div key={idx} className="bg-[#0D0D12] border border-[#1D1D26] p-6 rounded-2xl relative overflow-hidden group">
                  <div className="blur-sm select-none">
                    <div className="w-10 h-10 bg-slate-800 rounded-lg mb-4 opacity-20"></div>
                    <div className="h-4 bg-slate-800 rounded w-3/4 mb-2 opacity-20"></div>
                    <div className="h-3 bg-slate-800 rounded w-1/2 opacity-20"></div>
                  </div>
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-t border-white/5 pt-10">
              <p className="text-slate-400 font-medium">Unlock long-term career insights with Career Elite.</p>
              <button 
                onClick={onUpgrade}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-10 rounded-xl transition-all shadow-xl shadow-indigo-900/20"
              >
                Upgrade to Career Elite
              </button>
            </div>
          </div>
        )}

        {(plan === 'Career Pro' || plan === 'Career Elite') && (
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-[3rem] p-12 text-white flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-10 opacity-10">
              <Sparkles size={160} />
            </div>
            <div className="relative z-10 max-w-2xl">
              <h3 className="text-3xl font-bold mb-3 tracking-tight">Apply These Improvements</h3>
              <p className="text-blue-100 font-medium leading-relaxed opacity-90">
                Convert your intelligence report into a market-ready document. Our deterministic rebuild utility optimizes your phrasing based on current screening patterns.
              </p>
            </div>
            <button 
              onClick={() => onRebuildRequest(result?.analysisId ?? '')}
              className="relative z-10 bg-white text-blue-900 font-black py-5 px-12 rounded-2xl shadow-2xl hover:bg-blue-50 transition-all flex items-center gap-3 uppercase tracking-widest text-xs"
            >
              Rebuild Resume Using These Insights <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
