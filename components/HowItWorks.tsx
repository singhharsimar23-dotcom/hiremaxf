
import React from 'react';
import { 
  Eye, ZapOff, BarChart3, Target, History, Clock, FileText, 
  Sparkles, CheckCircle2, ShieldCheck, Heart, ArrowRight, UserCheck
} from 'lucide-react';

const FlowStep: React.FC<{ num: number; title: string; subtitle: string; description: string; feel: string }> = ({ num, title, subtitle, description, feel }) => (
  <div className="relative p-10 bg-[#1A1D26] border border-[#2D313D] rounded-[3rem] shadow-xl group hover:border-blue-500/30 transition-all">
    <div className="absolute -top-6 left-10 w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-xl">
      {num}
    </div>
    <div className="pt-4">
      <h3 className="text-xs font-black text-blue-500 uppercase tracking-[0.2em] mb-3">{subtitle}</h3>
      <h4 className="text-2xl font-bold text-white mb-4 tracking-tight">{title}</h4>
      <p className="text-slate-400 text-sm leading-relaxed mb-6 font-medium">{description}</p>
      <div className="pt-6 border-t border-white/5 flex items-center gap-3">
        <Heart size={16} className="text-blue-500/50" />
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest italic">{feel}</p>
      </div>
    </div>
  </div>
);

