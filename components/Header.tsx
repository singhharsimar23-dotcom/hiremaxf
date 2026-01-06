
import React from 'react';
import { Sun, Plus, Terminal } from 'lucide-react';

const Header: React.FC<{ setView: (v: any) => void }> = ({ setView }) => {
  return (
    <header className="flex items-center justify-between px-10 py-8 sticky top-0 bg-[#0D0D12]/90 backdrop-blur-xl z-30 border-b border-[#1D1D26]/30">
      <div className="flex items-center gap-10">
        <div className="flex items-center gap-10">
           {['Dashboard', 'Diagnostic', 'Frameworks', 'Market Fit'].map((item, idx) => (
             <span 
              key={item} 
              onClick={() => {
                if (item === 'Diagnostic') setView('ai-review');
                else if (item === 'Frameworks') setView('templates');
                else setView('dashboard');
              }}
              className={`text-[11px] font-bold uppercase tracking-widest cursor-pointer transition-all ${idx === 0 ? 'text-white border-b border-blue-500 pb-1' : 'text-gray-600 hover:text-white'}`}
             >
               {item}
             </span>
           ))}
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3 px-4 py-2 bg-[#16161E] rounded-xl text-gray-500 font-mono text-[10px] border border-[#1D1D26] shadow-sm">
          <Terminal size={12} className="text-blue-500" />
          <span className="tracking-tight uppercase">SYSTEM_STATE: READY</span>
        </div>
        
        <button 
          onClick={() => setView('ai-review')}
          className="flex items-center gap-2 bg-white text-black px-8 py-3 rounded-2xl font-bold text-[10px] uppercase tracking-[0.15em] hover:bg-blue-500 hover:text-white transition-all shadow-2xl active:scale-95"
        >
          <Plus size={16} /> New Assessment
        </button>

        <div className="h-6 w-[1px] bg-gray-800 opacity-30"></div>

        <div className="flex items-center gap-3 cursor-pointer group">
          <div className="w-10 h-10 rounded-2xl bg-[#16161E] border border-gray-800 flex items-center justify-center overflow-hidden transition-all group-hover:border-white/20">
             <img src="https://picsum.photos/40/40?random=11" className="object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="User" />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
