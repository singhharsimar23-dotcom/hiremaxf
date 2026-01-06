
import React from 'react';
import { 
  BarChart3, 
  ArrowRight,
  Target,
  Zap,
  ShieldCheck,
  TrendingUp
} from 'lucide-react';

const MetricTile: React.FC<{ label: string; subLabel: string; value?: string; colorClass?: string }> = ({ label, subLabel, value, colorClass = "text-white" }) => (
  <div className="flex flex-col gap-1 border-r border-[#1D1D26] px-8 last:border-0 first:pl-0">
    <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-600">{label}</p>
    <p className="text-[11px] font-bold text-gray-500 mb-2">{subLabel}</p>
    {value && <h4 className={`text-3xl font-black tracking-tighter ${colorClass}`}>{value}</h4>}
  </div>
);

const RealityCheckDetail: React.FC<{ onStart?: () => void }> = ({ onStart }) => {
  return (
    <div className="bg-[#16161E] rounded-[3rem] p-12 border border-[#1D1D26] flex flex-col gap-12 shadow-2xl">
      <div className="flex flex-col md:flex-row justify-between items-start gap-12">
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-6">
             <div className="w-12 h-12 rounded-[1.25rem] bg-blue-500/10 flex items-center justify-center text-blue-500">
                <Target size={28} />
             </div>
             <div>
                <h2 className="text-3xl font-black text-white tracking-tight">Market Reality Check</h2>
                <p className="text-gray-500 font-medium">How does the hiring market see your profile?</p>
             </div>
          </div>
          <p className="text-gray-400 font-medium max-w-xl mb-10 leading-relaxed opacity-80">
            Get an honest assessment of your job prospects based on your current resume signals and target role. 
            We analyze live market benchmarks to determine your competitiveness.
          </p>
          <button 
            onClick={onStart}
            className="flex items-center gap-4 w-full justify-center bg-[#0D0D12] border border-[#1D1D26] text-white py-5 rounded-[1.5rem] font-black uppercase tracking-[0.15em] text-xs hover:bg-blue-600 hover:border-blue-600 transition-all group shadow-xl"
          >
            Initialize Assessment <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <div className="w-full md:w-96 bg-[#0D0D12] p-10 rounded-[2.5rem] border border-[#1D1D26] shadow-2xl">
          <div className="flex items-center gap-3 mb-8">
            <Zap size={20} className="text-blue-500 fill-blue-500" />
            <span className="text-white font-black text-sm uppercase tracking-widest">Engine Status</span>
          </div>
          <div className="space-y-8">
            <div className="relative h-2 bg-[#16161E] rounded-full overflow-hidden">
               <div className="h-full bg-blue-600 w-2/3 shadow-[0_0_10px_rgba(37,99,235,0.5)]"></div>
            </div>
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
               <span>Heuristics</span>
               <span className="text-white">Active Simulation</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 py-6 border-t border-[#1D1D26]">
        <MetricTile label="Market Score" subLabel="Competitiveness" value="82/100" colorClass="text-blue-500" />
        <MetricTile label="Salary Potential" subLabel="Estimated Gap" value="+$14k" colorClass="text-indigo-400" />
        <MetricTile label="Saturation" subLabel="Role Overcrowding" value="Medium" />
        <MetricTile label="Optimization" subLabel="Fatal Signals" value="3 Detected" colorClass="text-red-500" />
      </div>
    </div>
  );
};

export default RealityCheckDetail;
