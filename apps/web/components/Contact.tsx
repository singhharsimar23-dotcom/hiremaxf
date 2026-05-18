
import React, { useState } from 'react';
import { Mail, MessageSquare, Send, CheckCircle2, Loader2, AlertCircle, Clock, Shield, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ContactProps {
  user?: any;
}

type Category = 'general' | 'billing' | 'technical' | 'account' | 'feedback';

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'general', label: 'General Inquiry' },
  { value: 'billing', label: 'Billing & Payments' },
  { value: 'technical', label: 'Technical Issue' },
  { value: 'account', label: 'Account & Access' },
  { value: 'feedback', label: 'Product Feedback' },
];

export const Contact: React.FC<ContactProps> = ({ user }) => {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(user?.user_metadata?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [category, setCategory] = useState<Category>('general');
  const [message, setMessage] = useState('');
  const [ticketId, setTicketId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) return;

    setSending(true);
    setError(null);

    try {
      const { data, error: insertError } = await supabase
        .from('support_tickets')
        .insert({
          name: name.trim(),
          email: email.trim(),
          subject: CATEGORIES.find(c => c.value === category)?.label ?? 'General Inquiry',
          message: message.trim(),
          user_id: user?.id ?? null,
          status: 'open',
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      setTicketId(data?.id ?? null);
      setSent(true);
    } catch (err: any) {
      console.error('Ticket submission failed:', err);
      setError('Failed to submit your ticket. Please email us directly at hiremax.ai@gmail.com');
    } finally {
      setSending(false);
    }
  };

  const resetForm = () => {
    setSent(false);
    setError(null);
    setMessage('');
    setCategory('general');
    setTicketId(null);
  };

  return (
    <div className="max-w-6xl mx-auto py-16 px-10">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-20">

        {/* Left: Info */}
        <div>
          <div className="mb-12">
            <h2 className="text-5xl font-black text-white tracking-tighter uppercase mb-6 leading-none">Contact Support</h2>
            <p className="text-slate-500 text-lg font-medium leading-relaxed">
              Submit a ticket below and we'll respond within 24–48 hours. For urgent issues, email us directly.
            </p>
          </div>

          <div className="space-y-8">
            <div className="flex items-start gap-6">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-500 shrink-0">
                <Mail size={22} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Direct Email</p>
                <a href="mailto:hiremax.ai@gmail.com" className="text-white font-bold text-lg hover:text-blue-400 transition-colors">
                  hiremax.ai@gmail.com
                </a>
                <p className="text-slate-600 text-xs font-medium mt-1">For billing disputes and urgent issues</p>
              </div>
            </div>

            <div className="flex items-start gap-6">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600/10 flex items-center justify-center text-emerald-500 shrink-0">
                <Clock size={22} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Response Time</p>
                <p className="text-white font-bold text-lg">Within 24–48 hours</p>
                <p className="text-slate-600 text-xs font-medium mt-1">Monday–Friday, excluding public holidays</p>
              </div>
            </div>

            <div className="flex items-start gap-6">
              <div className="w-12 h-12 rounded-2xl bg-amber-600/10 flex items-center justify-center text-amber-500 shrink-0">
                <Shield size={22} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Refund Policy</p>
                <p className="text-white font-bold text-sm leading-relaxed">All sales are final — instant digital delivery.</p>
                <p className="text-slate-600 text-xs font-medium mt-1">Technical failures? Contact within 7 days for a re-run.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Form */}
        <div className="bg-[#16161E] border border-[#1D1D26] rounded-[3.5rem] p-12 shadow-2xl relative overflow-hidden">
          {sent ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in duration-500 min-h-[400px]">
              <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center text-green-500">
                <CheckCircle2 size={48} />
              </div>
              <h3 className="text-2xl font-black text-white uppercase tracking-tight">Ticket Received</h3>
              <p className="text-slate-500 font-medium leading-relaxed max-w-xs">
                Your support request has been logged. We'll reply to <span className="text-white font-bold">{email}</span> within 24–48 hours.
              </p>
              {ticketId && (
                <div className="bg-[#0D0D12] border border-white/5 rounded-xl px-5 py-3">
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Ticket Reference</p>
                  <p className="text-slate-300 font-mono text-xs">{ticketId.slice(0, 8).toUpperCase()}</p>
                </div>
              )}
              <button
                onClick={resetForm}
                className="text-blue-500 font-bold uppercase tracking-widest text-[10px] hover:text-white transition-all"
              >
                Submit another request
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="mb-6">
                <p className="text-white font-black text-lg uppercase tracking-tight">Open a Support Ticket</p>
                <p className="text-slate-500 text-xs font-medium mt-1">All fields are required. Tickets are logged in our system.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Your Name</label>
                  <input
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full bg-[#0D0D12] border border-[#1D1D26] rounded-xl p-3.5 text-white text-sm focus:border-blue-500/50 outline-none transition-all placeholder:text-slate-700"
                    placeholder="Jane Doe"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Email Address</label>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-[#0D0D12] border border-[#1D1D26] rounded-xl p-3.5 text-white text-sm focus:border-blue-500/50 outline-none transition-all placeholder:text-slate-700"
                    placeholder="jane@example.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Category</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as Category)}
                  className="w-full bg-[#0D0D12] border border-[#1D1D26] rounded-xl p-3.5 text-white text-sm focus:border-blue-500/50 outline-none transition-all"
                >
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Message</label>
                <textarea
                  required
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={5}
                  className="w-full bg-[#0D0D12] border border-[#1D1D26] rounded-xl p-3.5 text-white text-sm h-36 resize-none focus:border-blue-500/50 outline-none transition-all placeholder:text-slate-700"
                  placeholder="Describe your issue in detail. Include any error messages or steps to reproduce."
                />
              </div>

              {error && (
                <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                  <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-red-300 text-sm font-medium">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={sending}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-black py-5 rounded-2xl transition-all uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-blue-900/20 flex items-center justify-center gap-3"
              >
                {sending ? <Loader2 className="animate-spin" size={18} /> : <><Send size={16} /> Submit Support Ticket</>}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
