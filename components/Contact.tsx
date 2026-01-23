
import React, { useState } from 'react';
import { Mail, MessageSquare, ArrowRight, CheckCircle2, Loader2, Send } from 'lucide-react';

export const Contact: React.FC = () => {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setSent(true);
    }, 1500);
  };

  return (
    <div className="max-w-6xl mx-auto py-16 px-10">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-20">
        <div>
          <div className="mb-12">
            <h2 className="text-5xl font-black text-white tracking-tighter uppercase mb-6 leading-none">Contact Support</h2>
            <p className="text-slate-500 text-lg font-medium leading-relaxed">
              Have a question or feedback? Our team typically responds within 24–48 hours.
            </p>
          </div>

          <div className="space-y-10">
             <div className="flex items-start gap-6">
                <div className="w-12 h-12 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-500 shrink-0">
                  <Mail size={24} />
                </div>
                <div>
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Email Support</p>
                   <p className="text-white font-bold text-lg">hiremax.ai@gmail.com</p>
                </div>
             </div>
             <div className="flex items-start gap-6">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 flex items-center justify-center text-indigo-500 shrink-0">
                  <MessageSquare size={24} />
                </div>
                <div>
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Corporate / Enterprise</p>
                   <p className="text-white font-bold text-lg">hiremax.ai@gmail.com</p>
                </div>
             </div>
          </div>
        </div>

        <div className="bg-[#16161E] border border-[#1D1D26] rounded-[3.5rem] p-12 shadow-2xl relative overflow-hidden">
          {sent ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in duration-500">
               <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center text-green-500">
                  <CheckCircle2 size={48} />
               </div>
               <h3 className="text-2xl font-black text-white uppercase tracking-tight">Message Received</h3>
               <p className="text-slate-500 font-medium leading-relaxed max-w-xs">
                 Thanks for reaching out. We'll get back to you at your account email address soon.
               </p>
               <button 
                onClick={() => setSent(false)}
                className="text-blue-500 font-bold uppercase tracking-widest text-[10px] hover:text-white transition-all"
               >
                 Send another message
               </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-2">
                <label className="input-label">Your Name</label>
                <input required className="w-full bg-[#0D0D12] border border-[#1D1D26] rounded-xl p-4 text-white focus:border-blue-500 outline-none transition-all" placeholder="John Doe" />
              </div>
              <div className="space-y-2">
                <label className="input-label">Email Address</label>
                <input required type="email" className="w-full bg-[#0D0D12] border border-[#1D1D26] rounded-xl p-4 text-white focus:border-blue-500 outline-none transition-all" placeholder="john@example.com" />
              </div>
              <div className="space-y-2">
                <label className="input-label">Message</label>
                <textarea required className="w-full bg-[#0D0D12] border border-[#1D1D26] rounded-xl p-4 text-white h-40 resize-none focus:border-blue-500 outline-none transition-all" placeholder="How can we help?" />
              </div>
              <button 
                type="submit"
                disabled={sending}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl transition-all uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-blue-900/20 flex items-center justify-center gap-3"
              >
                {sending ? <Loader2 className="animate-spin" size={18} /> : <><Send size={18} /> Submit Support Request</>}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
