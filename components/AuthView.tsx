
import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  ArrowRight, 
  Loader2, 
  AlertCircle, 
  Github, 
  Linkedin, 
  Chrome, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ChevronLeft,
  CheckCircle2,
  // Added ShieldCheck to the lucide-react imports
  ShieldCheck
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AuthViewProps {
  onSuccess: () => void;
}

type AuthMode = 'LOGIN' | 'SIGNUP' | 'RECOVER';

const AuthView: React.FC<AuthViewProps> = ({ onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<AuthMode>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Clear errors when toggling modes
  useEffect(() => {
    setError(null);
    setSuccessMsg(null);
  }, [mode]);

  const handleOAuth = async (provider: 'google' | 'github' | 'linkedin') => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin,
          queryParams: provider === 'github' ? { access_type: 'offline', prompt: 'consent' } : {},
          scopes: provider === 'github' ? 'repo read:user' : provider === 'linkedin' ? 'openid profile email' : 'email profile'
        }
      });
      if (error) throw error;
      // Redirect happens automatically
    } catch (err: any) {
      setError(err.message || `Handshake with ${provider} failed.`);
      setLoading(false);
    }
  };

  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'LOGIN') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === 'SIGNUP') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, plan: 'Starter', connected_providers: [] }
          }
        });
        if (error) throw error;
        setSuccessMsg('Initialization complete. Please verify your email endpoint.');
        return;
      } else if (mode === 'RECOVER') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        });
        if (error) throw error;
        setSuccessMsg('Recovery instructions dispatched to your email endpoint.');
        return;
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Authentication sequence interrupted.');
    } finally {
      setLoading(false);
    }
  };

  const SocialButton = ({ 
    icon: Icon, 
    label, 
    onClick, 
    colorClass 
  }: { 
    icon: any, 
    label: string, 
    onClick: () => void, 
    colorClass: string 
  }) => (
    <button
      onClick={onClick}
      disabled={loading}
      className={`w-full flex items-center justify-center gap-3 py-4 rounded-2xl border border-[#2D313D] bg-[#1A1D26] hover:bg-[#252833] transition-all group disabled:opacity-50`}
    >
      <Icon size={20} className={colorClass} />
      <span className="text-white font-bold text-xs uppercase tracking-widest">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-[#0F1117] flex flex-col items-center justify-center p-6 selection:bg-blue-500/30">
      <div className="w-full max-w-[440px] animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* Header System State */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-2xl mb-6 group hover:scale-105 transition-transform">
            <Shield className="text-black" size={28} />
          </div>
          <h2 className="text-3xl font-black text-white tracking-tighter text-center uppercase leading-none mb-2">
            {mode === 'LOGIN' ? 'System Access' : mode === 'SIGNUP' ? 'Initialize Identity' : 'Identity Recovery'}
          </h2>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-[9px]">
              {loading ? 'Processing Protocol...' : 'Encryption Active'}
            </p>
          </div>
        </div>

        <div className="bg-[#16161E] border border-[#2D313D] p-10 rounded-[3rem] shadow-2xl space-y-8 relative overflow-hidden ring-1 ring-white/5">
          {/* Progress Overlay */}
          {loading && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex flex-col items-center justify-center gap-4">
              <Loader2 size={32} className="text-blue-500 animate-spin" />
              <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Executing...</span>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 text-red-500 text-xs font-bold animate-in shake duration-300">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-start gap-3 text-green-500 text-xs font-bold animate-in zoom-in duration-300">
              <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Social Identity Providers */}
          {mode !== 'RECOVER' && !successMsg && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <SocialButton 
                  icon={Github} 
                  label="GitHub" 
                  onClick={() => handleOAuth('github')} 
                  colorClass="text-white" 
                />
                <SocialButton 
                  icon={Linkedin} 
                  label="LinkedIn" 
                  onClick={() => handleOAuth('linkedin')} 
                  colorClass="text-blue-400" 
                />
              </div>
              <SocialButton 
                icon={Chrome} 
                label="Sign in with Google" 
                onClick={() => handleOAuth('google')} 
                colorClass="text-blue-500" 
              />
              
              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#2D313D]"></div></div>
                <div className="relative flex justify-center text-[9px] uppercase tracking-[0.4em] font-black"><span className="bg-[#16161E] px-4 text-slate-600">Secure Direct Access</span></div>
              </div>
            </div>
          )}

          {/* Email/Password Form */}
          {!successMsg && (
            <form onSubmit={handlePasswordAuth} className="space-y-6">
              {mode === 'SIGNUP' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Full Legal Name</label>
                  <div className="relative group">
                    <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-700 group-focus-within:text-blue-500 transition-colors" />
                    <input 
                      required
                      type="text" 
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full bg-[#0D0D12] border border-[#2D313D] rounded-2xl py-4 pl-12 pr-4 text-white focus:border-blue-500 outline-none transition-all placeholder:text-slate-800 font-medium"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Endpoint Alias (Email)</label>
                <div className="relative group">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-700 group-focus-within:text-blue-500 transition-colors" />
                  <input 
                    required
                    type="email" 
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@domain.com"
                    className="w-full bg-[#0D0D12] border border-[#2D313D] rounded-2xl py-4 pl-12 pr-4 text-white focus:border-blue-500 outline-none transition-all placeholder:text-slate-800 font-medium"
                  />
                </div>
              </div>

              {mode !== 'RECOVER' && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Access Key (Password)</label>
                    {mode === 'LOGIN' && (
                      <button 
                        type="button" 
                        onClick={() => setMode('RECOVER')}
                        className="text-[9px] font-black text-blue-500 hover:text-white uppercase tracking-widest transition-colors"
                      >
                        Recover?
                      </button>
                    )}
                  </div>
                  <div className="relative group">
                    <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-700 group-focus-within:text-blue-500 transition-colors" />
                    <input 
                      required
                      type={showPassword ? 'text' : 'password'} 
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#0D0D12] border border-[#2D313D] rounded-2xl py-4 pl-12 pr-12 text-white focus:border-blue-500 outline-none transition-all placeholder:text-slate-800 font-medium font-mono"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-700 hover:text-slate-400 transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              )}
              
              <button 
                type="submit"
                disabled={loading}
                className="w-full py-5 bg-white text-black font-black rounded-2xl flex items-center justify-center gap-3 hover:bg-slate-200 transition-all disabled:opacity-50 group uppercase tracking-widest text-xs shadow-xl"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : (
                  <>
                    {mode === 'LOGIN' ? 'Authenticate' : mode === 'SIGNUP' ? 'Initialize' : 'Dispatch Recovery'}
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Recovery Back Link */}
          {mode === 'RECOVER' && (
            <button 
              onClick={() => setMode('LOGIN')}
              className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors"
            >
              <ChevronLeft size={14} /> Back to Authentication
            </button>
          )}
        </div>

        <p className="text-center text-slate-700 text-[10px] font-black uppercase tracking-[0.2em] mt-10">
          {mode === 'LOGIN' ? "System entry missing?" : "Access parameters defined?"} 
          <button 
            onClick={() => setMode(mode === 'LOGIN' ? 'SIGNUP' : 'LOGIN')}
            className="ml-2 text-slate-400 hover:text-white transition-colors border-b border-slate-800 hover:border-blue-500"
          >
            {mode === 'LOGIN' ? "Initialize profile" : "Return to access"}
          </button>
        </p>

        {/* System Disclaimer */}
        <div className="mt-12 flex items-center justify-center gap-8 opacity-20 grayscale grayscale-100">
           <div className="flex items-center gap-2 font-black text-[9px] uppercase text-white tracking-widest">
              <ShieldCheck size={14} /> SOC-2 Compliant
           </div>
           <div className="flex items-center gap-2 font-black text-[9px] uppercase text-white tracking-widest">
              <Lock size={14} /> 256-bit AES
           </div>
        </div>
      </div>
    </div>
  );
};

export default AuthView;
