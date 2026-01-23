
import React, { useState } from 'react';
import { Shield, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AuthViewProps {
  onSuccess: () => void;
}

const AuthView: React.FC<AuthViewProps> = ({ onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            }
          }
        });
        if (error) throw error;
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1117] flex flex-col items-center justify-center p-6 selection:bg-blue-500/30">
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col items-center mb-12">
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg mb-8">
            <Shield className="text-black" size={24} />
          </div>
          <h2 className="text-4xl font-black text-white tracking-tighter text-center uppercase leading-none mb-3">
            {isLogin ? 'System Login' : 'Initialize Access'}
          </h2>
          <p className="text-slate-600 font-bold uppercase tracking-[0.2em] text-[10px] text-center">Screening-First Architecture Only</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#16161E] border border-[#2D313D] p-10 rounded-[2.5rem] shadow-2xl space-y-8">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500 text-xs font-bold animate-in shake duration-300">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {!isLogin && (
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 block">Full Identity Name</label>
              <input 
                required
                type="text" 
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Full Name"
                className="w-full bg-[#0D0D12] border border-[#2D313D] rounded-xl p-4 text-white focus:border-blue-500 outline-none transition-all placeholder:text-slate-800 font-medium"
              />
            </div>
          )}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 block">Email Endpoint</label>
            <input 
              required
              type="email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@domain.com"
              className="w-full bg-[#0D0D12] border border-[#2D313D] rounded-xl p-4 text-white focus:border-blue-500 outline-none transition-all placeholder:text-slate-800 font-medium"
            />
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 block">System Access Password</label>
            <input 
              required
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#0D0D12] border border-[#2D313D] rounded-xl p-4 text-white focus:border-blue-500 outline-none transition-all placeholder:text-slate-800 font-medium"
            />
          </div>
          
          <button 
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-white text-black font-black rounded-2xl flex items-center justify-center gap-3 hover:bg-slate-200 transition-all disabled:opacity-50 group uppercase tracking-widest text-xs"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : (
              <>
                {isLogin ? 'Authenticate' : 'Initialize Access'}
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-slate-700 text-[10px] font-black uppercase tracking-widest mt-12">
          {isLogin ? "New to the system?" : "Existing system user?"} 
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="ml-2 text-slate-400 hover:text-white transition-colors border-b border-slate-800"
          >
            {isLogin ? "Create account" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
};

export default AuthView;
