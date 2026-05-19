import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  LayoutDashboard,
  Search,
  Plus,
  User,
  Shield,
  History,
  Sparkles,
  ChevronDown,
  Settings,
  CreditCard,
  LogOut,
  HelpCircle,
  Mail,
  Zap,
  ShieldCheck,
  TrendingUp,
  Lock,
  Activity,
  Menu,
  X,
  Eye,
  Briefcase,
  MessageSquare,
  FileSearch
} from 'lucide-react';
import { AppView, UserPlan } from '../types';

interface HeaderProps {
  currentView: AppView;
  setView: (v: AppView) => void;
  plan: UserPlan;
  onNewResume: () => void;
}

const NavLink: React.FC<{
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  isLocked?: boolean;
}> = ({ label, active, onClick, icon, isLocked }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-300 font-bold text-sm whitespace-nowrap relative group ${active
      ? 'text-white bg-white/5'
      : 'text-slate-400 hover:text-white hover:bg-white/5'
      }`}
  >
    {icon}
    {label}
    {isLocked && (
      <div className="flex items-center justify-center w-4 h-4 rounded-full bg-amber-500/10 border border-amber-500/20 ml-1">
        <Lock size={8} className="text-amber-500" />
      </div>
    )}
  </button>
);

const Header: React.FC<HeaderProps> = ({ currentView, setView, plan, onNewResume }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isPro = plan === 'Career Pro' || plan === 'Career Elite' || plan === 'Automation';
  const isElite = plan === 'Career Elite' || plan === 'Automation';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/';
    } catch (error) {
      console.error("Sign out failed:", error);
      // Fallback
      window.location.reload();
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-20 bg-[#0F1117] border-b border-[#2D313D] px-8 flex items-center justify-between z-[100] shadow-xl">
      <div className="flex items-center gap-6 lg:gap-8">
        <div
          className="flex items-center gap-3 cursor-pointer group shrink-0"
          onClick={() => setView('dashboard')}
        >
          <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shadow-lg transition-transform group-hover:scale-105 border border-[#2D313D] bg-[#0E1118]">
            <img src="/favicon.png" alt="HireMax Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-white font-extrabold text-xl tracking-tight hidden sm:block">HireMax</h1>
        </div>

        <nav className="hidden lg:flex items-center gap-1 overflow-x-auto custom-scrollbar pr-4">
          <NavLink
            label="Dashboard"
            active={currentView === 'dashboard'}
            onClick={() => setView('dashboard')}
            icon={<LayoutDashboard size={18} className="opacity-70" />}
          />

          {/* Hiding Profile option from top bar as per user request (don't delete)
          <NavLink
            label="Profile"
            active={currentView === 'profile'}
            onClick={() => setView('profile')}
            icon={<User size={18} className="opacity-70" />}
          />
          */}


          <NavLink
            label="Intelligence"
            active={currentView === 'full-review'}
            onClick={() => setView('full-review')}
            icon={<ShieldCheck size={18} className={`opacity-70 ${isPro ? 'text-amber-500' : 'text-slate-600'}`} />}
            isLocked={!isPro}
          />

          <NavLink
            label="Market Insights"
            active={currentView === 'career-intelligence'}
            onClick={() => setView('career-intelligence')}
            icon={<TrendingUp size={18} className={`opacity-70 ${isElite ? 'text-indigo-400' : 'text-slate-600'}`} />}
            isLocked={!isElite}
          />

          <NavLink
            label="Rebuild"
            active={currentView === 'rebuild-standalone'}
            onClick={() => setView('rebuild-standalone')}
            icon={<Sparkles size={18} className={`opacity-70 ${isPro ? 'text-blue-500' : 'text-slate-600'}`} />}
            isLocked={!isPro}
          />

          <NavLink
            label="Interview Prep"
            active={currentView === 'interview-prep'}
            onClick={() => setView('interview-prep')}
            icon={<MessageSquare size={18} className={`opacity-70 ${isPro ? 'text-violet-400' : 'text-slate-600'}`} />}
            isLocked={!isPro}
          />

          <NavLink
            label="Cover Letter"
            active={currentView === 'cover-letter'}
            onClick={() => setView('cover-letter')}
            icon={<FileSearch size={18} className={`opacity-70 ${isPro ? 'text-emerald-400' : 'text-slate-600'}`} />}
            isLocked={!isPro}
          />

          <NavLink
            label="Tracker"
            active={currentView === 'tracker'}
            onClick={() => setView('tracker')}
            icon={<Briefcase size={18} className="opacity-70 text-slate-400" />}
          />

          <NavLink
            label="LinkedIn"
            active={currentView === 'linkedin-optimizer'}
            onClick={() => setView('linkedin-optimizer')}
            icon={<Activity size={18} className={`opacity-70 ${isPro ? 'text-sky-400' : 'text-slate-600'}`} />}
            isLocked={!isPro}
          />
        </nav>
      </div>

      <div className="flex items-center gap-3 relative shrink-0">
        {/* Mobile Menu Toggle */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="xl:hidden p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        <button
          onClick={onNewResume}
          className="hidden md:flex items-center gap-2 bg-[#1A1D26] hover:bg-[#252833] text-white px-5 py-2.5 rounded-xl font-bold text-sm border border-[#2D313D] transition-all"
        >
          <Plus size={18} className="text-blue-500" />
          New Resume
        </button>

        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border border-[#2D313D] transition-all hover:bg-white/5 ${dropdownOpen ? 'text-white bg-white/10' : 'text-slate-400 hover:text-white'}`}
        >
          <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-500">
            <User size={18} />
          </div>
          <ChevronDown size={14} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
        </button>
        {dropdownOpen && (
          <div className="absolute top-full right-0 mt-3 w-64 bg-[#1A1D26] border border-[#2D313D] rounded-2xl shadow-2xl py-3 z-[110] animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="px-5 py-3 border-b border-[#2D313D] mb-2">
              <p className="text-white font-bold text-sm truncate">User Account</p>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{plan} Plan</p>
            </div>

            <button
              onClick={() => { setView('settings'); setDropdownOpen(false); }}
              className="w-full flex items-center gap-3 px-5 py-3 text-slate-400 hover:text-white hover:bg-white/5 transition-all text-sm font-bold"
            >
              <Settings size={18} />
              Settings
            </button>
            <button
              onClick={() => { setView('history'); setDropdownOpen(false); }}
              className="w-full flex items-center gap-3 px-5 py-3 text-slate-400 hover:text-white hover:bg-white/5 transition-all text-sm font-bold"
            >
              <History size={18} />
              Resume History
            </button>
            <button
              onClick={() => { setView('billing'); setDropdownOpen(false); }}
              className="w-full flex items-center gap-3 px-5 py-3 text-slate-400 hover:text-white hover:bg-white/5 transition-all text-sm font-bold"
            >
              <CreditCard size={18} />
              Billing
            </button>
            <button
              onClick={() => { setView('pricing'); setDropdownOpen(false); }}
              className="w-full flex items-center gap-3 px-5 py-3 text-blue-400 hover:text-blue-300 hover:bg-blue-500/5 transition-all text-sm font-bold"
            >
              <Zap size={18} />
              Upgrade Plan
            </button>

            <div className="h-[1px] bg-[#2D313D] my-2 mx-3" />

            <button
              onClick={() => { setView('faq'); setDropdownOpen(false); }}
              className="w-full flex items-center gap-3 px-5 py-3 text-slate-400 hover:text-white hover:bg-white/5 transition-all text-sm font-bold"
            >
              <HelpCircle size={18} />
              FAQ
            </button>
            <button
              onClick={() => { setView('contact'); setDropdownOpen(false); }}
              className="w-full flex items-center gap-3 px-5 py-3 text-slate-400 hover:text-white hover:bg-white/5 transition-all text-sm font-bold"
            >
              <Mail size={18} />
              Contact Support
            </button>

            <div className="h-[1px] bg-[#2D313D] my-2 mx-3" />

            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-5 py-3 text-red-500 hover:text-red-400 hover:bg-red-500/5 transition-all text-sm font-bold"
            >
              <LogOut size={18} />
              Sign Out
            </button>
          </div>
        )}
      </div>

      {/* Mobile Sidebar Navigation */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[150] xl:hidden animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute top-0 right-0 w-80 h-full bg-[#0F1117] border-l border-[#2D313D] p-6 shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
            <div className="flex items-center justify-between mb-10">
              <h2 className="text-white font-black uppercase tracking-widest text-sm">Navigation</h2>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-slate-500 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <NavLink label="Dashboard" active={currentView === 'dashboard'} onClick={() => { setView('dashboard'); setMobileMenuOpen(false); }} icon={<LayoutDashboard size={18} />} />
              {/* Hiding Profile option from mobile sidebar as per user request (don't delete)
              <NavLink label="Profile" active={currentView === 'profile'} onClick={() => { setView('profile'); setMobileMenuOpen(false); }} icon={<User size={18} />} />
              */}
              <div className="h-[1px] bg-white/5 my-2" />
              <NavLink label="Intelligence" active={currentView === 'full-review'} onClick={() => { setView('full-review'); setMobileMenuOpen(false); }} icon={<ShieldCheck size={18} />} isLocked={!isPro} />
              <NavLink label="Market Insights" active={currentView === 'career-intelligence'} onClick={() => { setView('career-intelligence'); setMobileMenuOpen(false); }} icon={<TrendingUp size={18} />} isLocked={!isElite} />
              <NavLink label="Rebuild" active={currentView === 'rebuild-standalone'} onClick={() => { setView('rebuild-standalone'); setMobileMenuOpen(false); }} icon={<Sparkles size={18} />} isLocked={!isPro} />
              <NavLink label="Interview Prep" active={currentView === 'interview-prep'} onClick={() => { setView('interview-prep'); setMobileMenuOpen(false); }} icon={<MessageSquare size={18} />} isLocked={!isPro} />
              <NavLink label="Cover Letter" active={currentView === 'cover-letter'} onClick={() => { setView('cover-letter'); setMobileMenuOpen(false); }} icon={<FileSearch size={18} />} isLocked={!isPro} />
              <NavLink label="Tracker" active={currentView === 'tracker'} onClick={() => { setView('tracker'); setMobileMenuOpen(false); }} icon={<Briefcase size={18} />} />
              <NavLink label="LinkedIn" active={currentView === 'linkedin-optimizer'} onClick={() => { setView('linkedin-optimizer'); setMobileMenuOpen(false); }} icon={<Activity size={18} />} isLocked={!isPro} />
            </div>

            <div className="mt-auto pt-10 border-t border-[#2D313D]">
              <button
                onClick={() => { onNewResume(); setMobileMenuOpen(false); }}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-4 rounded-xl font-bold text-sm shadow-xl transition-all mb-4"
              >
                <Plus size={18} />
                New Resume
              </button>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 text-red-500 bg-red-500/5 hover:bg-red-500/10 px-5 py-4 rounded-xl font-bold text-sm transition-all"
              >
                <LogOut size={18} />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
