
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, MessageCircle, CheckCircle2 } from 'lucide-react';
import { AppView } from '../types';

interface FAQProps {
  setView: (v: AppView) => void;
}

const FAQItem: React.FC<{ q: string; a: string | React.ReactNode }> = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border border-[#1D1D26] rounded-2xl overflow-hidden transition-all ${open ? 'bg-white/5' : 'hover:bg-white/[0.02]'}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full p-6 flex justify-between items-center text-left"
      >
        <span className="text-white font-bold text-sm pr-10">{q}</span>
        {open ? <ChevronUp size={18} className="text-blue-500 shrink-0" /> : <ChevronDown size={18} className="text-slate-500 shrink-0" />}
      </button>
      {open && (
        <div className="px-6 pb-6 animate-in slide-in-from-top-2 duration-300">
          <div className="text-slate-400 text-sm leading-relaxed font-medium">
            {a}
          </div>
        </div>
      )}
    </div>
  );
};

export const FAQ: React.FC<FAQProps> = ({ setView }) => {
  const faqs = [
    {
      q: "What does Resume Rebuild include?",
      a: "A Resume Rebuild session takes your existing experience and re-architects it for a target role, seniority level, and industry. It optimizes phrasing for ATS screening algorithms and real recruiter scan behavior — while 100% preserving the factual truth of your experience. No hallucinations, no fluff."
    },
    {
      q: "Is this a subscription or one-time payment?",
      a: "HireMax offers monthly subscriptions. Career Pro ($29/mo) gives you unlimited resume analyses, ATS scoring, full resume rebuilds, and the application tracker. Elite ($49/mo) adds advanced interview prep, priority processing, market outlook intelligence, and dedicated support. You can cancel anytime from your billing page."
    },
    {
      q: "How many resumes can I optimize?",
      a: "Career Pro and Elite subscribers have unlimited access to all resume tools. There is no per-use cap — run as many optimizations, rebuilds, and analyses as your job search demands."
    },
    {
      q: "How is this different from just using ChatGPT?",
      a: "ChatGPT is a general-purpose model with no hiring context. It has no structured understanding of ATS parsing, seniority calibration, or real job market signals. HireMax uses a deterministic evaluation framework trained on real-world hiring heuristics. The output is grounded, structured, and verifiable — not creative writing."
    },
    {
      q: "Are resumes ATS-safe and correctly formatted?",
      a: "Yes. Every resume output from HireMax uses a strict single-column layout with standard section markers. This ensures compatibility with every major Applicant Tracking System including Greenhouse, Workday, Lever, and iCIMS. The download uses a clean, parseable format."
    },
    {
      q: "Can I download my resume?",
      a: "Yes. From your Resume History, click the download icon on any completed version. The file opens in a print-ready view — use your browser's Print → Save as PDF to generate a clean, professional PDF ready to submit."
    },
    {
      q: "Does the Application Tracker actually save my data?",
      a: "Yes. All application entries are saved to your personal database in real time. The tracker uses Supabase with live sync — your data is persisted across sessions and devices. Drag applications between stages, add notes, and track follow-up dates."
    },
    {
      q: "What happens to my data if I cancel?",
      a: "Your account remains active with read-only access until the end of your billing cycle. After that, you revert to a free tier. All your saved resumes, version history, and tracked applications are preserved — you will not lose your data."
    },
    {
      q: "Is my resume data private and secure?",
      a: "All data is encrypted in transit (TLS) and at rest. Your resume content is associated only with your authenticated user account and is never shared with third parties or used to train models. See our Privacy Policy for full details."
    },
    {
      q: "What is your refund policy?",
      a: "Because HireMax delivers AI analysis instantly upon payment, all sales are final. If you experience a technical error — such as a report failing to generate — contact us within 7 days at hiremax.ai@gmail.com for resolution or a manual re-run."
    },
  ];

  return (
    <div className="max-w-4xl mx-auto py-16 px-10">
      <div className="text-center mb-16">
        <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-4 leading-none">Frequently Asked Questions</h2>
        <p className="text-slate-500 font-medium max-w-xl mx-auto">Honest answers about how HireMax works, what you get, and what to expect.</p>
      </div>

      <div className="space-y-4 mb-16">
        {faqs.map((f, i) => <FAQItem key={i} q={f.q} a={f.a} />)}
      </div>

      <div className="bg-[#16161E] border border-[#1D1D26] rounded-[3rem] p-12 text-center shadow-xl">
        <div className="w-14 h-14 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-500 mx-auto mb-6">
          <MessageCircle size={28} />
        </div>
        <h3 className="text-xl font-bold text-white mb-4">Still have questions?</h3>
        <p className="text-slate-500 text-sm font-medium leading-relaxed mb-3 max-w-sm mx-auto">
          Our support team typically responds within 24 hours.
        </p>
        <p className="text-blue-400 font-bold text-sm mb-8">hiremax.ai@gmail.com</p>
        <button
          onClick={() => setView('contact')}
          className="bg-white text-black font-black py-4 px-10 rounded-2xl transition-all uppercase tracking-widest text-[10px] hover:bg-slate-100"
        >
          Open a Support Ticket
        </button>
      </div>
    </div>
  );
};
