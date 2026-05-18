
import React from 'react';
import { 
  Eye, 
  ZapOff, 
  BarChart3, 
  History, 
  Clock, 
  Sparkles, 
  CheckCircle2, 
  Activity,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

const FeatureExplain: React.FC<{ 
  title: string; 
  description: string; 
  benefit: string; 
  icon: React.ReactNode; 
  colorClass: string;
  glowClass: string;
}> = ({ title, description, benefit, icon, colorClass, glowClass }) => (
  <div className={`bg-[#1A1D26] border border-[#2D313D] rounded-[2.5rem] p-10 flex flex-col h-full shadow-xl transition-all group hover:border-current hover:bg-white/[0.02] ${glowClass}`}>
    <div className={`w-14 h-14 rounded-2xl ${colorClass} flex items-center justify-center mb-8 group-hover:scale-110 transition-transform shadow-lg`}>
      {icon}
    </div>
    <h3 className="text-2xl font-bold text-white mb-4 tracking-tight group-hover:text-white transition-colors">{title}</h3>
    <p className="text-slate-400 text-base leading-relaxed mb-6 font-medium">
      {description}
    </p>
    <div className="mt-auto pt-6 border-t border-white/5 flex items-start gap-3">
      <CheckCircle2 size={18} className="text-green-500 shrink-0 mt-0.5" />
      <p className="text-sm font-bold text-slate-200">
        <span className="text-slate-500 uppercase text-[10px] block mb-1 tracking-widest">Why it matters:</span>
        {benefit}
      </p>
    </div>
  </div>
);

export const ResumeReviewProcess: React.FC = () => {
  const processes = [
    {
      title: "Recruiter Scan",
      description: "We simulate how a real recruiter reads your resume in the first 8 seconds. We look for what catches their eye and what they might skip over.",
      benefit: "Helps you put your most impressive achievements front and center so they don't get missed.",
      icon: <Eye size={28} />,
      colorClass: "bg-blue-600/10 text-blue-500",
      glowClass: "hover:text-blue-500/50"
    },
    {
      title: "Rejection Analysis",
      description: "Our AI checks for common 'red flags' or formatting issues that often cause resumes to be set aside early in the hiring process.",
      benefit: "Allows you to fix simple mistakes before they ever reach an employer's desk.",
      icon: <ZapOff size={28} />,
      colorClass: "bg-amber-600/10 text-amber-500",
      glowClass: "hover:text-amber-500/50"
    },
    {
      title: "Market Readiness",
      description: "We compare your skills and experience against live job postings to see how well you match what companies are hiring for right now.",
      benefit: "Gives you confidence that you're applying for roles where you are a strong, relevant candidate.",
      icon: <BarChart3 size={28} />,
      colorClass: "bg-green-600/10 text-green-500",
      glowClass: "hover:text-green-500/50"
    },
    {
      title: "Skill Trend Check",
      description: "The job market changes fast. We analyze whether your technical skills are growing in demand or becoming less common.",
      benefit: "Helps you decide which new skills to learn next to keep your career moving forward.",
      icon: <History size={28} />,
      colorClass: "bg-indigo-600/10 text-indigo-500",
      glowClass: "hover:text-indigo-500/50"
    },
    {
      title: "Career Longevity",
      description: "We estimate how long your current resume will stay competitive based on industry trends and technology shifts.",
      benefit: "Provides a long-term view of your career health, helping you stay ahead of the curve.",
      icon: <Clock size={28} />,
      colorClass: "bg-purple-600/10 text-purple-500",
      glowClass: "hover:text-purple-500/50"
    },
    {
      title: "ATS Shield",
      description: "We verify your resume's 'parsability'—ensuring that automated filters don't mangle your data or ignore your achievements.",
      benefit: "Guarantee that your hard work actually makes it into the recruiter's candidate database.",
      icon: <ShieldCheck size={28} />,
      colorClass: "bg-slate-700/20 text-slate-400",
      glowClass: "hover:text-slate-400/50"
    }
  ];

  return (
    <div className="max-w-[1200px] mx-auto py-16 px-10">
      <div className="mb-20 space-y-6">
        <div className="flex items-center gap-3 text-blue-400 bg-blue-600/5 w-fit px-4 py-1.5 rounded-full border border-blue-500/10">
          <Activity size={14} />
          <span className="text-[12px] font-bold uppercase tracking-widest">Analysis Framework</span>
        </div>
        <h2 className="text-6xl font-extrabold text-white tracking-tighter">Inside the Engine</h2>
        <p className="text-slate-400 text-xl font-medium max-w-3xl leading-relaxed">
          HireMax uses a series of high-fidelity checks to give you a complete picture of your career health. 
          Here is exactly what we look for.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
        {processes.map((p, i) => (
          <FeatureExplain 
            key={i}
            title={p.title}
            description={p.description}
            benefit={p.benefit}
            icon={p.icon}
            colorClass={p.colorClass}
            glowClass={p.glowClass}
          />
        ))}

        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2.5rem] p-10 flex flex-col justify-between text-white shadow-2xl relative overflow-hidden group col-span-1 md:col-span-2 lg:col-span-1">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
             <Sparkles size={160} />
          </div>
          <div className="relative z-10">
            <h3 className="text-3xl font-bold mb-6 leading-tight">Ready for a deeper dive?</h3>
            <p className="text-blue-100 text-base mb-8 font-medium leading-relaxed">
              Unlock a full analysis of your profile using our complete 8-point system.
            </p>
          </div>
          <button className="relative z-10 bg-white text-blue-900 font-bold py-4 px-8 rounded-2xl flex items-center justify-center gap-3 hover:bg-blue-50 transition-all shadow-xl">
            Run My Review <ArrowRight size={18} />
          </button>
        </div>
      </div>

      <div className="p-12 bg-[#0D0F14] rounded-[3rem] border border-[#2D313D] border-dashed text-center">
         <p className="text-slate-500 text-base max-w-2xl mx-auto leading-relaxed font-medium italic">
           "Our evaluation logic is derived from over 2 million anonymized hiring interactions, 
           updated daily to reflect shifting market demands."
         </p>
      </div>
    </div>
  );
};