const FeatureExplain: React.FC<{ title: string; description: string; benefit: string; icon: React.ReactNode; colorClass: string }> = ({ title, description, benefit, icon, colorClass }) => (
  <div className="bg-[#1A1D26] border border-[#2D313D] rounded-[2.5rem] p-8 flex flex-col h-full shadow-lg group hover:bg-white/[0.02] transition-colors">
    <div className={`w-12 h-12 rounded-xl ${colorClass} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
      {icon}
    </div>
    <h3 className="text-xl font-bold text-white mb-3 tracking-tight">{title}</h3>
    <p className="text-slate-400 text-sm leading-relaxed mb-6 font-medium flex-1">
      {description}
    </p>
    <div className="pt-6 border-t border-white/5 space-y-2">
      <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Why it matters:</span>
      <p className="text-sm font-bold text-slate-300 leading-snug">{benefit}</p>
    </div>
  </div>
);

export const HowItWorks: React.FC = () => {
  return (
    <div className="max-w-[1200px] mx-auto py-20 px-10">
      <section className="mb-24 text-center max-w-3xl mx-auto">
        <div className="flex items-center justify-center gap-3 text-blue-400 bg-blue-600/5 w-fit px-5 py-2 rounded-full border border-blue-500/10 mx-auto mb-8">
          <Sparkles size={16} />
          <span className="text-[12px] font-bold uppercase tracking-widest">A Modern Mentor</span>
        </div>
        <h2 className="text-6xl font-bold text-white mb-8 tracking-tighter">Your Career Evaluation, Refined.</h2>
        <p className="text-slate-400 text-xl font-medium leading-relaxed">
          HireMax reviews your resume the way the job market does — clearly, fairly, and consistently — so you know what to improve before you apply.
        </p>
      </section>

      {/* The 4-Step Flow */}
      <section className="mb-32">
        <div className="flex items-center gap-4 mb-16">
          <div className="h-[2px] w-12 bg-blue-600"></div>
          <h3 className="text-2xl font-bold text-white tracking-tight uppercase">The HireMax Flow</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          <FlowStep 
            num={1} subtitle="Step 1" title="Upload & Structure" feel="“Okay, it’s just reading my resume — nothing scary.”"
            description="You upload your resume (PDF or DOCX). HireMax securely reads and structures it. No rewriting, no guessing. Your content stays yours."
          />
          <FlowStep 
            num={2} subtitle="Step 2" title="Resume Scan" feel="“I get what’s going on.”"
            description="Within seconds, get a high-level overview: what looks strong, what may be overlooked, and where attention should go first."
          />
          <FlowStep 
            num={3} subtitle="Step 3" title="Deep Analysis" feel="“This makes sense. I can act on this.”"
            description="Focused checks answer specific questions recruiters care about. Results appear as simple, acted sections—not walls of text."
          />
          <FlowStep 
            num={4} subtitle="Step 4" title="Fix & Improve" feel="“I’m in control.”"
            description="Based on the findings, edit your resume, re-run checks, and track improvement. No pressure, no forced upgrades."
          />
        </div>
      </section>

      {/* Core Features */}
      <section className="mb-32">
        <div className="flex items-center gap-4 mb-16">
          <div className="h-[2px] w-12 bg-blue-600"></div>
          <h3 className="text-2xl font-bold text-white tracking-tight uppercase">8 Core Evaluation Domains</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <FeatureExplain 
            title="Recruiter Scan (8s)" colorClass="bg-blue-600/10 text-blue-400" icon={<Eye size={24} />}
            description="Simulates how a real recruiter scans your resume in the first few seconds — what stands out and what gets skipped."
            benefit="Helps you place your strongest achievements where they're actually seen."
          />
          <FeatureExplain 
            title="Rejection Analysis" colorClass="bg-red-600/10 text-red-400" icon={<ZapOff size={24} />}
            description="Checks for common red flags like unclear impact, weak formatting, or missing basic contact information."
            benefit="You fix silent rejection reasons before applying."
          />
          <FeatureExplain 
            title="Market Readiness" colorClass="bg-green-600/10 text-green-400" icon={<BarChart3 size={24} />}
            description="Compares your experience and skills against current job postings to see how competitive you are right now."
            benefit="You apply with confidence — not guesswork."
          />
          <FeatureExplain 
            title="Skill Match Check" colorClass="bg-purple-600/10 text-purple-400" icon={<UserCheck size={24} />}
            description="Analyzes how well your listed skills align with the specific roles you're targeting."
            benefit="Prevents applying to roles where expectations don't match your profile."
          />
          <FeatureExplain 
            title="Skill Trend Check" colorClass="bg-indigo-600/10 text-indigo-400" icon={<History size={24} />}
            description="Looks at whether your skills are growing in demand or becoming less common in the market."
            benefit="Guides what you should learn next — strategically."
          />
          <FeatureExplain 
            title="Career Longevity" colorClass="bg-amber-600/10 text-amber-400" icon={<Clock size={24} />}
            description="Estimates how long your current resume will remain competitive based on industry trends."
            benefit="Helps you future-proof your career, not just your next application."
          />
          <FeatureExplain 
            title="ATS Compatibility" colorClass="bg-slate-600/10 text-slate-400" icon={<ShieldCheck size={24} />}
            description="Reviews whether your resume can be correctly read by common applicant tracking systems."
            benefit="A strong resume is useless if software filters it out."
          />
          <FeatureExplain 
            title="Improvement Guidance" colorClass="bg-blue-600/10 text-blue-400" icon={<FileText size={24} />}
            description="Gives clear, practical suggestions on what to improve — wording, structure, and emphasis."
            benefit="You know exactly what to fix, not just what's wrong."
          />
        </div>
      </section>

      {/* Safety and AI Disclaimer */}
      <section className="p-16 bg-[#1A1D26] border border-[#2D313D] rounded-[4rem] text-center shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
        <Heart size={40} className="mx-auto text-blue-500 mb-8" />
        <h3 className="text-3xl font-bold text-white mb-6 uppercase tracking-tight">AI with Integrity</h3>
        <p className="text-slate-400 text-lg max-w-3xl mx-auto leading-relaxed font-medium mb-12">
          HireMax uses AI as a support tool, not a decision-maker. It follows predefined evaluation rules, does not guess, and never trains on your personal data. The same resume gives consistent results every time.
        </p>
        <div className="flex flex-wrap justify-center gap-12 pt-8 border-t border-white/5">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-blue-500" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Stable Results</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-blue-500" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Rule-Based</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-blue-500" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Privacy First</span>
          </div>
        </div>
      </section>
    </div>
  );
};
