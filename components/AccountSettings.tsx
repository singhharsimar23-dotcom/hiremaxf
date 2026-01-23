
import React, { useState } from 'react';
import { Settings, User, Mail, Lock, Bell, Shield, ArrowRight, Save, CheckCircle2 } from 'lucide-react';
import { UserPlan } from '../types';

interface AccountSettingsProps {
  plan: UserPlan;
}

export const AccountSettings: React.FC<AccountSettingsProps> = ({ plan }) => {
  const [saved, setSaved] = useState(false);
  
  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto py-16 px-10">
      <div className="mb-16">
        <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">Account Settings</h2>
        <p className="text-slate-500 font-medium">Manage your personal profile and application preferences.</p>
      </div>

      <div className="space-y-10">
        <section className="bg-[#16161E] border border-[#1D1D26] rounded-[2.5rem] p-10">
          <div className="flex items-center gap-3 mb-8 border-b border-white/5 pb-4">
            <User className="text-blue-500" size={20} />
            <h3 className="text-white font-bold text-lg">Personal Information</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="input-label">Full Name</label>
              <input defaultValue="John Doe" className="w-full bg-[#0D0D12] border border-[#1D1D26] rounded-xl p-4 text-white focus:border-blue-500 outline-none transition-all" />
            </div>
            <div className="space-y-2">
              <label className="input-label">Email Address</label>
              <input readOnly defaultValue="john.doe@example.com" className="w-full bg-[#0D0D12] border border-[#1D1D26] rounded-xl p-4 text-slate-500 cursor-not-allowed outline-none" />
              <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mt-1">Contact support to change email</p>
            </div>
          </div>
        </section>

        <section className="bg-[#16161E] border border-[#1D1D26] rounded-[2.5rem] p-10">
          <div className="flex items-center gap-3 mb-8 border-b border-white/5 pb-4">
            <Shield className="text-indigo-500" size={20} />
            <h3 className="text-white font-bold text-lg">Preferences</h3>
          </div>
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-bold text-sm">Default Role Focus</p>
                <p className="text-slate-500 text-xs font-medium">Used to prioritize signals during analysis.</p>
              </div>
              <input placeholder="e.g. Backend Engineer" className="bg-[#0D0D12] border border-[#1D1D26] rounded-lg px-4 py-2 text-white text-sm focus:border-blue-500 outline-none" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-bold text-sm">Email Notifications</p>
                <p className="text-slate-500 text-xs font-medium">Receive weekly market signal updates.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </section>

        <section className="bg-[#16161E] border border-[#1D1D26] rounded-[2.5rem] p-10">
          <div className="flex items-center gap-3 mb-8 border-b border-white/5 pb-4">
            <Lock className="text-amber-500" size={20} />
            <h3 className="text-white font-bold text-lg">Security</h3>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <p className="text-slate-400 text-sm font-medium">Keep your account secure with a strong password.</p>
            <button className="whitespace-nowrap bg-[#1A1D26] border border-[#1D1D26] text-white px-8 py-3 rounded-xl font-bold text-xs hover:border-white transition-all">
              Change Password
            </button>
          </div>
        </section>

        <div className="flex justify-end items-center gap-6">
          {saved && (
            <div className="flex items-center gap-2 text-green-500 font-bold text-xs uppercase tracking-widest animate-in fade-in duration-300">
              <CheckCircle2 size={16} /> Changes Saved
            </div>
          )}
          <button 
            onClick={handleSave}
            className="bg-blue-600 hover:bg-blue-500 text-white font-black py-4 px-12 rounded-2xl transition-all uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-blue-900/20 flex items-center gap-3"
          >
            Save Account Data <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
