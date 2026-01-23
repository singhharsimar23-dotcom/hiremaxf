
import React, { useEffect, useState, useRef } from 'react';
import { 
  Shield, 
  ArrowRight, 
  ChevronRight, 
  Search, 
  Zap, 
  Sparkles, 
  FileCheck, 
  Building2, 
  BarChart3, 
  History, 
  Layout, 
  Target,
  ArrowDown,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  XCircle,
  Fingerprint,
  Cpu,
  LineChart,
  Eye
} from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
  onViewPlans?: () => void;
}

const TabbedConsole = () => {
  const [activeTab, setActiveTab] = useState(0);
  const tabs = [
    {
      label: "Resume Intelligence",
      icon: <Cpu size={18} />,
      features: [
        { t: "Role-Specific Rebuild", d: "Content re-mapped for specific role expectations.", icon: Zap },
        { t: "8-Point Analysis", d: "Structural audit of top hiring signals.", icon: FileCheck },
        { t: "Metric Surfacing", d: "Algorithmically identifies hidden impact data.", icon: Target }
      ]
    },
    {
      label: "Screening & ATS",
      icon: <ShieldCheck size={18} />,
      features: [
        { t: "ATS Shield", d: "Guarantees zero-loss data parsing.", icon: Shield },
        { t: "Knockout Filter Safe", d: "Proactively checks for disqualification triggers.", icon: XCircle },
        { t: "Parseability Score", d: "Technical verification of document layers.", icon: Layout }
      ]
    },
    {
      label: "Market Intelligence",
      icon: <LineChart size={18} />,
      features: [
        { t: "Market Signals", d: "Live feed of industry requirement shifts.", icon: Sparkles },
        { t: "Skill Radar", d: "Benchmarks your stack against top applicants.", icon: BarChart3 },
        { t: "Trajectory Forecasting", d: "Predicts skill shelf-life for your role.", icon: History }
      ]
    }
  ];

  return (
    <div className="w-full bg-[#111420] border border-[#2D313D] rounded-[3rem] overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-1000">
      <div className="flex border-b border-[#2D313D]">
        {tabs.map((tab, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            className={`flex-1 py-6 flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === i ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
      <div className="p-12 grid md:grid-cols-3 gap-8 min-h-[300px]">
        {tabs[activeTab].features.map((f, i) => (
          <div key={i} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500 delay-[100ms] group cursor-default">
            <div className="w-12 h-12 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
              <f.icon size={24} />
            </div>
            <h4 className="text-white font-bold text-lg leading-tight">{f.t}</h4>
            <p className="text-slate-500 text-sm leading-relaxed font-medium">{f.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const BeforeAfterSlider = () => {
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const pos = ((x - rect.left) / rect.width) * 100;
    setSliderPos(Math.min(100, Math.max(0, pos)));
  };

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMove}
      onTouchMove={handleMove}
      className="relative w-full aspect-[16/9] bg-[#0B0F1A] rounded-[3rem] overflow-hidden border border-[#2D313D] shadow-2xl cursor-ew-resize group"
    >
      {/* Before Content */}
      <div className="absolute inset-0 p-12 bg-slate-900 flex flex-col gap-6 opacity-30 grayscale pointer-events-none">
        <div className="h-4 w-1/3 bg-slate-800 rounded"></div>
        <div className="space-y-2">
          <div className="h-2 w-full bg-slate-800 rounded"></div>
          <div className="h-2 w-full bg-slate-800 rounded"></div>
          <div className="h-2 w-2/3 bg-slate-800 rounded"></div>
        </div>
        <div className="p-4 border border-red-500/20 rounded-xl">
           <p className="text-[9px] text-red-500 font-black uppercase tracking-widest mb-1">Critical Error</p>
           <p className="text-[11px] text-slate-500">Low signal density detected.</p>
        </div>
      </div>

      {/* After Content (Clipped) */}
      <div 
        className="absolute inset-0 p-12 bg-[#161B2E] flex flex-col gap-6 pointer-events-none transition-all duration-75"
        style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
      >
        <div className="h-4 w-1/3 bg-blue-500 rounded animate-pulse"></div>
        <div className="space-y-2">
          <div className="h-2 w-full bg-blue-500/30 rounded"></div>
          <div className="h-2 w-full bg-blue-500/30 rounded"></div>
          <div className="h-2 w-2/3 bg-blue-500/30 rounded"></div>
        </div>
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
           <p className="text-[9px] text-green-500 font-black uppercase tracking-widest mb-1">Optimization Active</p>
           <p className="text-[11px] text-white font-bold">Role-specific metrics surfaced +42%.</p>
        </div>
        <div className="absolute top-1/2 right-20 transform translate-x-1/2 -translate-y-1/2 rotate-12">
           <div className="bg-white text-black font-black px-4 py-1 text-[10px] uppercase tracking-widest shadow-xl">Architected</div>
        </div>
      </div>

      {/* Slider Line */}
      <div 
        className="absolute inset-y-0 w-1 bg-blue-500 cursor-ew-resize"
        style={{ left: `${sliderPos}%` }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-xl">
          <ArrowRight size={16} />
        </div>
      </div>

      <div className="absolute top-6 left-6 bg-black/50 backdrop-blur-md px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-400">Before (Generic)</div>
      <div className="absolute top-6 right-6 bg-blue-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-white">After (HireMax)</div>
    </div>
  );
};

const RotatingProofs = () => {
  const [index, setIndex] = useState(0);
  const proofs = [
    { r: "Technical Lead", c: "By prioritizing specific infrastructure ownership, callback rates in technical screening normalized within a week." },
    { r: "Product Director", c: "HireMax identified a misalignment between my enterprise background and the growth-stage roles I was targeting." },
    { r: "Operations Lead", c: "It moved the right details to the top for recruiter skim-read patterns. Rejections dropped instantly." }
  ];

  useEffect(() => {
    const timer = setInterval(() => setIndex(i => (i + 1) % proofs.length), 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative h-48 flex items-center justify-center">
      {proofs.map((p, i) => (
        <div 
          key={i} 
          className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-1000 ${index === i ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 scale-95 pointer-events-none'}`}
        >
          <p className="text-2xl md:text-3xl text-white font-bold text-center max-w-2xl leading-tight mb-6 italic">"{p.c}"</p>
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500">{p.r}</span>
        </div>
      ))}
    </div>
  );
};

