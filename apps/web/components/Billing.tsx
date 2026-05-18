
import React, { useState } from 'react';
import { CreditCard, ShieldCheck, XCircle, History, CheckCircle2, Zap, Star, ArrowRight, Mail, AlertTriangle, X } from 'lucide-react';
import { UserPlan, AppView } from '../types';

interface BillingProps {
  plan: UserPlan;
  setView: (v: AppView) => void;
}

const PLAN_FEATURES: Record<string, string[]> = {
  Starter: [
    'Resume analysis (up to 3 per month)',
    'ATS compatibility check',
    'Market keyword scan',
    'Application tracker (up to 10 jobs)',
    'Basic report download',
  ],
  'Career Pro': [
    'Unlimited resume analyses',
    'Full ATS scoring + keyword gap analysis',
    'AI-powered resume rebuild',
    'Application tracker (unlimited)',
    'Market intelligence dashboard',
    'Follow-up email generator',
    'Priority email support',
  ],
  Elite: [
    'Everything in Career Pro',
    'Interview prep & mock Q&A',
    'Advanced company signal tracking',
    'Resume version history & comparison',
    'Dedicated support channel',
    'Early access to new features',
  ],
};

const PLAN_PRICE: Record<string, string> = {
  Starter: '$0/mo',
  'Career Pro': '$29/mo',
  Elite: '$49/mo',
};

