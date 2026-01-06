
import React from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  Layers, 
  BarChart2, 
  ScanSearch, 
  ShieldCheck,
  Circle,
  FileCode,
  Globe,
  Grid
} from 'lucide-react';
import { WEEKLY_GOALS } from '../constants';

const SidebarLink: React.FC<{ 
  icon: React.ReactNode; 
  label: string; 
  active?: boolean;
  onClick: () => void;
}> = ({ 
  icon, label, active, onClick 
}) => (
  <div 
    onClick={onClick}
    className={`flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer transition-all duration-300 ${
      active ? 'bg-blue-600/10 text-white border border-blue-500/20 shadow-lg shadow-blue-500/5' : 'text-gray-400 hover:text-white hover:bg-[#16161E]'
    }`}
  >
    <span className={active ? 'text-blue-500' : 'text-gray-500'}>{icon}</span>
    <span className="text-sm font-bold tracking-tight">{label}</span>
  </div>
);

const Sidebar: React.FC<{ currentView: string; setView: (v: any) => void }> = ({ currentView, setView }) => {
  return (
    <div className="w-64 h-full bg-[#0D0D12] border-r border-[#1D1D26] flex flex-col p-6 fixed left-0 top-0 overflow-y-auto z-40">
      <div className="flex items-center gap-3 mb-12 px-2 cursor-pointer" onClick={() => setView('dashboard')}>
        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-2xl shadow-white/10">
          <ShieldCheck className="text-black" size={24} />
        </div>
        <h1 className="text-white font-black text-xl tracking-tighter uppercase">HireMax</h1>
      </div>

      <nav className="space-y-2 mb-12">
        <SidebarLink 
          icon={<LayoutDashboard size={20} />} 
          label="Dashboard" 
          active={currentView === 'dashboard'} 
          onClick={() => setView('dashboard')}
        />
        <SidebarLink 
          icon={<Globe size={20} />} 
          label="Signal Hub" 
          active={currentView === 'signal-hub'} 
          onClick={() => setView('signal-hub')}
        />
        <SidebarLink 
          icon={<ScanSearch size={20} />} 
          label="AI Diagnostic" 
          active={currentView === 'ai-review'} 
          onClick={() => setView('ai-review')}
        />
        <SidebarLink 
          icon={<FileCode size={20} />} 
          label="Builder" 
          active={currentView === 'resume-builder'} 
          onClick={() => setView('resume-builder')}
        />
        <SidebarLink 
          icon={<Grid size={20} />} 
          label="Templates" 
          active={currentView === 'templates'} 
          onClick={() => setView('templates')} 
        />
        <SidebarLink icon={<Layers size={20} />} label="Frameworks" onClick={() => setView('templates')} />
        <SidebarLink icon={<BarChart2 size={20} />} label="Market Index" onClick={() => {}} />
      </nav>

      <div className="mt-4 px-2">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.25em]">Critical Path</h3>
          <span className="text-[10px] text-gray-700 font-mono">0/4</span>
        </div>
        
        <div className="space-y-4">
          {WEEKLY_GOALS.map(goal => (
            <div key={goal.id} className="flex items-center gap-3 opacity-50 hover:opacity-100 transition-opacity cursor-default group">
              <Circle size={10} className="text-gray-800 group-hover:text-blue-500 transition-colors" />
              <span className="text-gray-500 text-[11px] font-bold uppercase tracking-tight">{goal.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto bg-[#16161E] rounded-[2rem] p-6 border border-[#1D1D26] shadow-xl">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
          <span className="text-white text-[10px] font-bold uppercase tracking-widest">Recruiter Intel</span>
        </div>
        <p className="text-gray-500 text-[10px] leading-relaxed font-bold">
          Quantified achievements score 40% higher in current market pipelines.
        </p>
      </div>
    </div>
  );
};

export default Sidebar;
