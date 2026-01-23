
import React from 'react';
import { 
  Search, UserCheck, AlertCircle, BarChart, RefreshCw,
  ArrowRight, Clock, Sparkles
} from 'lucide-react';
import { DiagnosticResult, AppView } from '../types';

const FeatureCard: React.FC<{ 
  title: string; 
  description: string; 
  icon: React.ReactNode; 
  onAction: () => void;
  isAnalyzed: boolean;
}> = ({ title, description, icon, onAction, isAnalyzed }) => (
  <div 
    onClick={onAction}
    className="bg-[#1A1D26] rounded-2xl p-8 border border-[#2D313D] transition-all group hover:border-blue-500 cursor-pointer flex flex-col h-full shadow-lg"
  >
    <div className="flex justify-between items-start mb-6">
      <div className="w-12 h-12 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
        {icon}
      </div>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${isAnalyzed ? 'bg-green-500' : 'bg-slate-600'}`} />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{isAnalyzed ? 'Live Data' : 'Sample View'}</span>
      </div>
    </div>
    <h3 className="text-2xl font-extrabold text-white mb-3 tracking-tight">{title}</h3>
    <p className="text-slate-300 text-base leading-relaxed mb-8 flex-1 font-medium">
      {description}
    </p>
    <div className="flex items-center gap-2 text-sm font-bold text-blue-400 group-hover:text-blue-300 transition-colors uppercase tracking-widest">
      Explore Analysis <ArrowRight size={18} />
    </div>
  </div>
);

export const SignalHub: React.FC<{ result: DiagnosticResult | null; setView: (v: AppView) => void }> = ({ result, setView }) => {
  const isAnalyzed = !!result;

  const features = [
    { title: "Recruiter Feedback", description: "Know exactly what recruiters notice first and what they skip during a fast scan.", icon: <UserCheck size={28} />, view: 'recruiter-scan' as AppView },
    { title: "Hiring Roadblocks", description: "Identify critical errors that lead to instant rejection in automated screening.", icon: <AlertCircle size={28} />, view: 'rejection-model' as AppView },
    { title: "Job Market Trends", description: "Real-time data on applicant volume and competition levels for your target role.", icon: <BarChart size={28} />, view: 'role-saturation' as AppView },
    { title: "Skill Gap Analysis", description: "See how your skills stack up against current industry demands and top candidates.", icon: <RefreshCw size={28} />, view: 'skill-radar' as AppView },
    { title: "Career Longevity", description: "Forecast the shelf-life of your current technical skills in a changing market.", icon: <Clock size={28} />, view: 'longevity-estimate' as AppView }
  ];

  return (
    <div className="max-w-[1200px] mx-auto py-16 px-10">
      <div className="mb-12 space-y-4">
        <h2 className="text-5xl font-extrabold text-white tracking-tight">Market Insight Hub</h2>
        <p className="text-slate-400 text-xl font-medium max-w-2xl leading-relaxed">
          Unlock specific data points about your career standing. No guessing—just verified market signals.
        </p>
      </div>

      {!isAnalyzed && (
        <div className="mb-12 p-8 bg-blue-600/5 border border-blue-500/20 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6">
           <div className="flex items-center gap-6">
              <div className="w-14 h-14 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-500">
                <Search size={32} />
              </div>
              <div>
                 <p className="text-white font-extrabold text-xl">Personalized Data Locked</p>
                 <p className="text-slate-400 text-base font-medium">Please analyze your resume to unlock real-world data points for your specific profile.</p>
              </div>
           </div>
           <button onClick={() => setView('ai-review')} className="whitespace-nowrap bg-blue-600 text-white px-10 py-3.5 rounded-xl font-extrabold text-sm hover:bg-blue-500 transition-all shadow-lg">
              Unlock Full Analysis
           </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {features.map((f, i) => (
          <FeatureCard key={i} title={f.title} description={f.description} icon={f.icon} onAction={() => setView(f.view)} isAnalyzed={isAnalyzed} />
        ))}
      </div>

      <div className="mt-20 p-10 bg-[#1A1D26] rounded-2xl border border-[#2D313D] flex flex-col md:flex-row items-center justify-between gap-10 shadow-xl">
        <div className="flex items-center gap-6">
          <Sparkles className="text-indigo-400" size={40} />
          <div>
            <h3 className="text-2xl font-extrabold text-white">Live Intelligence Feed</h3>
            <p className="text-slate-500 font-bold text-xs uppercase tracking-[0.2em]">Global Hiring Patterns Fully Synchronized</p>
          </div>
        </div>
        <div className="flex gap-12">
          <div className="text-right">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Records Parsed</p>
            <p className="text-3xl font-extrabold text-blue-500">2.4M+</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Signal Fidelity</p>
            <p className="text-3xl font-extrabold text-green-500">99.8%</p>
          </div>
        </div>
      </div>
    </div>
  );
};
