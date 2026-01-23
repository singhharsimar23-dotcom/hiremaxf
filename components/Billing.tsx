
import React from 'react';
import { CreditCard, Zap, ShieldCheck, ArrowRight, XCircle, Clock, History } from 'lucide-react';
import { UserPlan, AppView } from '../types';

interface BillingProps {
  plan: UserPlan;
  setView: (v: AppView) => void;
}

export const Billing: React.FC<BillingProps> = ({ plan, setView }) => {
  const isStarter = plan === 'Starter';

  return (
    <div className="max-w-5xl mx-auto py-16 px-10">
      <div className="mb-16">
        <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">Subscription & Billing</h2>
        <p className="text-slate-500 font-medium">Manage your plan, rebuild credits, and payment history.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-16">
        <div className="md:col-span-2 space-y-10">
          <section className="bg-[#16161E] border border-[#1D1D26] rounded-[2.5rem] p-10 shadow-xl relative overflow-hidden">
            <div className="flex justify-between items-start relative z-10">
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Current Active Plan</p>
                  <h3 className="text-3xl font-black text-white uppercase tracking-tight">{plan}</h3>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-slate-400 font-medium text-sm">Status: <span className="text-green-400">Active</span></span>
                  <span className="text-slate-400 font-medium text-sm">Next billing: <span className="text-white">Oct 12, 2025</span></span>
                </div>
              </div>
              {!isStarter && (
                <button className="text-slate-500 hover:text-red-500 transition-all font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                  <XCircle size={14} /> Cancel Subscription
                </button>
              )}
            </div>
            <div className="mt-10 pt-10 border-t border-white/5 relative z-10">
              <button 
                onClick={() => setView('pricing')}
                className="bg-blue-600 hover:bg-blue-500 text-white font-black py-4 px-10 rounded-2xl transition-all uppercase tracking-widest text-[10px] shadow-lg shadow-blue-900/20"
              >
                Change or Upgrade Plan
              </button>
            </div>
            <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
              <ShieldCheck size={200} />
            </div>
          </section>

          <section className="bg-[#16161E] border border-[#1D1D26] rounded-[2.5rem] p-10 shadow-xl">
             <div className="flex items-center gap-3 mb-8 border-b border-white/5 pb-4">
                <History className="text-slate-500" size={20} />
                <h3 className="text-white font-bold text-lg">Payment History</h3>
             </div>
             <div className="space-y-4">
                {[
                  { date: 'Sep 12, 2025', amount: '$19.00', status: 'Paid', plan: 'Career Pro' },
                  { date: 'Aug 12, 2025', amount: '$19.00', status: 'Paid', plan: 'Career Pro' },
                ].map((inv, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-[#0D0D12] rounded-2xl border border-[#1D1D26]">
                    <div className="flex items-center gap-6">
                       <p className="text-white font-bold text-sm">{inv.date}</p>
                       <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{inv.plan}</p>
                    </div>
                    <div className="flex items-center gap-6">
                       <p className="text-white font-black">{inv.amount}</p>
                       <span className="text-green-500 font-bold text-[10px] uppercase tracking-widest">{inv.status}</span>
                    </div>
                  </div>
                ))}
                {isStarter && (
                  <div className="py-10 text-center opacity-30">
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">No transaction records found</p>
                  </div>
                )}
             </div>
          </section>
        </div>

        <div className="space-y-10">
          <section className="bg-[#16161E] border border-[#1D1D26] rounded-[2.5rem] p-10 shadow-xl flex flex-col">
            <div className="flex items-center gap-3 mb-8">
               <Zap className="text-amber-500" size={24} />
               <h3 className="text-white font-bold text-lg">Credits</h3>
            </div>
            <div className="flex-1 space-y-6">
               <div className="text-center p-8 bg-amber-500/5 border border-amber-500/10 rounded-3xl">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Rebuild Bundle</p>
                  <p className="text-5xl font-black text-white">0</p>
               </div>
               <p className="text-slate-500 text-[11px] leading-relaxed font-medium">
                  Rebuild bundles are for one-time tailored optimizations. Upgrade to Pro for unlimited access.
               </p>
            </div>
            <button 
              onClick={() => setView('rebuild-standalone')}
              className="mt-10 w-full bg-white text-black font-black py-4 rounded-2xl transition-all uppercase tracking-widest text-[10px]"
            >
              Get Credits
            </button>
          </section>

          <section className="p-8 border border-[#2D313D] border-dashed rounded-[2.5rem]">
             <p className="text-slate-500 text-[11px] font-medium leading-relaxed">
                HireMax uses industry-standard encryption for all transactions. Your payment information is never stored on our servers.
             </p>
          </section>
        </div>
      </div>
    </div>
  );
};
