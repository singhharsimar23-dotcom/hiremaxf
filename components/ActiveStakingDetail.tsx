
import React from 'react';
import { Target, Search, ArrowRight, CheckCircle } from 'lucide-react';

const MetricTile: React.FC<{ label: string; subLabel: string; value: string; colorClass?: string }> = ({ label, subLabel, value, colorClass = "text-white" }) => (
  <div className="flex flex-col gap-2 p-6 border-r border-[#2D313D] last:border-0">
    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
    <h4 className={`text-3xl font-extrabold tracking-tight ${colorClass}`}>{value}</h4>
    <p className="text-[12px] font-semibold text-slate-600 leading-tight">{subLabel}</p>
  </div>
);

const RealityCheckDetail: React.FC<{ onStart?: () => void }> = ({ onStart }) => {
  return (
    <div className="bg-[#1A1D26] rounded-[2.5rem] border border-[#2D313D] flex flex-col shadow-2xl overflow-hidden">
      <div className="p-10 flex flex-col md:flex-row justify-between items-center gap-10">
        <div className="flex-1 space-y-6 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-4">
             <div className="w-14 h-14 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-500">
                <Search size={32} />
             </div>
             <div>
                <h2 className="text-3xl font-bold text-white tracking-tight">Check Your Market Readiness</h2>
                <p className="text-slate-500 font-bold text-sm">See how recruiters view your resume</p>
             </div>
          </div>
          <p className="text-slate-400 text-lg leading-relaxed max-w-xl mx-auto md:mx-0 font-medium">
            Find out if your resume is ready for the roles you want. We'll help you spot strengths 
            and identify clear ways to stand out.
          </p>
          <button 
            onClick={onStart}
            className="flex items-center gap-3 bg-blue-600 text-white px-10 py-4 rounded-2xl font-bold text-base hover:bg-blue-500 transition-all group shadow-xl shadow-blue-900/20"
          >
            Start My Free Review <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <div className="w-full md:w-80 bg-[#0F1117] p-8 rounded-3xl border border-[#2D313D] space-y-6">
          <div className="flex items-center gap-3">
            <CheckCircle size={20} className="text-green-500" />
            <span className="text-white font-bold text-sm">Review Status</span>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-end">
               <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Readiness Level</span>
               <span className="text-sm font-bold text-white">Baseline</span>
            </div>
            <div className="h-1.5 bg-[#1A1D26] rounded-full overflow-hidden">
               <div className="h-full bg-blue-600 w-1/3 opacity-30"></div>
            </div>
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
              Takes about 90 seconds to provide a full mentor-guided analysis.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 bg-[#0D0F14] border-t border-[#2D313D]">
        <MetricTile label="Market Fit" subLabel="Target alignment" value="---" colorClass="text-slate-600" />
        <MetricTile label="Strengths" subLabel="Key highlights" value="---" colorClass="text-slate-600" />
        <MetricTile label="ATS Score" subLabel="Readability" value="---" colorClass="text-slate-600" />
        <MetricTile label="Readiness" subLabel="Overall standing" value="---" colorClass="text-slate-600" />
      </div>
    </div>
  );
};

export default RealityCheckDetail;
