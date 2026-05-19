
import React from 'react';
import { AppView } from '../types';
import { Mail, Zap, ShieldCheck, Instagram } from 'lucide-react';

interface FooterProps {
  setView: (v: AppView) => void;
}

export const Footer: React.FC<FooterProps> = ({ setView }) => {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#080B13] border-t border-[#1A1D26] mt-auto">

      {/* Compliance strip — instant delivery badge */}
      <div className="border-b border-[#1A1D26]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-8">
          <div className="flex items-center gap-2 text-emerald-400">
            <Zap size={13} className="shrink-0" />
            <span className="text-[11px] font-black uppercase tracking-widest">
              Digital delivery is instantaneous upon successful payment verification
            </span>
          </div>
          <div className="hidden sm:block w-px h-4 bg-[#2D313D]" />
          <div className="flex items-center gap-2 text-slate-400">
            <ShieldCheck size={13} className="shrink-0" />
            <span className="text-[11px] font-black uppercase tracking-widest">
              256-bit encrypted · Secure checkout
            </span>
          </div>
        </div>
      </div>

      {/* Main footer */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">

          {/* Brand */}
          <div>
            <p className="text-white font-black text-xl tracking-tighter mb-3">HireMax</p>
            <p className="text-slate-400 text-sm leading-relaxed mb-5">
              AI-powered career intelligence platform. Resume analysis, rebuilding, interview prep, and market insights — delivered instantly.
            </p>
            <a
              href="mailto:hiremax.ai@gmail.com"
              className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors text-sm font-bold"
            >
              <Mail size={14} />
              hiremax.ai@gmail.com
            </a>
            <div className="mt-5 p-4 rounded-xl bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/20 flex flex-col gap-2 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-pink-500/5 rounded-full blur-xl -z-10 group-hover:bg-pink-500/10 transition-colors" />
              <span className="text-[10px] font-black text-pink-400 uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse" />
                Career Hacks & Tips
              </span>
              <p className="text-xs text-slate-300">
                Join our Instagram community for daily resume secrets, hiring manager scripts, and interview prep guides.
              </p>
              <a
                href="https://www.instagram.com/hiremax.ai/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-2 mt-1 rounded-lg bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 hover:from-purple-500 hover:to-orange-400 text-white text-xs font-bold transition-all transform hover:scale-[1.02] shadow-lg shadow-pink-500/25"
              >
                <Instagram size={13} />
                Follow @hiremax.ai
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] mb-5">Product</p>
            <nav className="space-y-3">
              {[
                { label: 'Dashboard', view: 'dashboard' as AppView },
                { label: 'Pricing & Plans', view: 'pricing' as AppView },
                { label: 'FAQ', view: 'faq' as AppView },
                { label: 'Contact Support', view: 'contact' as AppView },
              ].map(({ label, view }) => (
                <button
                  key={view}
                  onClick={() => setView(view)}
                  className="block text-slate-400 hover:text-white text-sm font-medium transition-colors text-left"
                >
                  {label}
                </button>
              ))}
            </nav>
          </div>

          {/* Legal */}
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] mb-5">Legal</p>
            <nav className="space-y-3">
              {[
                { label: 'Terms & Conditions', view: 'terms' as AppView },
                { label: 'Privacy Policy', view: 'privacy' as AppView },
                { label: 'Refund Policy', view: 'refund' as AppView },
              ].map(({ label, view }) => (
                <button
                  key={view}
                  onClick={() => setView(view)}
                  className="block text-slate-400 hover:text-white text-sm font-medium transition-colors text-left"
                >
                  {label}
                </button>
              ))}
              <a
                href="mailto:hiremax.ai@gmail.com"
                className="block text-slate-400 hover:text-white text-sm font-medium transition-colors"
              >
                hiremax.ai@gmail.com
              </a>
            </nav>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-6 border-t border-[#1A1D26] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-slate-600 text-xs font-medium">
            © {year} HireMax Technologies.
          </p>
          <div className="flex items-center gap-6">
            <button onClick={() => setView('terms')} className="text-slate-600 hover:text-slate-400 text-xs transition-colors">Terms</button>
            <button onClick={() => setView('privacy')} className="text-slate-600 hover:text-slate-400 text-xs transition-colors">Privacy</button>
            <button onClick={() => setView('refund')} className="text-slate-600 hover:text-slate-400 text-xs transition-colors">Refunds</button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
