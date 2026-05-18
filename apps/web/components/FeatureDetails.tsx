
import React from 'react';
import {
  Eye,
  ZapOff,
  BarChart3,
  History,
  Clock,
  ArrowLeft,
  ChevronRight,
  ShieldAlert,
  Terminal,
  AlertTriangle,
  Activity,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { DiagnosticResult, AppView } from '../types';

interface FeaturePageProps {
  view: 'recruiter-scan' | 'rejection-model' | 'role-saturation' | 'skill-radar' | 'longevity-estimate';
  result: DiagnosticResult | null;
  setView: (v: AppView) => void;
}

export const FeatureDetails: React.FC<FeaturePageProps> = ({ view, result, setView }) => {
  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <ShieldAlert size={48} className="text-gray-800" />
        <p className="text-gray-500 font-black uppercase tracking-widest">System Incomplete: Run Analysis First</p>
        <button
          onClick={() => setView('ai-review')}
          className="bg-[#16161E] text-white px-8 py-3 rounded-2xl border border-[#1D1D26] hover:border-blue-500 transition-all"
        >
          Initialize Assessment
        </button>
      </div>
    );
  }

  const renderContent = () => {
    switch (view) {
      case 'recruiter-scan':
        return (
          <div className="space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {['visible', 'skipped', 'concern'].map((cat) => (
                <div key={cat} className="bg-[#16161E] p-10 rounded-[2.5rem] border border-[#1D1D26] shadow-xl">
                  <p className={`text-[10px] font-black uppercase tracking-[0.3em] mb-8 ${cat === 'visible' ? 'text-green-500' : cat === 'skipped' ? 'text-gray-500' : 'text-red-500'
                    }`}>
                    {cat === 'visible' ? 'Visible (First 8s)' : cat === 'skipped' ? 'Likely Skipped' : 'Raises Concern'}
                  </p>
                  <div className="space-y-6">
                    {result.recruiterScan.filter(o => o.category === cat).map((o, idx) => (
                      <div key={idx} className="space-y-2 border-b border-[#1D1D26] pb-6 last:border-0">
                        <p className="text-white font-black text-xs uppercase tracking-tight">{o.element}</p>
                        <p className="text-gray-500 text-xs leading-relaxed font-medium">{o.observation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'rejection-model':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {result.rejectionReasons.map((reason, idx) => (
              <div key={idx} className="bg-[#16161E] p-10 rounded-[2.5rem] border border-[#1D1D26] shadow-xl">
                <div className="flex justify-between items-start mb-10">
                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${reason.probability === 'High' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                      reason.probability === 'Medium' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                        'bg-green-500/10 text-green-500 border-green-500/20'
                    }`}>
                    {reason.probability} Probability
                  </span>
                </div>
                <h3 className="text-2xl font-black text-white tracking-tighter mb-4">{reason.reason}</h3>
                <p className="text-gray-500 text-xs leading-relaxed font-medium italic">
                  {reason.explanation}
                </p>
              </div>
            ))}
          </div>
        );

      case 'role-saturation':
        return (
          <div className="max-w-3xl mx-auto text-center py-20 bg-[#16161E] rounded-[3.5rem] border border-[#1D1D26] shadow-2xl px-12">
            <BarChart3 size={64} className="text-blue-500 mx-auto mb-10" />
            <h3 className="text-4xl font-black text-white tracking-tighter mb-4">Saturation Index: {result.roleSaturation}</h3>
            <p className="text-gray-500 text-lg font-medium leading-relaxed opacity-80">
              The target role for {result.role} shows {result.roleSaturation.toLowerCase()} applicant density relative to active headcount listings.
              Recruiter throughput is currently adjusted for high volume screening.
            </p>
          </div>
        );

      case 'skill-radar':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {result.skillRadar.map((item, idx) => (
              <div key={idx} className="bg-[#16161E] p-10 rounded-[3rem] border border-[#1D1D26] flex items-center justify-between group hover:border-blue-500/30 transition-all shadow-xl">
                <div>
                  <h4 className="text-xl font-black text-white tracking-tighter mb-2">{item.skill}</h4>
                  <p className="text-gray-500 text-xs font-medium uppercase tracking-widest">{item.marketNote}</p>
                </div>
                <div className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border ${item.status === 'Declining' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                  }`}>
                  {item.status}
                </div>
              </div>
            ))}
          </div>
        );

      case 'longevity-estimate':
        return (
          <div className="max-w-3xl mx-auto space-y-12">
            <div className="bg-[#16161E] p-16 rounded-[3.5rem] border border-[#1D1D26] shadow-2xl text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-[0.03]">
                <Clock size={200} />
              </div>
              <p className="text-[10px] font-black text-gray-600 uppercase tracking-[0.4em] mb-4">Structural Durability</p>
              <h3 className="text-7xl font-black text-white tracking-tighter mb-8 leading-none">{result.longevityEstimate.status}</h3>
              <div className="h-[1px] w-12 bg-gray-800 mx-auto mb-8" />
              <p className="text-gray-400 text-lg leading-relaxed italic font-medium">
                {result.longevityEstimate.reasoning}
              </p>
            </div>
            <div className="p-8 bg-blue-600/5 border border-blue-500/20 rounded-[2rem] text-center">
              <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Note: Longevity is mapped to skill half-life and live market movement trends.</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const titles = {
    'recruiter-scan': 'Recruiter Scan Simulation',
    'rejection-model': 'Rejection Probability Model',
    'role-saturation': 'Role Saturation Index',
    'skill-radar': 'Skill Obsolescence Radar',
    'longevity-estimate': 'Resume Longevity Estimate'
  };

  const icons = {
    'recruiter-scan': <Eye size={32} />,
    'rejection-model': <ZapOff size={32} />,
    'role-saturation': <BarChart3 size={32} />,
    'skill-radar': <History size={32} />,
    'longevity-estimate': <Clock size={32} />
  };

  return (
    <div className="max-w-7xl mx-auto py-12 px-10">
      <div className="flex justify-between items-center mb-16">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setView('signal-hub')}
            className="w-14 h-14 rounded-2xl bg-[#16161E] border border-[#1D1D26] flex items-center justify-center text-gray-400 hover:text-white transition-all shadow-xl"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <div className="flex items-center gap-3 text-blue-500 mb-2">
              <Terminal size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">Market Observation Sub-Module</span>
            </div>
            <h2 className="text-5xl font-black text-white tracking-tighter">{titles[view]}</h2>
          </div>
        </div>
        <div className="w-16 h-16 rounded-3xl bg-[#16161E] border border-[#1D1D26] flex items-center justify-center text-blue-500 shadow-inner">
          {icons[view]}
        </div>
      </div>

      {renderContent()}

      <div className="mt-20 py-10 border-t border-[#1D1D26] text-center">
        <p className="text-[10px] font-black text-gray-700 uppercase tracking-[0.5em] mb-4">Mechanical Evaluation</p>
        <p className="text-gray-600 text-xs max-w-2xl mx-auto leading-relaxed font-medium">
          This observational diagnostic maps resume signals against active hiring heuristics. It contains no advice, predictions, or guarantees of outcome. All values are relative to current market volatility.
        </p>
      </div>
    </div>
  );
};