const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onViewPlans }) => {
  return (
    <div className="min-h-screen bg-[#0B0F1A] text-[#CBD5E1] selection:bg-blue-500/30 font-sans overflow-x-hidden">
      {/* Background Animated Elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.08),transparent_50%)]"></div>
        <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_80%_80%,rgba(99,102,241,0.08),transparent_50%)]"></div>
        <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]"></div>
      </div>

      {/* Navigation */}
      <nav className="h-20 border-b border-[#2D313D] px-8 md:px-12 flex items-center justify-between sticky top-0 bg-[#0B0F1A]/90 backdrop-blur-xl z-[100]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg transition-transform hover:rotate-12 cursor-pointer">
            <Shield className="text-black" size={22} />
          </div>
          <h1 className="text-white font-black text-xl tracking-tight">HireMax</h1>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={onGetStarted} className="px-6 py-2.5 rounded-xl text-[11px] font-black text-slate-400 hover:text-white transition-all uppercase tracking-[0.2em]">Sign in</button>
          <button onClick={onGetStarted} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-blue-500 transition-all shadow-xl shadow-blue-900/40">Join the System</button>
        </div>
      </nav>

      {/* SECTION 1 — HERO SYSTEM PANEL */}
      <section className="relative max-w-7xl mx-auto px-8 md:px-12 pt-32 pb-48 z-10">
        <div className="grid lg:grid-cols-12 gap-20 items-center">
          <div className="lg:col-span-7 space-y-12">
            <h2 className="text-6xl md:text-[5.5rem] font-black text-white tracking-tighter leading-[0.85] uppercase">
              {["Your", "resume", "should", "change", "for", "every", "role."].map((word, i) => (
                <span key={i} className="inline-block mr-[0.2em] animate-in fade-in slide-in-from-bottom-4 fill-mode-both" style={{ animationDelay: `${i * 100}ms` }}>
                  {word === "change" ? <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-indigo-400">{word}</span> : word}
                </span>
              ))}
            </h2>
            <p className="text-xl md:text-2xl text-slate-400 leading-relaxed max-w-2xl font-medium animate-in fade-in duration-1000 delay-700 fill-mode-both">
              HireMax rebuilds your resume for a specific role, industry, and company type — and shows you how recruiters and ATS systems actually judge it.
            </p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 animate-in fade-in duration-1000 delay-1000 fill-mode-both">
              <button 
                onClick={onGetStarted}
                className="px-12 py-6 bg-white text-black font-black rounded-2xl text-xl hover:bg-slate-200 hover:shadow-[0_0_50px_rgba(255,255,255,0.2)] transition-all flex items-center gap-3 group relative overflow-hidden"
              >
                <span>Get started</span>
                <ArrowRight size={24} className="group-hover:translate-x-2 transition-transform" />
              </button>
              <button onClick={() => document.getElementById('diagnostic')?.scrollIntoView({ behavior: 'smooth' })} className="px-10 py-6 border border-[#2D313D] text-white font-bold rounded-2xl text-lg hover:bg-white/5 transition-all">See how it works</button>
            </div>
          </div>
          <div className="lg:col-span-5 relative animate-in zoom-in-95 duration-1000 delay-300">
            <div className="absolute inset-0 bg-blue-600/20 blur-[120px] rounded-full animate-pulse"></div>
            <div className="relative bg-[#161B2E] border border-[#2D313D] p-10 rounded-[3rem] shadow-2xl space-y-8 group hover:-translate-y-2 transition-all duration-700">
              <div className="flex justify-between items-center">
                 <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-black font-black">HM</div>
                 <div className="px-4 py-1.5 bg-blue-600/20 border border-blue-500/20 rounded-full text-[9px] font-black uppercase tracking-widest text-blue-400">Optimization Active</div>
              </div>
              <div className="space-y-6">
                {[
                  { l: "Header", w: "full", delay: "delay-[0ms]", icon: <Fingerprint size={12} /> },
                  { l: "Experience Architect", w: "5/6", delay: "delay-[200ms]", active: true, icon: <Cpu size={12} /> },
                  { l: "Skill Calibration", w: "full", delay: "delay-[400ms]", icon: <Zap size={12} /> }
                ].map((s, i) => (
                  <div key={i} className={`p-4 border border-[#2D313D] rounded-2xl flex items-center justify-between transition-all duration-700 ${s.active ? 'bg-blue-600/10 border-blue-500 scale-[1.05]' : 'bg-[#0D111F] opacity-40'} ${s.delay}`}>
                    <div className="flex items-center gap-3">
                       <span className={s.active ? 'text-blue-500' : 'text-slate-600'}>{s.icon}</span>
                       <span className="text-[10px] font-black uppercase tracking-widest text-white">{s.l}</span>
                    </div>
                    {s.active && <div className="h-1 w-12 bg-blue-500 rounded-full animate-pulse"></div>}
                  </div>
                ))}
              </div>
              <div className="pt-8 mt-8 border-t border-white/5">
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest text-center">Structure adapting for Senior Product Lead @ Startup</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2 — INTERACTIVE DIAGNOSTIC */}
      <section id="diagnostic" className="bg-[#0D111F] py-32 border-y border-[#1D2130] overflow-hidden relative">
        <div className="max-w-7xl mx-auto px-10 relative z-10">
          <div className="text-center mb-24 space-y-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500 mb-4">The Screening Logic</h2>
            <h3 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase leading-none">Why most resumes fail</h3>
          </div>
          
          <div className="grid lg:grid-cols-2 gap-12 items-center">
             <div className="space-y-8">
                {[
                  { t: "ATS rejected", d: "Poorly layered documents cause parsing errors in 60% of cases.", status: 'fail' },
                  { t: "Signal density too low", d: "Recruiters skip descriptions that lack deterministic metrics.", status: 'warning' },
                  { t: "Alignment identified", d: "Keywords and order precisely match role expectations.", status: 'pass' }
                ].map((item, i) => (
                  <div key={i} className={`p-8 rounded-[2rem] border transition-all duration-1000 animate-in slide-in-from-left-8 ${i === 2 ? 'bg-blue-600/10 border-blue-500/50 scale-[1.05]' : 'bg-[#161B2E] border-[#2D313D] opacity-40'}`} style={{ animationDelay: `${i * 300}ms` }}>
                    <div className="flex items-center justify-between mb-4">
                       <h4 className="text-lg font-bold text-white uppercase tracking-tight">{item.t}</h4>
                       {i === 2 ? <CheckCircle2 className="text-blue-500" /> : <AlertCircle className="text-slate-600" />}
                    </div>
                    <p className="text-sm text-slate-500 font-medium">{item.d}</p>
                  </div>
                ))}
             </div>
             <div className="relative group">
                <div className="absolute inset-0 bg-blue-600/10 blur-[100px] rounded-full opacity-50"></div>
                <div className="relative p-1 bg-gradient-to-br from-blue-600/50 to-indigo-600/50 rounded-[3.5rem] shadow-2xl transform rotate-3 transition-transform group-hover:rotate-0 duration-1000">
                   <div className="bg-[#0B0F1A] p-12 rounded-[3.4rem] space-y-8">
                      <div className="flex justify-between border-b border-white/5 pb-8">
                         <div className="w-16 h-16 bg-slate-800 rounded-full animate-pulse"></div>
                         <div className="space-y-3 flex-1 ml-8">
                            <div className="h-4 w-1/2 bg-slate-800 rounded"></div>
                            <div className="h-2 w-full bg-slate-800 rounded"></div>
                         </div>
                      </div>
                      <div className="p-6 bg-red-600/10 border border-red-500/20 rounded-2xl flex items-center gap-4 animate-bounce">
                         <XCircle className="text-red-500" size={20} />
                         <span className="text-[10px] font-black uppercase tracking-widest text-red-500">Auto-reject: low relevance found</span>
                      </div>
                      <div className="p-6 bg-blue-600/10 border border-blue-500/20 rounded-2xl flex items-center gap-4">
                         <ShieldCheck className="text-blue-500" size={20} />
                         <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">HireMax Override Active</span>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* SECTION 3 — TABBED CONSOLE */}
      <section className="max-w-7xl mx-auto px-10 py-32 z-10">
        <div className="text-center mb-20 space-y-4">
          <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-700 mb-4">System Console</h2>
          <h3 className="text-5xl font-black text-white tracking-tighter uppercase">Intelligence Built-In</h3>
        </div>
        <TabbedConsole />
      </section>

      {/* SECTION 4 — BEFORE/AFTER SLIDER */}
      <section className="bg-[#0D111F] py-32 border-y border-[#1D2130] z-10">
        <div className="max-w-6xl mx-auto px-10">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div className="space-y-10">
               <div className="inline-block px-4 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full shadow-lg">
                <span className="text-[10px] font-black uppercase tracking-widest text-green-500">One Resume Rebuild • $19</span>
              </div>
              <h3 className="text-6xl font-black text-white tracking-tighter uppercase leading-none">Start with one.<br/>Build it right.</h3>
              <p className="text-xl text-slate-400 font-medium leading-relaxed">
                One professional resume rebuild for a specific role and company. No subscription. No fluff. 
                Move the slider to see how structural logic beats generic phrasing.
              </p>
              <div className="space-y-6 pt-6">
                 {[
                   { t: "Section order changed", d: "Re-prioritized based on what recruiters scan first." },
                   { t: "Metrics surfaced", d: "Hidden achievements converted into deterministic data." },
                   { t: "Role keywords aligned", d: "Zeroing in on specific industry requirement triggers." }
                 ].map((item, i) => (
                   <div key={i} className="flex gap-4 animate-in fade-in slide-in-from-left-4 fill-mode-both" style={{ animationDelay: `${i * 150}ms` }}>
                     <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 shrink-0"></div>
                     <div>
                       <p className="text-white font-bold text-base">{item.t}</p>
                       <p className="text-[#CBD5E1] text-sm font-medium opacity-70">{item.d}</p>
                     </div>
                   </div>
                 ))}
              </div>
              <button 
                onClick={onGetStarted}
                className="w-full sm:w-auto mt-10 px-12 py-6 bg-white text-black font-black rounded-2xl text-xl hover:bg-slate-200 transition-all flex items-center justify-center gap-3 shadow-2xl"
              >
                Rebuild my resume <ArrowRight size={20} />
              </button>
            </div>
            <BeforeAfterSlider />
          </div>
        </div>
      </section>

      {/* SECTION 5 — SCROLLING INTELLIGENCE STACK */}
      <section className="max-w-5xl mx-auto px-10 py-32 space-y-24 z-10">
        <div className="text-center space-y-4">
          <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 mb-4">Advanced Strategy</h2>
          <h3 className="text-5xl font-black text-white tracking-tighter uppercase">Scrolling Stack Intelligence</h3>
        </div>
        
        <div className="space-y-[30vh]">
          {[
            { t: "Recruiter Scan Simulation", d: "Simulates the 8-second visual scan of your profile to ensure key signals aren't missed.", icon: Eye, color: "text-blue-500" },
            { t: "Rejection Breakdown", d: "Mechanical analysis of why automated filters or humans might flag your profile for rejection.", icon: ShieldCheck, color: "text-purple-500" },
            { t: "Market Positioning", d: "Determines your percentile ranking within current applicant pools for Tier-1 companies.", icon: BarChart3, color: "text-teal-500" },
            { t: "Skill Gap Analysis", d: "Identifies specific technical or leadership gaps relative to the role you want.", icon: Zap, color: "text-blue-500" },
            { t: "Trajectory Forecasting", d: "Uses market data to predict the longevity of your current skill set.", icon: History, color: "text-purple-500" }
          ].map((f, i) => (
            <div key={i} className="sticky top-40 bg-[#161B2E] border border-[#2D313D] p-12 rounded-[3.5rem] shadow-[0_0_80px_rgba(0,0,0,0.5)] transform transition-all duration-700 hover:scale-[1.02] flex items-center gap-12 group">
              <div className={`w-24 h-24 rounded-3xl bg-[#0B0F1A] flex items-center justify-center ${f.color} shrink-0 group-hover:rotate-12 transition-transform`}>
                <f.icon size={48} />
              </div>
              <div className="space-y-4">
                 <h4 className="text-3xl font-black text-white tracking-tighter uppercase">{f.t}</h4>
                 <p className="text-xl text-slate-500 font-medium leading-relaxed">{f.d}</p>
              </div>
              <div className="absolute top-8 right-12 text-[10px] font-black text-slate-800 uppercase tracking-widest">Signal Layer 0{i+1}</div>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 6 — ANIMATED TIMELINE */}
      <section className="bg-[#0D111F] py-32 border-y border-[#1D2130] z-10">
        <div className="max-w-7xl mx-auto px-10">
          <div className="text-center mb-24 space-y-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-600 mb-4">The Process</h2>
            <h3 className="text-5xl font-black text-white tracking-tighter uppercase">Deterministic Pipeline</h3>
          </div>
          <div className="grid md:grid-cols-6 gap-8 relative">
            <div className="hidden md:block absolute top-12 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-blue-500/20 to-transparent"></div>
            {[
              { num: "01", t: "Upload", icon: <Fingerprint size={16} /> },
              { num: "02", t: "Context", icon: <Target size={16} /> },
              { num: "03", t: "Analyze", icon: <Search size={16} /> },
              { num: "04", t: "Rebuild", icon: <Zap size={16} /> },
              { num: "05", t: "Compare", icon: <Layout size={16} /> },
              { num: "06", t: "Result", icon: <ArrowRight size={16} /> }
            ].map((step, i) => (
              <div key={i} className="relative text-center space-y-6 group">
                <div className="w-16 h-16 bg-[#161B2E] border border-[#2D313D] rounded-2xl flex items-center justify-center text-white font-black text-xl mx-auto shadow-2xl relative z-10 group-hover:bg-blue-600 group-hover:border-blue-600 transition-all duration-500 group-hover:-translate-y-2">
                  {step.icon}
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{step.num}</p>
                  <h4 className="text-sm font-bold text-white uppercase tracking-tighter">{step.t}</h4>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 7 — AUTO-ROTATING PROOF */}
      <section className="max-w-7xl mx-auto px-10 py-32 z-10 border-b border-[#1D2130]">
        <div className="text-center mb-12">
          <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-700">Used by people who stopped guessing</h2>
        </div>
        <RotatingProofs />
      </section>

      {/* SECTION 8 — FINAL CTA PANEL */}
      <section className="px-10 py-32 z-10 relative">
        <div className="max-w-7xl mx-auto bg-gradient-to-r from-blue-700 via-indigo-800 to-blue-900 rounded-[4rem] p-12 md:p-32 text-center text-white shadow-[0_0_120px_rgba(59,130,246,0.3)] relative overflow-hidden group animate-gradient">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1),transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
          <div className="relative z-10 max-w-4xl mx-auto space-y-12">
            <h2 className="text-6xl md:text-[6rem] font-black tracking-tighter leading-[0.9] uppercase animate-in fade-in slide-in-from-bottom-8 duration-700">
              Stop sending the<br/>wrong resume.
            </h2>
            <p className="text-xl md:text-2xl font-medium text-blue-100 opacity-80 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">Build the one this role expects.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500">
              <button 
                onClick={onGetStarted}
                className="w-full sm:w-auto px-16 py-8 bg-white text-blue-900 font-black rounded-[2rem] text-2xl hover:bg-slate-100 hover:scale-105 hover:shadow-2xl transition-all flex items-center justify-center gap-4 group/btn"
              >
                <span>Get started</span>
                <ArrowRight size={28} className="group-hover/btn:translate-x-3 transition-transform" />
              </button>
              <button 
                onClick={onViewPlans}
                className="w-full sm:w-auto px-12 py-8 border border-white/30 text-white font-bold rounded-[2rem] text-xl hover:bg-white/15 backdrop-blur-md transition-all hover:scale-105"
              >
                View plans
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-24 px-10 border-t border-[#1D2130] bg-[#0B0F1A] z-10 relative">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 text-center md:text-left">
           <div className="space-y-6">
              <div className="flex items-center justify-center md:justify-start gap-3">
                <Shield className="text-white" size={24} />
                <span className="text-white font-black text-xl tracking-tight">HireMax</span>
              </div>
              <p className="text-slate-500 text-sm font-medium leading-relaxed">
                A deterministic intelligence system for professional career advancement.
              </p>
           </div>
           <div>
              <h5 className="text-white font-black text-[10px] uppercase tracking-widest mb-6">Product</h5>
              <ul className="space-y-4 text-slate-500 text-sm font-bold">
                 <li><button onClick={onGetStarted} className="hover:text-white transition-colors">Resume Architect</button></li>
                 <li><button onClick={onViewPlans} className="hover:text-white transition-colors">Intelligence Report</button></li>
                 <li><button onClick={onGetStarted} className="hover:text-white transition-colors">Market Signals</button></li>
              </ul>
           </div>
           <div>
              <h5 className="text-white font-black text-[10px] uppercase tracking-widest mb-6">System</h5>
              <ul className="space-y-4 text-slate-500 text-sm font-bold">
                 <li><button onClick={() => {}} className="hover:text-white transition-colors">Security Audit</button></li>
                 <li><button onClick={() => {}} className="hover:text-white transition-colors">Privacy Charter</button></li>
                 <li><button onClick={() => {}} className="hover:text-white transition-colors">Status Feed</button></li>
              </ul>
           </div>
           <div>
              <h5 className="text-white font-black text-[10px] uppercase tracking-widest mb-6">Connect</h5>
              <ul className="space-y-4 text-slate-500 text-sm font-bold">
                 <li><button onClick={() => {}} className="hover:text-white transition-colors">Technical Support</button></li>
                 <li><button onClick={() => {}} className="hover:text-white transition-colors">Enterprise Access</button></li>
                 <li><button onClick={() => {}} className="hover:text-white transition-colors">API Endpoint</button></li>
              </ul>
           </div>
        </div>
        <div className="max-w-7xl mx-auto mt-24 pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 text-center">
           <p className="text-[10px] font-black text-slate-800 uppercase tracking-[0.5em]">
             © 2025 HireMax • Deterministic Evaluation System
           </p>
           <div className="flex gap-8">
              {['Terms', 'Privacy', 'Security'].map(item => (
                <button key={item} className="text-[10px] font-black text-slate-800 uppercase tracking-widest hover:text-white transition-colors">
                  {item}
                </button>
              ))}
           </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
