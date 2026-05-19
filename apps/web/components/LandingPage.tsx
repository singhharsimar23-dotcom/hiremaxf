import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import {
  ArrowRight, Sparkles, ShieldCheck, Briefcase, Linkedin,
  FileText, TrendingUp, Check, ChevronRight, Star, Zap, AlertTriangle, Users, Timer,
  CheckCircle, Lock, Info, Gauge, Upload, FileSearch, XCircle, BarChart3, Eye, Clock, UserX, Brain, Shield, Target,
  ChevronDown, Menu, X as XIcon, HelpCircle, Plus, Minus
} from 'lucide-react';

interface Props {
  onGetStarted: () => void;
  onViewPlans: () => void;
  onViewTerms?: () => void;
  onViewPrivacy?: () => void;
  onViewRefund?: () => void;
}



/* ─── FAQ Section ─── */
const FAQ_ITEMS = [
  {
    q: "What does HireMax actually do?",
    a: "HireMax is a career intelligence platform. It analyzes your resume against real ATS systems and recruiter expectations, identifies exactly what's costing you interviews, rebuilds your resume with AI, and gives you tools to track, prepare, and optimize your entire job search."
  },
  {
    q: "Is the resume analysis free?",
    a: "Yes. You can upload your resume and get a full diagnostic score, ATS survivability rating, and a detailed breakdown of failure causes on the free Starter plan. No credit card required."
  },
  {
    q: "How is this different from a resume template or a human reviewer?",
    a: "Templates give you formatting — not intelligence. Human reviewers give opinions — not data. HireMax scores your resume against 50+ ATS signal factors and real market demand for your target role, then shows you exactly which lines are failing and why."
  },
  {
    q: "Does HireMax guarantee interviews?",
    a: "No. Anyone who promises guaranteed interviews is lying. What we guarantee is honest, data-driven analysis of why your resume isn't working and a clear path to fix it. Results depend on your effort, market conditions, and role fit."
  },
  {
    q: "Is my resume data private and secure?",
    a: "Yes. Your resume and personal data are encrypted in transit and at rest. We never sell your data to third parties. You can delete your account and all associated data at any time from Account Settings. See our Privacy Policy for the full details."
  },
];

