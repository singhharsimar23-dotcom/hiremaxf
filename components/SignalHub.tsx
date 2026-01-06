
import React from 'react';
import { 
  Terminal, 
  Cpu, 
  Eye, 
  Activity, 
  ShieldAlert, 
  BarChart2, 
  History,
  ArrowRight,
  TrendingUp,
  ZapOff,
  Clock,
  Lock
} from 'lucide-react';
import { DiagnosticResult, AppView } from '../types';

const HubCard: React.FC<{ 
  title: string; 
  description: string; 
  icon: React.ReactNode; 
  onAction: () => void;
  status?: string;
  disabled?: boolean;
}> = ({ title, description, icon, onAction, status = "Operational", disabled = false }) => (
  <div className={`bg-[#16161E] rounded-[2.5rem] p-10 border border-[#1D1D26] transition-all group shadow-2xl flex flex-col h-full ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:border-blue-500/30 cursor-pointer'}`}>
    <div className="flex justify-between items-start mb-10">
      <div className={`w-14 h-14 rounded-2xl bg-[#0D0D12] border border-[#1D1D26] flex items-center justify-center text-blue-500 transition-transform ${!disabled && 'group-hover:scale-110'}`}>
        {disabled ? <Lock size={20} className="text-gray-700" /> : icon}
      </div>
      <div className="text-right">
        <span className={`text-[9px] font-black uppercase tracking-widest ${disabled ? 'text-gray-700' : 'text-blue-500'}`}>{disabled ? 'Locked' : status}</span>
        <div className="flex items-center gap-1 justify-end mt-1">
          <div className={`w-1 h-1 rounded-full ${disabled ? 'bg-gray-800' : 'bg-blue-500 animate-pulse'}`} />
          <span className="text-[8px] text-gray-600 font-bold uppercase tracking-tighter">{disabled ? 'Pending Analysis' : 'Live Market Sync'}</span>
        </div>
      </div>
    </div>
    <h3 className={`text-2xl font-black tracking-tighter mb-4 ${disabled ? 'text-gray-700' : 'text-white'}`}>{title}</h3>
    <p className={`text-sm leading-relaxed mb-10 flex-1 font-medium ${disabled ? 'text-gray-800' : 'text-gray-500 opacity-80'}`}>
      {description}
    </p>
    <button 
      onClick={(e) => { e.stopPropagation(); if (!disabled) onAction(); }}
      disabled={disabled}
      className={`flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${disabled ? 'text-gray-800' : 'text-white group-hover:text-blue-400'}`}
    >
      {disabled ? 'Analyze Resume to Unlock' : 'Initialize Module'} <ArrowRight size={14} className={!disabled ? 'group-hover:translate-x-2 transition-transform' : ''} />
    </button>
  </div>
);

export const SignalHub: React.FC<{ result: DiagnosticResult | null; setView: (v: AppView) => void }> = ({ result, setView }) => {
  const hasResult = !!result;

  const features = [
    {
      title: "Diagnostic Engine",
      description: "Perform a systemic 8-point failure detection against current market benchmarks. Normalizes structural signals.",
      icon: <Cpu size={28} />,
      view: 'ai-review' as AppView,
      requireResult: false
    },
    {
      title: "Recruiter Scan",
      description: "Simulates human triage behavior (6-10s pass). Maps immediately visible signals and flags early rejection triggers.",
      icon: <Eye size={28} />,
      view: 'recruiter-scan' as AppView,
      requireResult: true
    },
    {
      title: "Rejection Probability",
      description: "Models relative likelihood of rejection across 5 common buckets using mechanical observational data.",
      icon: <ZapOff size={28} />,
      view: 'rejection-model' as AppView,
      requireResult: true
    },
    {
      title: "Role Saturation Index",
      description: "Calculates applicant volume vs. hiring demand for target roles to report current competition intensity.",
      icon: <BarChart2 size={28} />,
      view: 'role-saturation' as AppView,
      requireResult: true
    },
    {
      title: "Skill Obsolescence Radar",
      description: "Flags narratives and tools losing market weight. Synchronized with live job description data feeds.",
      icon: <History size={28} />,
      view: 'skill-radar' as AppView,
      requireResult: true
    },
    {
      title: "Longevity Estimate",
      description: "Reports competitiveness durability based on skill half-life and live market movement trends.",
      icon: <Clock size={28} />,
      view: 'longevity-estimate' as AppView,
      requireResult: true
    }
  ];

  return (
    <div className="max-w-7xl mx-auto py-12 px-10">
      <div className="mb-16">
        <div className="flex items-center gap-3 text-blue-500 mb-6 bg-blue-500/5 w-fit px-4 py-1.5 rounded-full border border-blue-500/10">
          <Terminal size={14} />
          <span className="text-[10px] font-black uppercase tracking-widest">Internal System Directory</span>
        </div>
        <h2 className="text-6xl font-black text-white tracking-tighter leading-none mb-4">Signal Hub</h2>
        <p className="text-gray-500 text-xl font-medium max-w-2xl">
          Unified command for all HireMax AI screening simulations and observational modules.
        </p>
      </div>

      {!hasResult && (
        <div className="mb-12 p-8 bg-blue-600/10 border border-blue-600/20 rounded-[2rem] flex items-center justify-between">
           <div className="flex items-center gap-6">
              <ShieldAlert className="text-blue-500" size={32} />
              <div>
                 <p className="text-white font-black text-lg">System Baseline Required</p>
                 <p className="text-gray-500 text-sm font-medium">Detailed observational modules require an active resume analysis result.</p>
              </div>
           </div>
           <button 
            onClick={() => setView('ai-review')}
            className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-500 transition-all"
           >
              Initialize Assessment
           </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {features.map((f, i) => (
          <HubCard 
            key={i}
            title={f.title}
            description={f.description}
            icon={f.icon}
            onAction={() => setView(f.view)}
            disabled={f.requireResult && !hasResult}
          />
        ))}
      </div>

      <div className="mt-20 p-12 bg-[#16161E] rounded-[3rem] border border-[#1D1D26] flex flex-col md:flex-row items-center justify-between gap-10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <TrendingUp size={200} />
        </div>
        <div className="relative z-10">
          <h3 className="text-3xl font-black text-white tracking-tighter mb-2">Market Data Ingestion Status</h3>
          <p className="text-gray-500 font-bold text-sm uppercase tracking-widest">Last Sync: Today 14:22 UTC (Real-time)</p>
        </div>
        <div className="flex items-center gap-8 relative z-10">
          <div className="text-center">
            <p className="text-[10px] font-black text-gray-600 uppercase mb-1">Active Nodes</p>
            <p className="text-2xl font-black text-blue-500">12,482</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-black text-gray-600 uppercase mb-1">Signal Fidelity</p>
            <p className="text-2xl font-black text-green-500">99.2%</p>
          </div>
        </div>
      </div>
    </div>
  );
};
