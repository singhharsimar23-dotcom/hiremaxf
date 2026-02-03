
import React, { useState, useRef, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Search, 
  Grid, 
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
  Radio,
  Factory
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
    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-300 font-bold text-sm whitespace-nowrap relative group ${
      active 
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
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isPro = plan === 'Career Pro' || plan === 'Career Elite';
  const isElite = plan === 'Career Elite';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-20 bg-[#0F1117] border-b border-[#2D313D] px-8 flex items-center justify-between z-[100] shadow-xl">
      <div className="flex items-center gap-6 lg:gap-8">
        <div 
          className="flex items-center gap-3 cursor-pointer group shrink-0" 
          onClick={() => setView('dashboard')}
        >
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-105">
            <Shield className="text-black" size={24} />
          </div>
          <h1 className="text-white font-extrabold text-xl tracking-tight hidden sm:block">HireMax</h1>
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto custom-scrollbar pr-4">
          <NavLink 
            label="Dashboard" 
            active={currentView === 'dashboard'} 
            onClick={() => setView('dashboard')} 
            icon={<LayoutDashboard size={18} className="opacity-70" />}
          />
          
          <NavLink 
            label="Factory" 
            active={currentView === 'transformation-factory'} 
            onClick={() => setView('transformation-factory')} 
            icon={<Factory size={18} className={`opacity-70 ${isElite ? 'text-blue-500' : 'text-slate-600'}`} />}
            isLocked={!isElite}
          />

          <NavLink 
            label="Intelligence" 
            active={currentView === 'full-review'} 
            onClick={() => setView('full-review')} 
            icon={<ShieldCheck size={18} className={`opacity-70 ${isPro ? 'text-amber-500' : 'text-slate-600'}`} />}
            isLocked={!isPro}
          />

          <NavLink 
            label="Outlook" 
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
            label="Templates" 
            active={currentView === 'templates'} 
            onClick={() => setView('templates')} 
            icon={<Grid size={18} className="opacity-70" />}
          />
        </nav>
      </div>

      <div className="flex items-center gap-3 relative shrink-0" ref={dropdownRef}>
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
            
            <div className="h-[1px] bg-[#2D313D] my-2 mx-3 md:hidden" />
            <button 
              onClick={() => { onNewResume(); setDropdownOpen(false); }}
              className="md:hidden w-full flex items-center gap-3 px-5 py-3 text-slate-400 hover:text-white hover:bg-white/5 transition-all text-sm font-bold"
            >
              <Plus size={18} />
              New Resume
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
    </header>
  );
};

export default Header;