const FAQSection: React.FC = () => {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section className="py-24 px-6 bg-[#0A0A0F] border-t border-white/5">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-3">Before You Decide</p>
          <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-4">Common Questions</h2>
          <p className="text-slate-400 text-lg">Answered honestly — no marketing fluff.</p>
        </div>
        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => (
            <motion.div
              key={i}
              className="border border-white/8 rounded-2xl overflow-hidden bg-[#0E0E16] hover:border-white/12 transition-colors"
            >
              <button
                className="w-full flex items-center justify-between gap-4 p-6 text-left group"
                onClick={() => setOpen(open === i ? null : i)}
              >
                <span className="text-white font-bold text-base group-hover:text-blue-300 transition-colors">{item.q}</span>
                <div className={`shrink-0 w-7 h-7 rounded-full border border-white/10 flex items-center justify-center transition-all ${
                  open === i ? 'bg-blue-500/20 border-blue-500/30 rotate-45' : 'bg-white/5'
                }`}>
                  <Plus size={13} className={open === i ? 'text-blue-400' : 'text-slate-500'} />
                </div>
              </button>
              <AnimatePresence>
                {open === i && (
                  <motion.div
                    key="faq-content"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="px-6 pb-6"
                  >
                    <p className="text-slate-400 text-sm leading-relaxed border-t border-white/5 pt-4">{item.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ─── Animated counter ─── */
const Counter: React.FC<{ to: number; suffix?: string; duration?: number }> = ({ to, suffix = '', duration = 2000 }) => {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      const start = Date.now();
      const tick = () => {
        const p = Math.min((Date.now() - start) / duration, 1);
        setVal(Math.floor(p * to));
        if (p < 1) rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }, { threshold: 0.3 });
    if (ref.current) obs.observe(ref.current);
    return () => {
      obs.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [to, duration]);
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
};

/* ─── Tool card ─── */
const ToolCard: React.FC<{ icon: any; title: string; pain: string; solution: string; color: string; timeLabel?: string; outcome?: string; mostUsed?: boolean }> = ({ icon: Icon, title, pain, solution, color, timeLabel, outcome, mostUsed }) => (
  <div className="relative bg-[#111118] border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-all group hover:-translate-y-1 hover:shadow-xl hover:shadow-black/30">
    {mostUsed && (
      <div className="absolute -top-3 left-6 inline-flex items-center gap-1.5 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-[0_0_12px_rgba(37,99,235,0.6)]">
        <Star size={9} className="fill-white" /> Most Used
      </div>
    )}
    <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
      <Icon size={18} className="text-white"/>
    </div>
    <p className="text-white font-bold text-base mb-2">{title}</p>
    {outcome && <p className="text-slate-200 text-sm font-semibold mb-2">{outcome}</p>}
    <p className="text-red-400 text-xs mb-3 flex items-start gap-1.5"><AlertTriangle size={11} className="mt-0.5 shrink-0"/>{pain}</p>
    <p className="text-slate-400 text-sm leading-relaxed">{solution}</p>
    {timeLabel && (
      <div className="mt-4 flex items-center gap-1.5">
        <Clock size={11} className="text-slate-600" />
        <p className="text-[10px] text-slate-500">
          <span className="text-white font-bold">{timeLabel}</span> to set up
        </p>
      </div>
    )}
  </div>
);

/* ─── Trust Indicators ─── */
const TrustIndicators = () => (
  <section className="border-y border-white/5 bg-[#0D0D14] py-8">
    <div className="max-w-5xl mx-auto px-6">
      <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
        {[
          { icon: Brain, text: "AI-powered resume diagnostics" },
          { icon: Shield, text: "ATS & market signal aware" },
          { icon: Target, text: "No guarantees. Just clarity." },
          { icon: Users, text: "Used during real hiring cycles" },
        ].map((indicator, index) => (
          <div key={index} className="flex items-center gap-2 text-slate-400">
            <indicator.icon className="h-4 w-4" />
            <span className="text-sm font-medium">{indicator.text}</span>
          </div>
        ))}
      </div>
    </div>
  </section>
);

/* ─── Problem Section ─── */
const ProblemSection = () => (
  <section className="py-16 md:py-24 bg-[#0A0A0F]">
    <div className="container mx-auto px-6 max-w-5xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="text-center mb-10"
      >
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 tracking-tight">
          Why Your Applications <span className="text-slate-500">Disappear</span>
        </h2>
        <p className="text-slate-400 max-w-xl mx-auto text-base">
          The hiring process is designed against you. Here's what's happening.
        </p>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: XCircle, title: "Automated Rejection", stat: "75%", description: "ATS algorithms eliminate applications before human review" },
          { icon: Eye, title: "Invisible to Recruiters", stat: "7s", description: "Average time recruiters spend scanning each resume" },
          { icon: Clock, title: "Market Blindness", stat: "0%", description: "Visibility into how the market sees your profile" },
          { icon: UserX, title: "Silent Disqualification", stat: "?", description: "Hidden issues working against you without feedback" },
        ].map((problem, index) => (
          <motion.div
            key={problem.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: index * 0.08 }}
            className="p-5 rounded-xl border border-white/5 bg-[#111118] hover:border-blue-500/30 transition-colors"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center">
                <problem.icon className="h-4 w-4 text-red-400" />
              </div>
              <span className="text-2xl font-black text-white">{problem.stat}</span>
            </div>
            <h3 className="text-sm font-bold text-slate-200 mb-1">{problem.title}</h3>
            <p className="text-xs text-slate-500 leading-relaxed">{problem.description}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

/* ─── Screening Pipeline ─── */
const ScreeningPipeline = () => {
  const pipelineSteps = [
    { icon: Upload, label: "Upload", description: "Resume enters the system" },
    { icon: FileSearch, label: "Parse", description: "ATS extracts data fields" },
    { icon: XCircle, label: "Knockouts", description: "Binary filters eliminate" },
    { icon: BarChart3, label: "Ranking", description: "Candidates scored & ordered" },
    { icon: Eye, label: "Human Skim", description: "6-15 second review" },
  ];
  return (
    <section className="py-16 md:py-24 bg-[#0D0D14]">
      <div className="container mx-auto px-6 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight">
            Where Resumes Actually Get Filtered Out
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            Most resumes fail inside systems — not because of formatting.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative max-w-5xl mx-auto"
        >
          {/* Desktop Pipeline */}
          <div className="hidden md:flex items-center justify-between relative">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10 -translate-y-1/2" />
            <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-blue-500/10 via-blue-500 to-blue-500/10 -translate-y-1/2 opacity-30" />
            
            {pipelineSteps.map((step, index) => (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.1 + index * 0.08 }}
                className="relative z-10 flex flex-col items-center"
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-colors ${
                  index === 2 
                    ? 'bg-red-500/10 border-red-500/30 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.2)]' 
                    : 'bg-[#16161E] border-white/10 text-slate-400 hover:border-blue-500/50 hover:text-blue-400'
                }`}>
                  <step.icon className="h-6 w-6" />
                </div>
                <span className="mt-4 text-sm font-bold text-white">{step.label}</span>
                <span className="mt-1 text-xs text-slate-500 text-center max-w-[100px] leading-relaxed">
                  {step.description}
                </span>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-16 p-6 md:p-8 rounded-2xl border border-blue-500/20 bg-blue-500/5 max-w-3xl mx-auto"
          >
            <div className="flex flex-col sm:flex-row items-start gap-5">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="text-base font-bold text-white mb-3">
                  HireMax analyzes resumes inside this pipeline — not after it.
                </p>
                <ul className="space-y-2">
                  {["Detects silent auto-rejects", "Measures ATS survivability + recruiter signal", "Optimizes for machines and human skim"].map((bullet) => (
                    <li key={bullet} className="flex items-center gap-3 text-sm text-slate-400">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

/* ─── Resume Demo Section ─── */
const ResumeDemoSection = ({ id }: { id?: string }) => {
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case "strong": return "bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)]";
      case "warning": return "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]";
      case "weak": return "bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.5)]";
      default: return "bg-slate-600";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return "bg-green-500";
    if (score >= 50) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <section id={id} className="py-24 md:py-32 bg-[#0A0A0F]">
      <div className="container mx-auto px-6 max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-3">Line By Line</p>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">
            How Your Resume Is Actually Read
          </h2>
          <p className="text-lg text-slate-400 max-w-3xl mx-auto">
            A visual example of how our system analyzes resumes line by line — the same way recruiters and ATS systems do.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-[300px_1fr_340px] gap-8 items-start">
          {/* LEFT: Insight Cards */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-4 lg:sticky lg:top-24"
          >
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">
              Live Insights
            </p>
            {[
              { title: "Failure Cause Identified", desc: "Multi-column formatting reduces ATS readability.", icon: AlertTriangle, col: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
              { title: "Market Reality Insight", desc: "Target role typically expects 1–2 years of production experience.", icon: Info, col: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
              { title: "Strong Signal Detected", desc: "Quantified impact and API development experience detected.", icon: CheckCircle, col: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
            ].map((card, index) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
                className={`p-5 rounded-2xl border ${card.border} ${card.bg}`}
              >
                <div className="flex items-start gap-3">
                  <card.icon className={`h-5 w-5 ${card.col} mt-0.5 shrink-0`} />
                  <div>
                    <h4 className="text-sm font-bold text-white mb-1.5">{card.title}</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">{card.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* CENTER: Resume Preview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-[#111118] rounded-3xl p-2 border border-white/5 shadow-2xl"
          >
            <div className="bg-[#16161E] rounded-2xl border border-white/5 p-6 md:p-10 relative overflow-hidden">
              <div className="space-y-1.5 font-sans relative z-10">
                {[
                  { content: "Andrew Parker", type: "name", signal: "neutral" },
                  { content: "Software Engineer", type: "title", signal: "strong" },
                  { content: "austin, tx • andrewparker@email.com • (512) 555-0147", type: "contact", signal: "neutral" },
                  { content: "EDUCATION", type: "heading", signal: "neutral" },
                  { content: "Bachelor of Science in Computer Science", type: "degree", signal: "strong" },
                  { content: "University of Texas at Austin • 2020 – 2024", type: "school", signal: "neutral" },
                  { content: "EXPERIENCE", type: "heading", signal: "neutral" },
                  { content: "Junior Software Engineer Intern", type: "role", signal: "strong" },
                  { content: "TechStart Fintech • Austin, TX • May 2023 – Aug 2023", type: "company", signal: "neutral" },
                  { content: "• Built REST APIs using Node.js and PostgreSQL", type: "bullet", signal: "strong" },
                  { content: "• Reduced API response time by 28% through query optimization", type: "bullet", signal: "strong" },
                  { content: "• Collaborated with a 5-person engineering team on sprint deliverables", type: "bullet", signal: "warning" },
                  { content: "PROJECTS", type: "heading", signal: "neutral" },
                  { content: "Resume Analyzer Tool", type: "project", signal: "strong" },
                  { content: "React + Python application for parsing and scoring resumes", type: "detail", signal: "neutral" },
                  { content: "Campus Event Management System", type: "project", signal: "neutral" },
                  { content: "Full-stack web app for university event coordination", type: "detail", signal: "warning" },
                  { content: "SKILLS", type: "heading", signal: "neutral" },
                  { content: "JavaScript, Python, SQL, Git, REST APIs, Node.js, PostgreSQL, Basic AWS", type: "skillList", signal: "strong" },
                ].map((line, index) => (
                  <div key={index} className="flex items-start gap-4 group relative cursor-crosshair" onMouseEnter={() => setHoveredLine(index)} onMouseLeave={() => setHoveredLine(null)}>
                    <div className="w-4 flex-shrink-0 flex justify-center pt-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${getSignalColor(line.signal)} transition-all duration-300 ${hoveredLine === index ? "scale-[2]" : "scale-100"}`} />
                    </div>
                    <div className={`flex-1 py-1 px-3 rounded-lg transition-all duration-200 ${hoveredLine === index ? "bg-blue-500/10" : hoveredLine !== null ? "opacity-40" : ""}`}>
                      {line.type === "name" && <h3 className="text-2xl font-black text-white tracking-tight">{line.content}</h3>}
                      {line.type === "title" && <p className="text-lg font-bold text-blue-400">{line.content}</p>}
                      {line.type === "contact" && <p className="text-xs text-slate-500">{line.content}</p>}
                      {line.type === "heading" && <h4 className="text-xs font-bold text-slate-600 uppercase tracking-widest mt-5 mb-2 border-b border-white/5 pb-2">{line.content}</h4>}
                      {line.type === "degree" && <p className="text-sm font-bold text-slate-200">{line.content}</p>}
                      {line.type === "school" && <p className="text-xs text-slate-500">{line.content}</p>}
                      {line.type === "role" && <p className="text-sm font-bold text-slate-200">{line.content}</p>}
                      {line.type === "company" && <p className="text-xs text-slate-500 mb-1">{line.content}</p>}
                      {line.type === "bullet" && <p className="text-sm text-slate-400 leading-relaxed">{line.content}</p>}
                      {line.type === "project" && <p className="text-sm font-bold text-slate-200 mt-2">{line.content}</p>}
                      {line.type === "detail" && <p className="text-sm text-slate-400 leading-relaxed">{line.content}</p>}
                      {line.type === "skillList" && <p className="text-sm text-slate-400 leading-relaxed">{line.content}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* RIGHT: Reality Score Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="lg:sticky lg:top-24"
          >
            <div className="bg-[#111118] rounded-3xl border border-white/5 p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl" />
              
              <div className="flex flex-col items-center mb-8 relative z-10">
                <div className="relative w-32 h-32 mb-4 flex items-center justify-center">
                  <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-white/5" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray={`${72 * 2.64} ${100 * 2.64}`} strokeLinecap="round" className="text-blue-500 transition-all duration-1000" />
                  </svg>
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-4xl font-black text-white tracking-tight">72</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">/ 100</span>
                  </div>
                </div>
                <p className="text-sm font-bold text-slate-300">Reality Score</p>
                <p className="text-xs text-slate-500">Demo Analysis</p>
              </div>

              <div className="space-y-4 relative z-10">
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-4">Intelligence Breakdown</p>
                {[
                  { label: "ATS Survivability", score: 78, potential: 92 },
                  { label: "Content Signal Strength", score: 65, potential: 85 },
                  { label: "Role Reality Index", score: 72, potential: 88 },
                  { label: "Failure Cause Severity", score: 45, potential: 75 },
                ].map((metric, index) => (
                  <div key={metric.label} className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-slate-400">{metric.label}</span>
                      <span className="text-xs font-bold text-white">{metric.score}</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden relative">
                      <div className="absolute inset-y-0 left-0 bg-white/10 rounded-full" style={{ width: `${metric.potential}%` }} />
                      <div className="absolute inset-y-0 left-0 bg-transparent rounded-full border-r border-dashed border-slate-600" style={{ width: `${metric.potential}%` }} />
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${metric.score}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: 0.5 + index * 0.05 }}
                        className={`absolute inset-y-0 left-0 rounded-full ${getScoreColor(metric.score)} shadow-[0_0_10px_currentColor] opacity-80`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

/* ─── Before / After css card ─── */
const BeforeAfter = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
    {/* Before Card */}
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      className="bg-[#111118] border border-red-500/20 rounded-2xl p-8 relative overflow-hidden group"
    >
      <div className="absolute -top-4 -right-4 text-9xl text-red-500/5 font-black group-hover:scale-110 transition-transform duration-500">?</div>
      <div className="relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full mb-6">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500"/>
          <p className="text-red-400 text-[10px] font-bold uppercase tracking-widest">Your Resume Today</p>
        </div>
        <div className="space-y-4">
          {['Generic objective statement', 'Responsible for managing team', 'Worked on various projects', 'Skills: Microsoft Office', 'Education: BS Computer Science'].map((line, i) => (
            <motion.div 
              key={line} 
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="flex items-start gap-3"
            >
              <XCircle size={14} className="text-red-500/50 mt-0.5 shrink-0"/>
              <p className="text-slate-400 text-sm">{line}</p>
            </motion.div>
          ))}
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 pt-6 border-t border-white/5 space-y-2"
        >
          <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">Why It Gets Rejected</p>
          <p className="text-red-400 text-sm">ATS Survivability: 23% — auto-rejected before human review</p>
          <p className="text-amber-400 text-sm">Keyword Match: 0 of 12 required terms found</p>
          <p className="text-red-400 text-sm">Signal Density: passive language, no quantified impact</p>
        </motion.div>
      </div>
    </motion.div>

    {/* After Card */}
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      className="bg-[#16161E] border border-green-500/30 rounded-2xl p-8 relative overflow-hidden shadow-[0_0_40px_rgba(34,197,94,0.05)] group"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent pointer-events-none"/>
      <div className="absolute -top-4 -right-4 text-9xl text-green-500/5 font-black group-hover:scale-110 transition-transform duration-500">!</div>
      <div className="relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full mb-6">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]"/>
          <p className="text-green-400 text-[10px] font-bold uppercase tracking-widest">After HireMax AI</p>
        </div>
        <div className="space-y-4">
          {[
            'Led cross-functional team of 8, shipping 3 features', 
            'Increased API throughput by 40% via caching', 
            'Reduced deployment time 60% with CI/CD pipeline', 
            'Python · Go · Kubernetes · AWS · Terraform', 
            'BS CS, Stanford — Dean\'s List'
          ].map((line, i) => (
            <motion.div 
              key={line}
              initial={{ opacity: 0, filter: 'blur(4px)', x: -10 }}
              whileInView={{ opacity: 1, filter: 'blur(0px)', x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 + (i * 0.15), type: 'spring', stiffness: 100 }}
              className="flex items-start gap-3 bg-white/5 rounded-lg p-2.5 -mx-2.5 border border-white/5 hover:border-green-500/30 hover:bg-green-500/5 transition-all"
            >
              <div className="mt-0.5 shrink-0 bg-green-500/20 rounded-full p-0.5">
                <CheckCircle size={12} className="text-green-400"/>
              </div>
              <p className="text-slate-200 font-medium text-sm leading-relaxed">{line}</p>
            </motion.div>
          ))}
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.2, type: 'spring' }}
          className="mt-6 pt-6 border-t border-white/5 space-y-2"
        >
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">After Rebuild</p>
          <p className="text-green-400 text-sm">ATS Survivability: 91% — machine-readable and keyword-matched</p>
          <p className="text-green-400 text-sm">Keyword Match: 10 of 12 required terms naturally integrated</p>
          <p className="text-green-400 text-sm">Signal Density: 7 quantified metrics, 9 ownership verbs</p>
        </motion.div>
      </div>
    </motion.div>
  </div>
);

/* ─── Who Is This For ─── */
const WhoIsThisFor = () => (
  <section className="py-24 md:py-32 bg-[#0D0D14]">
    <div className="container mx-auto px-6 max-w-5xl">
      <div className="text-center mb-16">
        <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-3">Honest Assessment</p>
        <h2 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight">
          Is This <span className="text-slate-500">For You?</span>
        </h2>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto">
          We're not for everyone. Here's how to know if this will actually help you.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-3xl border border-green-500/20 bg-green-500/5 p-8 md:p-10">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 rounded-xl bg-green-500/10">
              <Check className="h-6 w-6 text-green-400" />
            </div>
            <h3 className="text-xl font-black text-white">This is for you if...</h3>
          </div>
          <ul className="space-y-5">
            {[
              "You've applied to 50+ jobs with minimal responses",
              "You're a recent graduate struggling to break in",
              "You're pivoting careers and need to reposition",
              "You want data-driven feedback, not opinions",
              "You're ready to invest time in genuine improvement",
            ].map((item) => (
              <li key={item} className="flex items-start gap-4">
                <Check className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
                <span className="text-slate-300 font-medium">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-8 md:p-10">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 rounded-xl bg-red-500/10">
              <XCircle className="h-6 w-6 text-red-400" />
            </div>
            <h3 className="text-xl font-black text-white">This is NOT for you if...</h3>
          </div>
          <ul className="space-y-5">
            {[
              "You want magic fixes without any effort",
              "You think resume advice doesn't matter",
              "You're looking for someone to write your resume",
              "You're not willing to iterate and improve",
              "You just want validation, not truth",
            ].map((item) => (
              <li key={item} className="flex items-start gap-4">
                <XCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                <span className="text-slate-400 font-medium">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  </section>
);


/* ─── Main Landing Page ─── */
export const LandingPage: React.FC<Props> = ({ onGetStarted, onViewPlans, onViewTerms, onViewPrivacy, onViewRefund }) => {
  const [activePain, setActivePain] = useState(0);
  const [showSticky, setShowSticky] = useState(false);
  const pains = [
    'Sending 60 applications. Getting 2 responses. Something is wrong.',
    'Rejected before a human ever reads your name.',
    '250 other engineers applied to that same role today.',
    'Your LinkedIn is invisible. You don\'t even show up in searches.',
    'You\'re not underqualified. Your resume just can\'t survive the filter.',
  ];

  useEffect(() => {
    const t = setInterval(() => setActivePain(p => (p + 1) % pains.length), 3000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const handleScroll = () => setShowSticky(window.scrollY > 600);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="bg-[#0A0A0F] min-h-screen font-sans selection:bg-blue-500/30 selection:text-white">

      {/* ── STICKY HEADER ── */}
      <AnimatePresence>
        {showSticky && (
          <motion.div
            key="sticky-header"
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed top-0 left-0 right-0 z-[100] bg-[#0A0A0F]/95 backdrop-blur-md border-b border-white/10 py-3 px-6 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg overflow-hidden border border-[#2D313D] bg-[#0E1118] flex items-center justify-center">
                <img src="/favicon.png" alt="HireMax" className="w-full h-full object-cover" loading="lazy" />
              </div>
              <p className="text-white font-black text-sm tracking-tight">HireMax</p>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-slate-400 text-xs hidden md:block">Free analysis · No credit card</p>
              <button
                onClick={onGetStarted}
                className="bg-white text-black font-black text-xs px-5 py-2.5 rounded-lg hover:bg-blue-50 transition-colors uppercase tracking-wide"
              >
                Get Free Score →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SIMPLE TOP BAR ── */}
      <div className="absolute top-0 left-0 right-0 px-6 py-6 flex justify-between items-center z-50 max-w-7xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl overflow-hidden flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.2)] border border-[#2D313D] bg-[#0E1118]">
            <img src="/favicon.png" alt="HireMax Logo" className="w-full h-full object-cover" />
          </div>
          <span className="text-white font-black text-lg tracking-tight">HireMax</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={onGetStarted} className="text-slate-400 hover:text-white text-sm font-bold transition-colors">Sign In</button>
          <button onClick={onGetStarted} className="bg-white/10 hover:bg-white/20 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors border border-white/10">Get Started</button>
        </div>
      </div>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden px-6 pt-24 pb-20 text-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-blue-600/15 rounded-full blur-[150px] pointer-events-none"/>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-2 mb-10">
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <p className="text-blue-300 text-xs font-bold tracking-wide">2026 Job Market: 250+ applicants per role at tech companies</p>
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter text-white max-w-5xl mx-auto leading-[1.05] mb-8">
            You're Being{' '}
            <span className="relative inline-block">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-red-400 via-rose-400 to-orange-400">Auto-Rejected</span>
            </span>
            <br />Before Anyone Reads Your Name.
          </h1>

          <div className="flex items-center justify-center gap-3 mb-10 h-8">
            <AlertTriangle size={18} className="text-amber-400 shrink-0"/>
            <p className="text-amber-300 text-lg font-medium transition-all duration-500 key={activePain}">
              {pains[activePain]}
            </p>
          </div>

          <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto mb-12 leading-relaxed">
            HireMax shows you exactly where your resume fails — ATS system by system, line by line — then rebuilds it with AI to fix every gap. Not a score. A diagnosis.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
            <button onClick={onGetStarted}
              className="group flex items-center gap-3 bg-white text-black font-black text-lg px-10 py-5 rounded-2xl transition-all shadow-[0_0_40px_rgba(255,255,255,0.15)] hover:shadow-[0_0_60px_rgba(255,255,255,0.25)] hover:-translate-y-0.5">
              Get My Free Diagnosis
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform"/>
            </button>
            <button onClick={onViewPlans} className="flex items-center justify-center gap-2 text-white bg-white/5 hover:bg-white/10 border border-white/10 text-base font-bold px-10 py-5 rounded-2xl transition-colors">
              See How It Works
            </button>
          </div>

          <p className="text-slate-500 text-sm font-medium">Join engineers from Google, Meta, Stripe, and Coinbase who used HireMax during their layoff searches</p>
          <p className="text-slate-600 text-xs mt-2">Free analysis in 60 seconds · No credit card · No fluff, just data</p>
        </motion.div>
      </section>

      <TrustIndicators />
      <WhoIsThisFor />
      <ProblemSection />
      <ScreeningPipeline />
      <ResumeDemoSection id="how-it-works" />

      {/* ── BEFORE / AFTER ── */}
      <section className="py-24 px-6 bg-[#0D0D14] border-t border-white/5">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-3">The Transformation</p>
          <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-6">
            It's Not About <span className="text-slate-500">Formatting</span>
          </h2>
          <p className="text-slate-400 text-lg">
            The difference between getting callbacks and getting ignored isn't fonts or colors. It's positioning, signal clarity, and strategic communication.
          </p>
        </div>
        <BeforeAfter/>
      </section>

      {/* ── 6 TOOLS ── */}
      <section id="features" className="py-24 px-6 bg-[#0A0A0F] relative">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-violet-600/5 rounded-full blur-[150px] pointer-events-none"/>
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-3">The Complete Career OS</p>
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-6">
              Every tool you need.<br className="hidden sm:block"/> One platform.
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
              Other platforms solve one problem. HireMax covers your entire job search — resume to offer.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
            <ToolCard icon={Sparkles}    color="bg-blue-500"    title="AI Resume Rebuild"      mostUsed outcome="Resume goes from ATS-invisible to ATS-optimized" timeLabel="15 min" pain="Your resume is buried in the ATS." solution="Our AI rewrites every bullet with impact metrics, action verbs, and role-matched keywords — optimized for ATS survivability."/>
            <ToolCard icon={ShieldCheck} color="bg-violet-500"  title="Interview Prep Kit"     outcome="Answer every question from YOUR resume, not a template" timeLabel="20 min" pain="You're giving generic answers." solution="Get a 5-tab kit with real questions per round, coached STAR frameworks, and what NOT to say — built from the job description."/>
            <ToolCard icon={FileText}    color="bg-green-500"   title="Cover Letter Engine"    outcome="Every letter maps your bullets to exact JD requirements" timeLabel="5 min" pain="You're sending generic templates." solution="Every letter maps your specific resume bullets to exact JD requirements. Evidence-based, not fluff."/>
            <ToolCard icon={Briefcase}   color="bg-amber-500"   title="Application Tracker"    outcome="No opportunity slips through the cracks" timeLabel="2 min" pain="You've lost track of your applications." solution="Kanban pipeline with AI-drafted follow-ups and overdue reminders. No opportunity slips through the cracks."/>
            <ToolCard icon={Linkedin}    color="bg-sky-500"     title="LinkedIn Optimizer"     outcome="Start showing up in recruiter searches" timeLabel="10 min" pain="You aren't showing up in recruiter searches." solution="We score 50 keyword dimensions by recruiter search volume and show exactly which fields to update."/>
            <ToolCard icon={TrendingUp}  color="bg-indigo-500"  title="Market Intelligence"    outcome="Know your real market value before you negotiate" timeLabel="Instant" pain="You're negotiating blind." solution="Salary bands, hiring velocity by company stage, and skill demand by role — so you always know your real market value."/>
          </div>
        </div>
      </section>

      <FAQSection />

      {/* ── FINAL CTA ── */}
      <section className="py-32 px-6 text-center relative overflow-hidden bg-[#0A0A0F] border-t border-white/5">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-600/5 to-transparent pointer-events-none"/>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
        
        <div className="max-w-3xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-blue-500/30 bg-blue-500/10 mb-10"
          >
            <Sparkles className="h-4 w-4 text-blue-400" />
            <span className="text-sm text-blue-300 font-bold tracking-wide">Start Your Analysis Today</span>
          </motion.div>

          <h2 className="text-5xl md:text-6xl lg:text-7xl font-black text-white tracking-tighter mb-6 leading-tight">
            Stop Wondering.
            <span className="block text-slate-500 mt-2">Start Knowing.</span>
          </h2>
          <p className="text-slate-400 text-lg md:text-xl mb-12 max-w-2xl mx-auto leading-relaxed">
            Your next application could be different. Get the clarity you need to finally break through the noise.
          </p>
          <button onClick={onGetStarted}
            className="group inline-flex items-center justify-center gap-3 w-full sm:w-auto bg-white text-black font-black text-xl px-12 py-6 rounded-2xl transition-all shadow-[0_0_40px_rgba(255,255,255,0.15)] hover:shadow-[0_0_60px_rgba(255,255,255,0.25)] hover:scale-[1.02]">
            Analyze Your Resume
            <ArrowRight size={24} className="group-hover:translate-x-1.5 transition-transform"/>
          </button>
          
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 mt-10 text-slate-500 text-sm font-medium">
            <span className="flex items-center gap-2"><Check size={16} className="text-green-400"/> Analysis in under 2 minutes</span>
            <span className="flex items-center gap-2"><Check size={16} className="text-green-400"/> No credit card required</span>
            <span className="flex items-center gap-2"><Check size={16} className="text-green-400"/> Full transparency</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-[#0D0D14]">
        <div className="max-w-6xl mx-auto px-6 pt-14 pb-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center">
                  <Shield size={16} className="text-black"/>
                </div>
                <span className="text-white font-black text-lg">HireMax</span>
              </div>
              <p className="text-slate-500 text-sm leading-relaxed max-w-xs">
                AI-powered career intelligence for engineers who are serious about landing their next role.
              </p>
              <a href="mailto:hiremax.ai@gmail.com" className="mt-4 inline-block text-blue-400 hover:text-blue-300 text-sm font-semibold transition-colors">
                hiremax.ai@gmail.com
              </a>
            </div>
            {/* Product */}
            <div>
              <p className="text-white font-bold text-sm mb-4 uppercase tracking-widest">Product</p>
              <div className="space-y-3">
                <button onClick={onGetStarted} className="block text-slate-400 hover:text-white text-sm transition-colors">Get Started Free</button>
                <button onClick={onViewPlans} className="block text-slate-400 hover:text-white text-sm transition-colors">Pricing</button>
                <button onClick={onGetStarted} className="block text-slate-400 hover:text-white text-sm transition-colors">Sign In</button>
              </div>
            </div>
            {/* Legal */}
            <div>
              <p className="text-white font-bold text-sm mb-4 uppercase tracking-widest">Legal</p>
              <div className="space-y-3">
                <button onClick={onViewTerms} className="block text-slate-400 hover:text-white text-sm transition-colors">Terms of Service</button>
                <button onClick={onViewPrivacy} className="block text-slate-400 hover:text-white text-sm transition-colors">Privacy Policy</button>
                <button onClick={onViewRefund} className="block text-slate-400 hover:text-white text-sm transition-colors">Refund Policy</button>
              </div>
            </div>
          </div>
          {/* Bottom bar */}
          <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-slate-600 text-xs font-medium">© 2025–2026 HireMax.</p>
            <p className="text-slate-700 text-xs">No guarantee of employment outcomes. Results depend on individual effort and market conditions.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
