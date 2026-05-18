
import React, { useState, useMemo } from 'react';
import { 
  ChevronRight, 
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  MinusCircle,
  Filter
} from 'lucide-react';
import { RESUME_TEMPLATES } from '../constants';
import { ResumeTemplate, AppView, TemplateField } from '../types';

const FIELDS: TemplateField[] = [
  'Software / Tech',
  'Data / Analytics',
  'Business / Management',
  'Student / Fresher',
  'General Professional'
];

interface FrameworkCardProps {
  template: ResumeTemplate;
  onSelect: (t: ResumeTemplate) => void;
  isRecommended?: boolean;
}

const FrameworkCard: React.FC<FrameworkCardProps> = ({ template, onSelect, isRecommended }) => {
  return (
    <div className={`bg-[#16161E] rounded-3xl p-10 border transition-all flex flex-col h-full shadow-2xl relative ${isRecommended ? 'border-blue-500 shadow-blue-500/5' : 'border-[#1D1D26] opacity-80 hover:opacity-100'}`}>
      {isRecommended && (
        <span className="absolute -top-3 left-10 bg-blue-600 text-white text-[9px] font-black uppercase tracking-[0.2em] px-5 py-1.5 rounded-full shadow-xl">Recommended</span>
      )}
      
      <div className="mb-10">
        <h3 className="text-xl font-black text-white tracking-tighter leading-tight mb-3">{template.name}</h3>
        <p className="text-slate-500 text-xs font-medium leading-relaxed">{template.usedWhen}</p>
      </div>

      <div className="space-y-10 flex-1">
        <div className="space-y-4">
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">Section Order</p>
          <div className="flex flex-wrap gap-2">
            {template.sectionOrder.map((section, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-white">{section}</span>
                {idx < template.sectionOrder.length - 1 && <ChevronRight size={12} className="text-slate-700" />}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
             <p className="text-[10px] font-black text-blue-500/50 uppercase tracking-widest flex items-center gap-2">
               <CheckCircle2 size={12} /> Notice First
             </p>
             <div className="space-y-2">
               {template.recruiterScan.noticeFirst.map((item, i) => (
                 <p key={i} className="text-slate-300 text-xs font-bold leading-none">• {item}</p>
               ))}
             </div>
          </div>
        </div>

        <div className="p-6 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
           <p className="text-[10px] font-black text-amber-500/50 uppercase tracking-[0.3em] flex items-center gap-2 mb-2">
             <AlertCircle size={12} /> Risk Note
           </p>
           <p className="text-slate-500 text-xs leading-relaxed font-medium italic">{template.riskNotes}</p>
        </div>
      </div>

      <div className="mt-10 pt-10 border-t border-[#1D1D26]">
        <button 
          onClick={() => onSelect(template)}
          className={`w-full py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${isRecommended ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-transparent text-slate-500 border border-[#1D1D26] hover:text-white hover:border-slate-700'}`}
        >
          Use This Structure <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
};

export const Templates: React.FC<{ setView: (v: AppView) => void; onSelectTemplate: (t: ResumeTemplate) => void }> = ({ setView, onSelectTemplate }) => {
  const [activeField, setActiveField] = useState<TemplateField | 'All'>('All');

  const filtered = useMemo(() => {
    if (activeField === 'All') return RESUME_TEMPLATES;
    return RESUME_TEMPLATES.filter(t => t.field === activeField);
  }, [activeField]);

  return (
    <div className="max-w-7xl mx-auto py-16 px-10">
      <div className="mb-20">
        <h2 className="text-5xl font-black text-white tracking-tighter uppercase mb-4 leading-none">Resume Structures Recruiters Actually See</h2>
        <p className="text-slate-500 text-lg font-medium max-w-2xl leading-relaxed">
          Real resume layouts used in successful applications. No decorative templates. All structures are ATS-safe and optimized for recruiter scanning.
        </p>
      </div>

      <div className="flex flex-wrap gap-4 mb-16">
        <button 
          onClick={() => setActiveField('All')}
          className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${activeField === 'All' ? 'bg-white text-black border-white' : 'text-slate-500 border-[#2D313D] hover:text-white hover:border-slate-600'}`}
        >
          All Fields
        </button>
        {FIELDS.map(f => (
          <button 
            key={f}
            onClick={() => setActiveField(f)}
            className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${activeField === f ? 'bg-blue-600 text-white border-blue-600' : 'text-slate-500 border-[#2D313D] hover:text-white hover:border-slate-600'}`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        {filtered.map(t => (
          <FrameworkCard 
            key={t.id} 
            template={t} 
            isRecommended={t.variant === 'Primary'}
            onSelect={onSelectTemplate} 
          />
        ))}
      </div>

      <div className="mt-24 p-12 bg-[#0D0D12] rounded-[3rem] border border-[#1D1D26] border-dashed text-center">
         <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.5em] mb-4">Quality Standard</p>
         <p className="text-slate-500 text-sm max-w-xl mx-auto leading-relaxed font-medium">
           HireMax frameworks prioritize structural integrity over stylistic flexibility. 
           Content comes first, format second. Selecting a structure will configure your next Resume Rebuild session.
         </p>
      </div>
    </div>
  );
};