export const Billing: React.FC<BillingProps> = ({ plan, setView }) => {
  const isStarter = plan === 'Starter';
  const features = PLAN_FEATURES[plan] ?? PLAN_FEATURES['Starter'];
  const price = PLAN_PRICE[plan] ?? '$0/mo';
  const [showCancelModal, setShowCancelModal] = useState(false);

  return (
    <div className="max-w-5xl mx-auto py-16 px-10">

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={() => setShowCancelModal(false)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative bg-[#13131B] border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <AlertTriangle size={18} className="text-red-400" />
                </div>
                <p className="text-white font-black text-lg">Cancel Subscription</p>
              </div>
              <button onClick={() => setShowCancelModal(false)} className="text-slate-600 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="bg-amber-500/8 border border-amber-500/15 rounded-2xl p-4 mb-6">
              <p className="text-amber-300 text-sm leading-relaxed">
                Cancellations are processed manually to ensure your data is handled correctly. Your access continues until the end of your current billing period.
              </p>
            </div>
            <div className="space-y-3 mb-6">
              <p className="text-slate-400 text-sm">To cancel, email us at:</p>
              <a
                href="mailto:hiremax.ai@gmail.com?subject=Cancel%20Subscription&body=Hi%2C%20I%20would%20like%20to%20cancel%20my%20HireMax%20subscription.%20My%20account%20email%20is%3A%20"
                className="flex items-center gap-3 bg-[#0D0D14] border border-white/8 rounded-xl px-4 py-3 text-blue-400 font-bold text-sm hover:border-blue-500/30 transition-colors"
              >
                <Mail size={14} />
                hiremax.ai@gmail.com
              </a>
              <p className="text-slate-600 text-xs">Use subject line: <span className="text-slate-400 font-mono">Cancel Subscription</span></p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/8 text-slate-300 font-bold text-sm rounded-xl transition-all"
              >
                Keep My Plan
              </button>
              <a
                href="mailto:hiremax.ai@gmail.com?subject=Cancel%20Subscription&body=Hi%2C%20I%20would%20like%20to%20cancel%20my%20HireMax%20subscription.%20My%20account%20email%20is%3A%20"
                className="flex-1 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-bold text-sm rounded-xl transition-all text-center"
              >
                Email to Cancel
              </a>
            </div>
          </div>
        </div>
      )}
      <div className="mb-16">
        <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">Subscription & Billing</h2>
        <p className="text-slate-500 font-medium">Manage your subscription plan and billing details.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-16">
        <div className="md:col-span-2 space-y-10">

          {/* Current Plan */}
          <section className="bg-[#16161E] border border-[#1D1D26] rounded-[2.5rem] p-10 shadow-xl relative overflow-hidden">
            <div className="flex justify-between items-start relative z-10">
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Current Active Plan</p>
                  <div className="flex items-baseline gap-3">
                    <h3 className="text-3xl font-black text-white uppercase tracking-tight">{plan}</h3>
                    <span className="text-slate-400 font-bold text-lg">{price}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-green-400 font-bold text-sm">Active</span>
                  </div>
                </div>
              </div>
            {!isStarter && (
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="text-slate-500 hover:text-red-500 transition-all font-bold text-xs uppercase tracking-widest flex items-center gap-2"
                >
                  <XCircle size={14} /> Cancel Subscription
                </button>
              )}
            </div>

            {/* Plan Features */}
            <div className="mt-10 pt-8 border-t border-white/5 relative z-10">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-5">What's included</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {features.map((f, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                    <span className="text-slate-300 text-sm font-medium">{f}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-10 pt-8 border-t border-white/5 relative z-10">
              <button
                onClick={() => setView('pricing')}
                className="bg-blue-600 hover:bg-blue-500 text-white font-black py-4 px-10 rounded-2xl transition-all uppercase tracking-widest text-[10px] shadow-lg shadow-blue-900/20 flex items-center gap-3"
              >
                {isStarter ? 'Upgrade Plan' : 'Change Plan'} <ArrowRight size={14} />
              </button>
            </div>
            <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
              <ShieldCheck size={200} />
            </div>
          </section>

          {/* Payment History */}
          <section className="bg-[#16161E] border border-[#1D1D26] rounded-[2.5rem] p-10 shadow-xl">
            <div className="flex items-center gap-3 mb-8 border-b border-white/5 pb-4">
              <History className="text-slate-500" size={20} />
              <h3 className="text-white font-bold text-lg">Payment History</h3>
            </div>
            <div className="flex flex-col items-center justify-center py-10 text-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/60 flex items-center justify-center">
                <Mail size={22} className="text-slate-500" />
              </div>
              <div>
                <p className="text-white font-bold text-sm mb-1">Payment receipts are sent via email</p>
                <p className="text-slate-500 text-sm font-medium max-w-xs">
                  All invoices and payment confirmations are delivered to your account email from Stripe. Check your inbox for receipts.
                </p>
              </div>
              <a
                href="mailto:hiremax.ai@gmail.com"
                className="text-blue-400 hover:text-blue-300 font-bold text-xs uppercase tracking-widest transition-colors mt-2"
              >
                Contact billing support →
              </a>
            </div>
          </section>
        </div>

        <div className="space-y-10">
          {/* Security note */}
          <section className="bg-[#16161E] border border-[#1D1D26] rounded-[2.5rem] p-8 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <ShieldCheck className="text-emerald-500" size={20} />
              <h3 className="text-white font-bold text-sm">Payment Security</h3>
            </div>
            <div className="space-y-4">
              {[
                '256-bit TLS encryption',
                'PCI-DSS compliant processing',
                'No card data stored on our servers',
                'Instant digital delivery on success',
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                  <span className="text-slate-400 text-xs font-medium">{f}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Support */}
          <section className="p-8 border border-[#2D313D] border-dashed rounded-[2.5rem]">
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">Billing Questions?</p>
            <p className="text-slate-500 text-xs font-medium leading-relaxed mb-4">
              For refunds, billing disputes, or plan changes not available in the UI, contact us directly.
            </p>
            <a
              href="mailto:hiremax.ai@gmail.com"
              className="text-blue-400 hover:text-blue-300 font-bold text-xs uppercase tracking-widest transition-colors"
            >
              hiremax.ai@gmail.com
            </a>
          </section>
        </div>
      </div>
    </div>
  );
};
