
import React, { useState, useEffect } from 'react';
import { Check, Lock, ShieldCheck, ArrowRight, Zap, Info, X, Sparkles, ChevronDown } from 'lucide-react';
import { UserPlan, AppView } from '../types';
import { isDisposableOrInvalid } from '../lib/emailValidator';

interface PricingProps {
  setPlan: (p: UserPlan) => void;
  setView: (v: AppView) => void;
  currentPlan: UserPlan;
  user?: any;
}

interface PlanCardProps {
  plan: any;
  currentPlan: UserPlan;
  onSelect: (p: UserPlan) => void;
  isEliteAnimating: boolean;
  animationComplete: boolean;
}

const PlanCard: React.FC<PlanCardProps> = ({ plan, currentPlan, onSelect, isEliteAnimating, animationComplete }) => {
  const [showAllFeatures, setShowAllFeatures] = useState(false);
  const isCurrent = currentPlan === plan.id;
  const isElite = plan.id === 'Career Elite';
  const isElite6M = plan.id === 'Career Elite 6M';
  const isPro = plan.id === 'Career Pro';

  const visibleBullets = showAllFeatures ? plan.bullets : plan.bullets.slice(0, 5);
  const hasMore = plan.bullets.length > 5;

  return (
    <div 
      className={`p-10 rounded-[2.5rem] border flex flex-col transition-all relative h-full ${
        isElite || isElite6M
          ? 'bg-[#12121A] border-blue-500/50 shadow-2xl shadow-blue-500/10' 
          : 'bg-[#161B2E] border-[#2D313D]'
      }`}
    >
      {/* Introductory Pricing Badge */}
      {(isPro || isElite) && (
        <div className="absolute -top-3 left-8 group">
          <div className="bg-[#1A1D26] border border-[#2D313D] text-blue-400 text-[9px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full flex items-center gap-2 cursor-help shadow-lg">
            <Info size={10} />
            Introductory pricing applied
          </div>
          <div className="absolute left-0 bottom-full mb-2 w-48 p-3 bg-[#0B0F1A] border border-[#2D313D] rounded-xl text-[10px] text-slate-400 font-bold leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-2xl z-20">
            Prices will increase as features expand.
          </div>
        </div>
      )}

      <div className="mb-8">
        <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-4 ${isElite || isElite6M ? 'text-blue-500' : 'text-slate-500'}`}>{plan.label}</h3>
        
        {isElite ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline gap-3">
              <div className="relative">
                <span className={`text-2xl font-black transition-opacity duration-500 ${isEliteAnimating ? 'opacity-40 text-slate-500' : 'opacity-100 text-slate-500'}`}>$59</span>
                <div className={`absolute top-1/2 left-0 h-[1px] bg-blue-500 transition-all duration-[400ms] ease-out ${isEliteAnimating ? 'w-full' : 'w-0'}`} />
              </div>
              <span className={`text-5xl font-black text-white transition-all duration-500 ${isEliteAnimating ? 'contrast-[1.25] font-black' : 'contrast-100'}`}>$49</span>
              <span className="text-[12px] font-black text-slate-300 uppercase tracking-widest">{plan.subLabel}</span>
            </div>
            
            {animationComplete && (
              <div className="mt-3 animate-in fade-in duration-700 fill-mode-both group relative inline-block w-fit">
                <div className="border border-blue-500/30 text-blue-400 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest cursor-help">
                  18% window advantage
                </div>
                <div className="absolute left-0 top-full mt-2 w-48 p-3 bg-[#0B0F1A] border border-[#2D313D] rounded-xl text-[10px] text-slate-400 font-bold leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-2xl z-20">
                  Introductory pricing during current hiring volatility.
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black text-white">{plan.price}</span>
              <span className="text-[12px] font-black text-slate-300 uppercase tracking-widest">{plan.subLabel}</span>
            </div>
            {plan.priceComparison && (
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                {plan.priceComparison}
              </p>
            )}
          </div>
        )}
        
        <p className="text-slate-400 text-sm font-bold mt-4 leading-tight min-h-[40px]">{plan.valueStatement}</p>
      </div>

      <div className="flex-1 space-y-4 mb-8">
        {visibleBullets.map((bullet: string, i: number) => (
          <div key={i} className="flex items-start gap-3">
            <Check size={16} className="text-blue-500 shrink-0 mt-0.5" />
            <span className="text-white font-bold text-sm tracking-tight leading-snug">{bullet}</span>
          </div>
        ))}
        {hasMore && (
          <button 
            onClick={() => setShowAllFeatures(!showAllFeatures)}
            className="text-[10px] font-black text-slate-500 hover:text-white transition-colors uppercase tracking-widest flex items-center gap-1 mt-2"
          >
            {showAllFeatures ? 'View less' : 'View full details'} <ChevronDown size={10} className={`transition-transform ${showAllFeatures ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {plan.note && (
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-6 text-center">{plan.note}</p>
      )}

      <div className="mt-auto">
        {isElite6M && (
          <p className="text-center text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">
            Recommended for long-term planning
          </p>
        )}
        <button
          disabled={isCurrent}
          onClick={() => onSelect(plan.id)}
          className={`w-full py-5 rounded-2xl text-sm font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${
            isCurrent
              ? 'bg-slate-800 text-slate-600 cursor-default'
              : isElite
                ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-xl shadow-blue-900/20'
                : isElite6M
                  ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg'
                  : 'bg-white text-black hover:bg-slate-200 shadow-lg'
          }`}
        >
          {isCurrent ? 'Current Plan' : plan.buttonText}
          {!isCurrent && <ArrowRight size={18} />}
        </button>
        {plan.buttonSubtext && (
          <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-4">
            {plan.buttonSubtext}
          </p>
        )}
      </div>
    </div>
  );
};

export const Pricing: React.FC<PricingProps> = ({ setPlan, setView, currentPlan, user }) => {
  const [isEliteAnimating, setIsEliteAnimating] = useState(false);
  const [animationComplete, setAnimationComplete] = useState(false);
  const [showRecommendation, setShowRecommendation] = useState(false);

  useEffect(() => {
    const animTimer = setTimeout(() => {
      setIsEliteAnimating(true);
      setTimeout(() => setAnimationComplete(true), 400);
    }, 1000);

    const recTimer = setTimeout(() => {
      if (!sessionStorage.getItem('pricing_recommendation_dismissed')) {
        setShowRecommendation(true);
      }
    }, 7000);

    const scrollHandler = () => {
      if (window.scrollY > 500 && !sessionStorage.getItem('pricing_recommendation_dismissed')) {
        setShowRecommendation(true);
      }
    };
    window.addEventListener('scroll', scrollHandler);

    return () => {
      clearTimeout(animTimer);
      clearTimeout(recTimer);
      window.removeEventListener('scroll', scrollHandler);
    };
  }, []);

  const handleDismissRecommendation = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowRecommendation(false);
    sessionStorage.setItem('pricing_recommendation_dismissed', 'true');
  };

  const handleSelect = (id: any) => {
    if (id === 'Starter') {
      setPlan('Starter');
      setView('dashboard');
      return;
    }

    if (!user) {
      setView('auth');
      return;
    }

    // Secure payment gateway: prevent users with unverified/disposable/fake emails from paying
    const emailCheck = isDisposableOrInvalid(user.email);
    if (!emailCheck.valid) {
      alert(`Account Verification Required:\n\n${emailCheck.reason}\n\nPlease update your profile email to a permanent, valid address in settings before proceeding to purchase.`);
      setView('settings');
      return;
    }

    let checkoutLink = '';
    if (id === 'Career Pro') {
      checkoutLink = import.meta.env.VITE_DODO_PAYMENTS_PRO_LINK || 'https://checkout.dodopayments.com/buy/product_placeholder_pro';
    } else if (id === 'Career Elite') {
      checkoutLink = import.meta.env.VITE_DODO_PAYMENTS_ELITE_LINK || 'https://checkout.dodopayments.com/buy/product_placeholder_elite';
    } else if (id === 'Career Elite 6M') {
      checkoutLink = import.meta.env.VITE_DODO_PAYMENTS_ELITE_6M_LINK || 'https://checkout.dodopayments.com/buy/product_placeholder_elite_6m';
    }

    if (checkoutLink) {
      try {
        const url = new URL(checkoutLink);
        url.searchParams.set('metadata_user_id', user.id);
        url.searchParams.set('metadata_plan', id);
        url.searchParams.set('metadata_email', user.email);
        // After payment, Dodo redirects user back to /dashboard
        // This is the success redirect URL — user lands logged-in on dashboard
        url.searchParams.set('redirect_url', `${window.location.origin}/dashboard`);
        
        window.location.href = url.toString();
      } catch (err) {
        console.error('Failed to construct checkout URL:', err);
        alert('Payment redirect failed. Please try again or contact support.');
      }
    }
  };

  const plans = [
    {
      id: 'Starter',
      label: 'Free',
      price: '$0',
      subLabel: '',
      valueStatement: 'Understand why you’re getting rejected.',
      bullets: [
        'AI Resume Diagnostic Score',
        'Basic Application Tracker',
        'Standard Cover Letter Generator'
      ],
      buttonText: 'Current Plan'
    },
    {
      id: 'Career Pro',
      label: 'Career Pro',
      price: '$29',
      subLabel: 'per month',
      valueStatement: 'Fix your resume and ace the interview.',
      bullets: [
        'Unlimited AI Resume Rebuilds',
        'Custom Interview Prep Kits',
        'Evidence-traced Cover Letters',
        'Clean exports (no watermark)',
        'Role-specific improvements'
      ],
      buttonText: 'Upgrade to Pro'
    },
    {
      id: 'Career Elite',
      label: 'Career Elite',
      price: '$49',
      subLabel: 'per month',
      valueStatement: 'The complete Career OS to land offers faster.',
      bullets: [
        'Everything in Pro',
        'LinkedIn Optimizer (Boolean search rank)',
        'Market Intelligence (Salary & Trends)',
        'AI Follow-up Emails in Tracker',
        'Priority AI processing'
      ],
      buttonText: 'Upgrade to Elite'
    },
    {
      id: 'Career Elite 6M',
      label: 'Career Elite — 6 Month Access',
      price: '$149',
      subLabel: 'one-time',
      priceComparison: 'Equivalent to ~$25/month over 6 months',
      valueStatement: 'Covers the full hiring cycle with ongoing market and role updates.',
      bullets: [
        'Everything in Career Elite',
        'Continuous Market Intelligence',
        'Skill demand monitoring',
        'Priority AI processing',
        'Hiring trend updates'
      ],
      buttonText: 'Get 6-Month Elite Access',
      buttonSubtext: 'Best value for long-term job searches'
    }
  ];

  const getMissingFeatures = () => {
    switch (currentPlan) {
      case 'Starter':
        return [
          'Role-specific skill gap analysis',
          'Clear reason for rejection (data-driven)',
          'Automated resume re-architecting'
        ];
      case 'Career Pro':
        return [
          'Hiring signals before roles go public',
          'Role saturation & timing guidance',
          'Market Outlook intelligence'
        ];
      default:
        return [];
    }
  };

  const missing = getMissingFeatures();

  return (
    <div className="max-w-[1400px] mx-auto py-24 px-10 animate-in fade-in duration-500 relative">
      <div className="mb-20">
        <h2 className="text-6xl font-black text-white tracking-tighter uppercase mb-4 leading-none">Upgrade Access</h2>
        <p className="text-slate-500 text-xl font-medium max-w-2xl">Professional intelligence to fix your resume and bridge your skill gaps.</p>
      </div>

      {/* SECTION 1 — PLAN CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-24 items-stretch">
        {plans.map((p) => (
          <PlanCard 
            key={p.id} 
            plan={p} 
            currentPlan={currentPlan} 
            onSelect={handleSelect} 
            isEliteAnimating={isEliteAnimating && p.id === 'Career Elite'}
            animationComplete={animationComplete && p.id === 'Career Elite'}
          />
        ))}
      </div>

      {/* SECTION 2 — VALUE LADDER */}
      <div className="mb-24">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-12 text-center">What each level helps you do</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 max-w-5xl mx-auto">
          <div className="text-center space-y-4">
            <p className="text-white font-black text-xl uppercase tracking-tighter">Free</p>
            <p className="text-slate-300 text-[11px] font-black uppercase tracking-widest">See what’s wrong</p>
          </div>
          <div className="text-center space-y-4 opacity-40">
            <p className="text-blue-500 font-black text-xl uppercase tracking-tighter">Verdict</p>
            <p className="text-slate-300 text-[11px] font-black uppercase tracking-widest">Quick Audit</p>
          </div>
          <div className="text-center space-y-4">
            <p className="text-white font-black text-xl uppercase tracking-tighter">Pro</p>
            <p className="text-slate-300 text-[11px] font-black uppercase tracking-widest">Fix resume & skill gaps</p>
          </div>
          <div className="text-center space-y-4">
            <p className="text-indigo-400 font-black text-xl uppercase tracking-tighter">Elite</p>
            <p className="text-slate-300 text-[11px] font-black uppercase tracking-widest">Apply smarter, not blindly</p>
          </div>
        </div>
      </div>

      {/* SECTION 3 — WHAT YOU ARE MISSING */}
      {missing.length > 0 && (
        <div className="bg-[#1A1D26] border border-[#2D313D] rounded-[3rem] p-16 flex flex-col md:flex-row items-center justify-between gap-12 shadow-2xl">
          <div className="space-y-4 text-center md:text-left">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.4em]">You don’t have access to</h3>
            <h4 className="text-4xl font-black text-white tracking-tighter uppercase leading-none">Unlock Strategic Advantage</h4>
          </div>
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
            {missing.map((item, i) => (
              <div key={i} className="flex items-center gap-4 group">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-[#2D313D] flex items-center justify-center text-slate-600 group-hover:text-blue-500 transition-colors">
                  <Lock size={18} />
                </div>
                <span className="text-white font-bold text-lg tracking-tight">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MARKET HIRING PATTERN WIDGET (CENTER-BOTTOM) */}
      {showRecommendation && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[440px] max-w-[90vw] bg-[#16161E] border border-[#2D313D] rounded-[2rem] p-8 shadow-2xl animate-in slide-in-from-bottom-8 duration-500 z-[150] ring-1 ring-white/5">
          <div className="flex justify-between items-start mb-4">
            <h4 className="text-white font-black text-xl uppercase tracking-tighter leading-tight">Market hiring patterns are changing</h4>
            <button onClick={handleDismissRecommendation} className="text-slate-500 hover:text-white transition-colors p-1 bg-white/5 rounded-lg">
              <X size={18} />
            </button>
          </div>
          <p className="text-slate-200 text-base font-medium leading-relaxed mb-8">
            Roles, skill requirements, and hiring timelines shift quickly. Higher plans help you stay updated and avoid applying blindly.
          </p>
          <div className="flex justify-end">
            <button 
              onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setShowRecommendation(false); }}
              className="text-xs font-black uppercase tracking-widest text-blue-500 hover:text-white transition-colors flex items-center gap-2 px-4 py-2 bg-blue-500/5 rounded-xl border border-blue-500/20"
            >
              View Elite access <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* INSTANT DELIVERY + COMPLIANCE NOTE */}
      <div className="mt-20 mb-8 bg-[#0D1117] border border-[#2D313D] rounded-2xl px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <p className="text-emerald-400 text-[11px] font-black uppercase tracking-widest">
            Digital delivery is instantaneous upon successful payment verification
          </p>
        </div>
        <p className="text-slate-400 text-[11px] font-medium text-center sm:text-right">
          Questions? <a href="mailto:support@hiremax.ai" className="text-blue-400 hover:text-blue-300 underline">support@hiremax.ai</a>
        </p>
      </div>

      <div className="mt-8 text-center pb-12">
         <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.8em]">HireMax Career Intelligence Platform</p>
      </div>
    </div>
  );
};
