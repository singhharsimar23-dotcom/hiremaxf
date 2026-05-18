import React, { useState, useEffect } from 'react';
import { Sparkles, ArrowRight, Loader2, AlertCircle, Chrome, Linkedin, Github, Mail, Lock, Eye, EyeOff, ChevronLeft, CheckCircle2, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Props { onSuccess: () => void; }
type Mode = 'LOGIN' | 'SIGNUP' | 'RECOVER';

const AuthView: React.FC<Props> = ({ onSuccess }) => {
  const [mode, setMode] = useState<Mode>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => { setError(null); setSuccess(null); }, [mode]);

  const oauth = async (provider: 'google' | 'github' | 'linkedin') => {
    setLoading(true); setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin + window.location.pathname + window.location.search,
          scopes: provider === 'github' ? 'repo read:user' : provider === 'linkedin' ? 'openid profile email' : 'email profile'
        }
      });
      if (error) throw error;
    } catch (err: any) { setError(`Couldn't connect to ${provider}. Try again.`); setLoading(false); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError(null);
    try {
      if (mode === 'LOGIN') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onSuccess();
      } else if (mode === 'SIGNUP') {
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, plan: 'Starter' } } });
        if (error) throw error;
        setSuccess('Check your email to confirm your account, then come back to sign in.');
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/reset-password` });
        if (error) throw error;
        setSuccess('Password reset link sent — check your inbox.');
      }
    } catch (err: any) { setError(err.message || 'Something went wrong. Please try again.'); }
    finally { setLoading(false); }
  };

  const SocialBtn = ({ icon: Icon, label, onClick, iconClass }: { icon: any; label: string; onClick: () => void; iconClass?: string }) => (
    <button onClick={onClick} disabled={loading} className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-[#1A1D26] border border-white/8 hover:bg-white/5 hover:border-white/15 transition-all disabled:opacity-50">
      <Icon size={18} className={iconClass || 'text-white'} />
      <span className="text-white font-semibold text-sm">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex">
      {/* Left panel — value prop */}
      <div className="hidden lg:flex w-[480px] shrink-0 flex-col justify-between p-14 bg-gradient-to-br from-[#0F0F1A] to-[#0A0A0F] border-r border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center"><Shield className="text-black" size={18}/></div>
          <span className="text-white font-black text-lg">HireMax</span>
        </div>
        <div>
          <p className="text-slate-500 text-xs font-medium mb-10 uppercase tracking-widest">Why engineers use HireMax</p>
          <div className="space-y-6">
            {[
              { label: '~6 seconds', desc: 'is all a recruiter spends scanning your resume before deciding.' },
              { label: '75%+', desc: 'of resumes are auto-rejected by ATS before reaching a human reviewer.' },
              { label: 'Free to start', desc: 'Upload your resume and get a full AI diagnostic in under 2 minutes. No card required.' },
            ].map(s => (
              <div key={s.label} className="flex items-start gap-4">
                <div className="text-blue-400 font-black text-xl w-32 shrink-0">{s.label}</div>
                <p className="text-slate-400 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 p-4 bg-blue-500/8 border border-blue-500/15 rounded-2xl">
            <p className="text-blue-300 text-xs font-semibold leading-relaxed">
              HireMax analyzes your resume against ATS signal factors and recruiter patterns — giving you data, not opinions.
            </p>
          </div>
        </div>
        <p className="text-slate-700 text-xs">© 2025–2026 HireMax.</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-[420px] animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="mb-10 text-center">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 lg:hidden"><Shield className="text-black" size={22}/></div>
            <h1 className="text-3xl font-black text-white tracking-tight mb-2">
              {mode === 'LOGIN' ? 'Welcome back' : mode === 'SIGNUP' ? 'Start for free' : 'Reset your password'}
            </h1>
            <p className="text-slate-400 text-sm">
              {mode === 'LOGIN' ? 'Sign in to your HireMax account' : mode === 'SIGNUP' ? 'Create your account — no credit card required' : 'Enter your email and we\'ll send a reset link'}
            </p>
          </div>

          <div className="bg-[#16161E] border border-white/8 rounded-3xl p-8 space-y-5 relative">
            {loading && (
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 rounded-3xl flex items-center justify-center">
                <Loader2 size={28} className="text-blue-400 animate-spin"/>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
                <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5"/>
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="flex items-start gap-3 bg-green-500/10 border border-green-500/20 rounded-2xl p-4">
                <CheckCircle2 size={16} className="text-green-400 shrink-0 mt-0.5"/>
                <p className="text-green-300 text-sm">{success}</p>
              </div>
            )}

            {/* OAuth */}
            {mode !== 'RECOVER' && !success && (
              <div className="space-y-3">
                <SocialBtn icon={Chrome} label="Continue with Google" onClick={() => oauth('google')} iconClass="text-blue-400"/>
                <div className="grid grid-cols-2 gap-3">
                  <SocialBtn icon={Github} label="GitHub" onClick={() => oauth('github')}/>
                  <SocialBtn icon={Linkedin} label="LinkedIn" onClick={() => oauth('linkedin')} iconClass="text-blue-400"/>
                </div>
                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/8"/></div>
                  <div className="relative flex justify-center"><span className="bg-[#16161E] px-4 text-slate-600 text-xs font-medium">or continue with email</span></div>
                </div>
              </div>
            )}

            {/* Email form */}
            {!success && (
              <form onSubmit={submit} className="space-y-4">
                {mode === 'SIGNUP' && (
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1.5">Full Name</label>
                    <input required type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Smith"
                      className="w-full bg-[#0D0D12] border border-white/10 rounded-xl py-3.5 px-4 text-white text-sm outline-none focus:border-blue-500/50 placeholder:text-slate-700 transition-all"/>
                  </div>
                )}
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1.5">Email</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600"/>
                    <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com"
                      className="w-full bg-[#0D0D12] border border-white/10 rounded-xl py-3.5 pl-11 pr-4 text-white text-sm outline-none focus:border-blue-500/50 placeholder:text-slate-700 transition-all"/>
                  </div>
                </div>
                {mode !== 'RECOVER' && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-400">Password</label>
                      {mode === 'LOGIN' && <button type="button" onClick={() => setMode('RECOVER')} className="text-xs text-slate-500 hover:text-blue-400 transition-colors">Forgot password?</button>}
                    </div>
                    <div className="relative">
                      <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600"/>
                      <input required type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••••"
                        className="w-full bg-[#0D0D12] border border-white/10 rounded-xl py-3.5 pl-11 pr-12 text-white text-sm outline-none focus:border-blue-500/50 placeholder:text-slate-700 transition-all font-mono"/>
                      <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors">
                        {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
                      </button>
                    </div>
                  </div>
                )}
                <button type="submit" disabled={loading}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-lg shadow-blue-500/20 mt-2">
                  {mode === 'LOGIN' ? 'Sign in' : mode === 'SIGNUP' ? 'Create account' : 'Send reset link'}
                  <ArrowRight size={16}/>
                </button>
              </form>
            )}

            {mode === 'RECOVER' && (
              <button onClick={() => setMode('LOGIN')} className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-white text-sm transition-colors">
                <ChevronLeft size={15}/> Back to sign in
              </button>
            )}
          </div>

          <p className="text-center text-slate-500 text-sm mt-6">
            {mode === 'LOGIN' ? "Don't have an account? " : "Already have an account? "}
            <button onClick={() => setMode(mode === 'LOGIN' ? 'SIGNUP' : 'LOGIN')} className="text-blue-400 hover:text-blue-300 font-semibold transition-colors">
              {mode === 'LOGIN' ? 'Sign up free' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthView;
