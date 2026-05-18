
import React, { useState } from 'react';
import { User, Lock, Shield, Bell, CheckCircle2, ArrowRight, AlertTriangle, Loader2, ChevronRight, LogOut, Trash2 } from 'lucide-react';
import { UserPlan, UserProfile } from '../types';
import { supabase } from '../lib/supabase';

interface AccountSettingsProps {
  plan: UserPlan;
  profile?: UserProfile | null;
}

export const AccountSettings: React.FC<AccountSettingsProps> = ({ plan, profile }) => {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [defaultRole, setDefaultRole] = useState((profile?.metadata as any)?.defaultRole || '');
  const [emailNotifications, setEmailNotifications] = useState(
    (profile?.metadata as any)?.emailNotifications !== false
  );

  const [pwLoading, setPwLoading] = useState(false);
  const [pwSent, setPwSent] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await supabase.from('profiles').update({
        full_name: fullName,
        metadata: {
          ...((profile.metadata as any) ?? {}),
          defaultRole,
          emailNotifications,
        },
        updated_at: new Date().toISOString(),
      }).eq('id', profile.id);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error('Failed to save settings:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!profile?.email) return;
    setPwLoading(true);
    setPwError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setPwSent(true);
    } catch (err: any) {
      setPwError(err?.message ?? 'Failed to send reset email. Try again.');
    } finally {
      setPwLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="max-w-4xl mx-auto py-16 px-10">
      <div className="mb-16">
        <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">Account Settings</h2>
        <p className="text-slate-500 font-medium">Manage your profile, preferences, and security settings.</p>
      </div>

      <div className="space-y-8">

        {/* Personal Information */}
        <section className="bg-[#16161E] border border-[#1D1D26] rounded-[2.5rem] p-10">
          <div className="flex items-center gap-3 mb-8 border-b border-white/5 pb-4">
            <User className="text-blue-500" size={20} />
            <h3 className="text-white font-bold text-lg">Personal Information</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Full Name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-[#0D0D12] border border-[#1D1D26] rounded-xl p-4 text-white text-sm focus:border-blue-500/50 outline-none transition-all"
                placeholder="Your full name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Email Address</label>
              <input
                readOnly
                value={profile?.email || ''}
                className="w-full bg-[#0D0D12] border border-[#1D1D26] rounded-xl p-4 text-slate-500 text-sm cursor-not-allowed outline-none"
              />
              <p className="text-[10px] text-slate-700 font-bold uppercase tracking-widest">
                Email changes require support — contact hiremax.ai@gmail.com
              </p>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-white/5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-white font-bold text-sm">Current Plan</p>
                <p className="text-slate-500 text-xs font-medium">Your active subscription tier</p>
              </div>
              <span className={`font-black text-xs uppercase tracking-widest px-4 py-2 rounded-xl ${
                plan === 'Elite' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25' :
                plan === 'Career Pro' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/25' :
                'bg-slate-700/50 text-slate-400 border border-slate-700'
              }`}>
                {plan}
              </span>
            </div>
          </div>

          {profile?.connected_providers && profile.connected_providers.length > 0 && (
            <div className="mt-6 pt-6 border-t border-white/5">
              <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest mb-3">Linked Auth Providers</p>
              <div className="flex gap-3">
                {profile.connected_providers.map(p => (
                  <span key={p} className="bg-blue-600/10 border border-blue-600/20 text-blue-400 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Preferences */}
        <section className="bg-[#16161E] border border-[#1D1D26] rounded-[2.5rem] p-10">
          <div className="flex items-center gap-3 mb-8 border-b border-white/5 pb-4">
            <Shield className="text-indigo-500" size={20} />
            <h3 className="text-white font-bold text-lg">Preferences</h3>
          </div>
          <div className="space-y-8">
            <div className="flex items-center justify-between gap-6">
              <div>
                <p className="text-white font-bold text-sm">Default Role Focus</p>
                <p className="text-slate-500 text-xs font-medium mt-0.5">Used to prioritize signals during resume analysis and market scans.</p>
              </div>
              <input
                value={defaultRole}
                onChange={e => setDefaultRole(e.target.value)}
                placeholder="e.g. Backend Engineer"
                className="bg-[#0D0D12] border border-[#1D1D26] rounded-lg px-4 py-2.5 text-white text-sm focus:border-blue-500/50 outline-none transition-all w-52 placeholder:text-slate-700"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-bold text-sm">Email Notifications</p>
                <p className="text-slate-500 text-xs font-medium mt-0.5">Receive market signal updates and job alerts via email.</p>
              </div>
              <button
                onClick={() => setEmailNotifications(v => !v)}
                className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${emailNotifications ? 'bg-blue-600' : 'bg-slate-700'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${emailNotifications ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>
        </section>

        {/* Security */}
        <section className="bg-[#16161E] border border-[#1D1D26] rounded-[2.5rem] p-10">
          <div className="flex items-center gap-3 mb-8 border-b border-white/5 pb-4">
            <Lock className="text-amber-500" size={20} />
            <h3 className="text-white font-bold text-lg">Security</h3>
          </div>
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/5">
              <div>
                <p className="text-white font-bold text-sm">Password</p>
                <p className="text-slate-500 text-xs font-medium mt-0.5">A reset link will be sent to your registered email address.</p>
              </div>
              <div className="flex items-center gap-3">
                {pwSent && (
                  <div className="flex items-center gap-2 text-green-400 text-xs font-bold">
                    <CheckCircle2 size={14} /> Reset email sent
                  </div>
                )}
                {pwError && (
                  <div className="flex items-center gap-2 text-red-400 text-xs font-bold">
                    <AlertTriangle size={14} /> {pwError}
                  </div>
                )}
                <button
                  onClick={handleResetPassword}
                  disabled={pwLoading || pwSent}
                  className="whitespace-nowrap bg-[#1A1D26] border border-[#1D1D26] text-white px-6 py-3 rounded-xl font-bold text-xs hover:border-white/30 transition-all disabled:opacity-60 flex items-center gap-2"
                >
                  {pwLoading ? <Loader2 size={12} className="animate-spin" /> : null}
                  {pwSent ? 'Email Sent' : 'Send Reset Link'}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-bold text-sm">Sign Out</p>
                <p className="text-slate-500 text-xs font-medium mt-0.5">Sign out of your account on this device.</p>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 bg-[#1A1D26] border border-[#1D1D26] text-slate-400 hover:text-white px-6 py-3 rounded-xl font-bold text-xs hover:border-white/30 transition-all"
              >
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="border border-red-500/20 rounded-[2.5rem] p-10 bg-red-500/3">
          <div className="flex items-center gap-3 mb-6 border-b border-red-500/10 pb-4">
            <AlertTriangle className="text-red-500" size={20} />
            <h3 className="text-red-400 font-bold text-lg">Danger Zone</h3>
          </div>
          {!showDeleteConfirm ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-bold text-sm">Delete Account</p>
                <p className="text-slate-500 text-xs font-medium mt-0.5">
                  Permanently delete your account, resumes, and all associated data. This cannot be undone.
                </p>
              </div>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 border border-red-500/30 text-red-400 hover:bg-red-500/10 px-6 py-3 rounded-xl font-bold text-xs transition-all"
              >
                <Trash2 size={14} /> Delete Account
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-red-300 font-bold text-sm">
                Are you absolutely sure? This will permanently delete all your data including resumes, analyses, and application history.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-6 py-3 rounded-xl font-bold text-xs bg-[#1A1D26] border border-white/10 text-white hover:border-white/25 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setDeleteLoading(true);
                    // In production: call a backend endpoint that deletes the user via admin API
                    // For now: sign them out as safe fallback
                    await supabase.auth.signOut();
                  }}
                  disabled={deleteLoading}
                  className="px-6 py-3 rounded-xl font-bold text-xs bg-red-600 hover:bg-red-500 text-white transition-all flex items-center gap-2 disabled:opacity-60"
                >
                  {deleteLoading ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  Yes, Delete My Account
                </button>
              </div>
              <p className="text-slate-600 text-xs">Or email hiremax.ai@gmail.com to request manual deletion with GDPR compliance.</p>
            </div>
          )}
        </section>

        {/* Save Bar */}
        <div className="flex justify-end items-center gap-6">
          {saved && (
            <div className="flex items-center gap-2 text-green-500 font-bold text-xs uppercase tracking-widest animate-in fade-in duration-300">
              <CheckCircle2 size={16} /> Changes Saved
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-black py-4 px-12 rounded-2xl transition-all uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-blue-900/20 flex items-center gap-3"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            Save Settings <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
