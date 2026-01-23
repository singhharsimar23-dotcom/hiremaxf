
import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';
import { AppView } from '../types';

interface FAQProps {
  setView: (v: AppView) => void;
}

const FAQItem: React.FC<{ q: string; a: string }> = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border border-[#1D1D26] rounded-2xl overflow-hidden transition-all ${open ? 'bg-white/5' : 'hover:bg-white/[0.02]'}`}>
      <button 
        onClick={() => setOpen(!open)}
        className="w-full p-6 flex justify-between items-center text-left"
      >
        <span className="text-white font-bold text-sm pr-10">{q}</span>
        {open ? <ChevronUp size={18} className="text-blue-500" /> : <ChevronDown size={18} className="text-slate-500" />}
      </button>
      {open && (
        <div className="px-6 pb-6 animate-in slide-in-from-top-2 duration-300">
          <p className="text-slate-400 text-sm leading-relaxed font-medium">
            {a}
          </p>
        </div>
      )}
    </div>
  );
};

export const FAQ: React.FC<FAQProps> = ({ setView }) => {
  const faqs = [
    {
      q: "What does Resume Rebuild include?",
      a: "A Resume Rebuild session takes your existing experience and re-architects it specifically for a target role, seniority level, and industry. It optimizes phrasing for screening algorithms and recruiter scan behavior while maintaining the truth of your experience."
    },
    {
      q: "Is this a subscription?",
      a: "HireMax offers both monthly subscriptions (Career Pro & Elite) for continuous career management and one-time credit bundles for individual resume optimizations."
    },
    {
      q: "How many resumes can I rebuild?",
      a: "Starter users can purchase credit bundles (1, 3, or 5). Career Pro and Elite members have unlimited access to the rebuild utility for any role they target."
    },
    {
      q: "How is this different from ChatGPT?",
      a: "ChatGPT is a general-purpose model that often 'hallucinates' or uses generic fluff. HireMax uses deterministic evaluation rules specifically mapped to real-world hiring heuristics, ensuring your resume remains professional, grounded, and effective."
    },
    {
      q: "Are resumes ATS-safe?",
      a: "Yes. Every framework and rebuild output in HireMax is strictly single-column and uses standard parsing markers to ensure it is read correctly by every major Applicant Tracking System."
    },
    {
      q: "Can I download my resume?",
      a: "Absolutely. Once a rebuild is complete or you've used the builder, you can export a clean, professional PDF asset ready for application."
    },
    {
      q: "What happens if I cancel Pro / Elite?",
      a: "You will retain your current access until the end of your billing cycle. After that, your account will revert to the Starter plan. All your generated resume versions will remain accessible in your History."
    }
  ];

  return (
    <div className="max-w-4xl mx-auto py-16 px-10">
      <div className="text-center mb-16">
        <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-4 leading-none">Frequently Asked Questions</h2>
        <p className="text-slate-500 font-medium max-w-xl mx-auto">Short, honest answers about HireMax and how it helps your career.</p>
      </div>

      <div className="space-y-4 mb-16">
        {faqs.map((f, i) => <FAQItem key={i} q={f.q} a={f.a} />)}
      </div>

      <div className="bg-[#16161E] border border-[#1D1D26] rounded-[3rem] p-12 text-center shadow-xl">
         <div className="w-14 h-14 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-500 mx-auto mb-6">
            <MessageCircle size={28} />
         </div>
         <h3 className="text-xl font-bold text-white mb-4">Still have questions?</h3>
         <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8 max-w-sm mx-auto">
           Our support team is ready to help with account, billing, or product issues.
         </p>
         <button 
           onClick={() => setView('contact')}
           className="bg-white text-black font-black py-4 px-10 rounded-2xl transition-all uppercase tracking-widest text-[10px]"
         >
           Contact Support
         </button>
      </div>
    </div>
  );
};
