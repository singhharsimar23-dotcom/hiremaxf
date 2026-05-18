
import React from 'react';
import { 
  Lock, 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  BarChart3, 
  TrendingUp, 
  Target, 
  Eye, 
  Sparkles,
  ArrowDown,
  Layout,
  Radio
} from 'lucide-react';
import { AppView } from '../types';

interface FeatureTeaserProps {
  targetView: AppView;
  onUpgrade: () => void;
}

export const FeatureTeaser: React.FC<FeatureTeaserProps> = ({ targetView, onUpgrade }) => {
  const content = {
    'full-review': {
      title: "Intelligence Report",
      tag: "Deterministic Audit",
      icon: <ShieldCheck size={40} className="text-amber-500" />,
      description: "Unlock the full 8-point structural audit. This isn't generic advice—it's a mechanical check of how hiring committees and automated systems judge your profile.",
      highlights: [
        { t: "Knockout Detection", d: "Identify the silent triggers causing instant rejection.", icon: Target },
        { t: "Recruiter Skepticism", d: "See what parts of your resume are being skipped in 8 seconds.", icon: Eye },
        { t: "Metric Hardening", d: "Convert soft claims into deterministic data points.", icon: Zap }
      ],
      color: "from-amber-500/10 to-transparent"
    },
    'career-intelligence': {
      title: "Market Outlook",
      tag: "Strategy Intelligence",
      icon: <TrendingUp size={40} className="text-indigo-400" />,
      description: "Map your skills against the live job market. Know which of your skills are rising in value and which are becoming commoditized risks.",
      highlights: [
        { t: "Skill Half-life", d: "Forecast how long your technical stack stays competitive.", icon: Sparkles },
        { t: "Role Saturation", d: "Real-time applicant density metrics for Tier-1 companies.", icon: BarChart3 },
        { t: "Trajectory Pressure", d: "Identify seniority compression in your target band.", icon: TrendingUp }
      ],
      color: "from-indigo-500/10 to-transparent"
    },
    'signal-hub': {
      title: "Signal Hub",
      tag: "Hiring Loop",
      icon: <Radio size={40} className="text-blue-400" />,
      description: "Gain access to the live global hiring signal feed. We track millions of data points to identify shifts in role requirements before they become common knowledge.",
      highlights: [
        { t: "Live Deltas", d: "See how role expectations are changing weekly.", icon: Zap },
        { t: "Competitor Benchmarking", d: "See how your profile ranks against live candidate pools.", icon: Target },
        { t: "Global Feed", d: "Direct observations from over 2.4M hiring records.", icon: Radio }
      ],
      color: "from-blue-500/10 to-transparent"
    },
    'rebuild-standalone': {
      title: "Resume Rebuild",
      tag: "Mechanical Architect",
      icon: <Sparkles size={40} className="text-blue-500" />,
      description: "Convert your existing history into a role-aligned document. Our engine re-architects your phrasing for structural safety and maximum signal density.",
      highlights: [
        { t: "Role Alignment", d: "Phrasing optimized for specific industry triggers.", icon: Target },
        { t: "ATS Shield", d: "Guaranteed 100% parseability across all major systems.", icon: ShieldCheck },
        { t: "Clean Exports", d: "High-fidelity PDF assets for professional applications.", icon: Layout }
      ],
      color: "from-blue-500/10 to-transparent"
    }
  }[targetView as string] || {
    title: "Premium Feature",
    tag: "Pro Access",
    icon: <Lock size={40} className="text-slate-500" />,
    description: "Upgrade your plan to unlock full access to HireMax professional career intelligence.",
    highlights: [],
    color: "from-slate-500/10 to-transparent"
  };

  return (
    <div className="min-h-screen bg-[#0F1117] flex flex-col">
      <section className={`relative flex-1 flex flex-col items-center justify-center px-10 py-24 bg-gradient-to-b ${content.color}`}>
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[size:30px_30px] bg-[radial-gradient(circle,white_1px,transparent_1px)]" />
        
        <div className="max-w-4xl w-full space-y-12 relative z-10 text-center">
          <div className="flex flex-col items-center gap-6">
            <div className="w-20 h-20 rounded-[2rem] bg-[#16161E] border border-[#2D313D] flex items-center justify-center shadow-2xl animate-in zoom-in duration-500">
              {content.icon}
            </div>
            <div className="space-y-2">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em]">{content.tag}</span>
              <h2 className="text-6xl font-black text-white tracking-tighter uppercase">{content.title}</h2>
            </div>
          </div>

          <p className="text-xl md:text-2xl text-slate-400 font-medium leading-relaxed max-w-2xl mx-auto">
            {content.description}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left pt-8">
            {content.highlights.map((h, i) => (
              <div key={i} className="p-8 bg-[#16161E] border border-[#1D1D26] rounded-3xl space-y-4 hover:border-blue-500/30 transition-all group">
                <div className="text-blue-500 group-hover:scale-110 transition-transform">
                  <h.icon size={24} />
                </div>
                <h4 className="text-white font-bold text-lg">{h.t}</h4>
                <p className="text-slate-500 text-sm leading-relaxed">{h.d}</p>
              </div>
            ))}
          </div>

          <div className="pt-12 flex flex-col items-center gap-8">
            <button 
              onClick={onUpgrade}
              className="bg-blue-600 hover:bg-blue-500 text-white font-black py-6 px-16 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-2xl shadow-blue-900/40 uppercase tracking-[0.2em] text-xs"
            >
              Unlock This Intelligence <ArrowRight size={20} />
            </button>
            <div className="flex flex-col items-center gap-2 animate-bounce opacity-40">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Scroll to compare plans</span>
              <ArrowDown size={14} className="text-slate-500" />
            </div>
          </div>
        </div>
      </section>

      {/* Visual Teaser Mockup Section */}
      <section className="bg-[#0D0D12] py-32 border-y border-[#1D1D26]">
        <div className="max-w-6xl mx-auto px-10">
          <div className="relative group">
            <div className="absolute inset-0 bg-blue-500/5 blur-[120px] rounded-full" />
            <div className="relative bg-[#16161E] border border-[#2D313D] rounded-[4rem] p-16 overflow-hidden shadow-2xl">
              <div className="absolute inset-0 backdrop-blur-[6px] bg-black/40 z-20 flex items-center justify-center group-hover:bg-black/20 transition-all duration-700">
                 <div className="bg-[#0F1117] border border-[#2D313D] p-8 rounded-[2rem] text-center shadow-2xl transform group-hover:scale-105 transition-transform">
                   <Lock className="text-blue-500 mx-auto mb-4" size={32} />
                   <p className="text-white font-black text-xl uppercase tracking-tight mb-2">Mechanical Data Locked</p>
                   <p className="text-slate-500 text-sm font-medium">Upgrade to view personalized market signals for your profile.</p>
                 </div>
              </div>
              
              <div className="space-y-10 opacity-20 select-none grayscale pointer-events-none">
                 <div className="flex justify-between items-end border-b border-white/5 pb-8">
                   <div className="h-10 w-64 bg-slate-800 rounded-xl" />
                   <div className="h-16 w-32 bg-slate-800 rounded-xl" />
                 </div>
                 <div className="grid grid-cols-3 gap-8">
                   <div className="h-48 bg-slate-800 rounded-3xl" />
                   <div className="h-48 bg-slate-800 rounded-3xl" />
                   <div className="h-48 bg-slate-800 rounded-3xl" />
                 </div>
                 <div className="space-y-4">
                   <div className="h-4 w-full bg-slate-800 rounded" />
                   <div className="h-4 w-5/6 bg-slate-800 rounded" />
                   <div className="h-4 w-2/3 bg-slate-800 rounded" />
                 </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
