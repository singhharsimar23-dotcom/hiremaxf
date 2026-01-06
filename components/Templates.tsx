
import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  ChevronRight, 
  Info, 
  AlertTriangle, 
  FileText, 
  CheckCircle2,
  Terminal,
  Grid
} from 'lucide-react';
import { RESUME_TEMPLATES } from '../constants';
import { ResumeTemplate, TemplateCategory } from '../types';

const TemplateCard: React.FC<{ template: ResumeTemplate; onSelect: () => void }> = ({ template, onSelect }) => {
  return (
    <div className="bg-[#16161E] rounded-[2.5rem] p-10 border border-[#1D1D26] hover:border-blue-500/30 transition-all group flex flex-col h-full shadow-xl">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h3 className="text-xl font-black text-white tracking-tighter leading-none mb-2">{template.role}</h3>
          <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{template.category} • {template.experienceLevel}</span>
        </div>
        <div className="w-8 h-8 rounded-full bg-[#0D0D12] border border-[#1D1D26] flex items-center justify-center text-gray-700 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all">
          <ChevronRight size={16} />
        </div>
      </div>

      <div className="space-y-6 flex-1">
        <div className="space-y-2">
          <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest flex items-center gap-2">
            <Info size={12} /> Used When
          </p>
          <p className="text-gray-400 text-xs leading-relaxed font-medium">{template.usedWhen}</p>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-black text-blue-500/50 uppercase tracking-widest flex items-center gap-2">
            <CheckCircle2 size={12} /> Screening Logic
          </p>
          <p className="text-gray-300 text-xs leading-relaxed font-bold">{template.screeningLogic}</p>
        </div>

        {template.riskNotes && (
          <div className="space-y-2">
            <p className="text-[10px] font-black text-amber-500/50 uppercase tracking-widest flex items-center gap-2">
              <AlertTriangle size={12} /> Risk Notes
            </p>
            <p className="text-gray-500 text-[10px] leading-relaxed italic">{template.riskNotes}</p>
          </div>
        )}
      </div>

      <div className="mt-8 pt-8 border-t border-[#1D1D26]">
        <button 
          onClick={onSelect}
          className="w-full bg-[#0D0D12] text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border border-[#1D1D26] hover:bg-blue-600 hover:border-blue-600 transition-all"
        >
          Select Framework
        </button>
      </div>
    </div>
  );
};

export const Templates: React.FC<{ setView: (v: any) => void }> = ({ setView }) => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | 'All'>('All');

  const categories: (TemplateCategory | 'All')[] = ['All', 'Technology', 'Business & Operations', 'Design & Creative', 'Finance', 'Research & Academia', 'Early Career'];

  const filtered = RESUME_TEMPLATES.filter(t => {
    const matchesSearch = t.role.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === 'All' || t.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="max-w-7xl mx-auto py-12 px-10">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 mb-16">
        <div>
          <div className="flex items-center gap-3 text-blue-500 mb-6 bg-blue-500/5 w-fit px-4 py-1.5 rounded-full border border-blue-500/10">
            <Grid size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Structural Repository</span>
          </div>
          <h2 className="text-6xl font-black text-white tracking-tighter leading-none mb-4">Frameworks</h2>
          <p className="text-gray-500 text-xl font-medium max-w-2xl">
            Profession-grounded resume structures aligned with real-world screening heuristics.
          </p>
        </div>
        <div className="flex flex-col items-end gap-4">
           <div className="relative w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
              <input 
                type="text" 
                placeholder="Search by role or keyword..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#16161E] border border-[#1D1D26] rounded-2xl py-4 pl-12 pr-4 text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
              />
           </div>
           <div className="flex gap-2">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                    activeCategory === cat ? 'bg-blue-600 border-blue-600 text-white' : 'bg-[#16161E] border-[#1D1D26] text-gray-500 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
           </div>
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filtered.map(t => (
            <TemplateCard key={t.id} template={t} onSelect={() => setView('resume-builder')} />
          ))}
        </div>
      ) : (
        <div className="py-40 text-center bg-[#16161E] rounded-[3rem] border border-dashed border-[#1D1D26] opacity-50">
           <Terminal size={48} className="mx-auto text-gray-700 mb-6" />
           <p className="text-gray-600 font-black uppercase tracking-[0.3em] text-xs">No matching structural patterns found</p>
        </div>
      )}

      <div className="mt-20 p-12 bg-[#0D0D12] rounded-[3rem] border border-[#1D1D26] border-dashed text-center">
         <p className="text-[10px] font-black text-gray-700 uppercase tracking-[0.5em] mb-4">Quality Standard</p>
         <p className="text-gray-500 text-sm max-w-xl mx-auto leading-relaxed font-medium">
           All HireMax frameworks are single-column, ATS-safe, and follow role-specific recruiter scanning patterns. Visual noise and high-risk elements are excluded by design.
         </p>
      </div>
    </div>
  );
};
