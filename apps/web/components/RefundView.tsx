
import React from 'react';
import { AppView } from '../types';
import { ArrowLeft } from 'lucide-react';

interface RefundViewProps {
  setView?: (v: AppView) => void;
}

export const RefundView: React.FC<RefundViewProps> = ({ setView }) => {
  return (
    <div className="min-h-screen bg-[#0B0F1A]">
      <div className="max-w-3xl mx-auto px-6 py-20">
        {setView && (
          <button
            onClick={() => setView('landing')}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-bold uppercase tracking-widest transition-colors mb-12"
          >
            <ArrowLeft size={16} /> Back to Home
          </button>
        )}

        <div className="mb-12">
          <p className="text-blue-500 text-xs font-black uppercase tracking-[0.3em] mb-3">Legal</p>
          <h1 className="text-5xl font-black text-white tracking-tighter leading-none mb-4">Refund Policy</h1>
          <p className="text-slate-400 text-base font-medium">Last Updated: May 18, 2025 &nbsp;·&nbsp; Effective Immediately</p>
        </div>

        <div className="space-y-10 text-slate-300 leading-relaxed text-[15px]">

          <section className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-6">
            <p className="text-white font-bold text-base leading-relaxed">
              <span className="text-blue-400">Important:</span> HireMax delivers AI-powered career intelligence digitally and instantaneously. Because access to reports, rebuilt resumes, and analysis is granted immediately upon payment verification, our refund policy reflects the nature of instant digital delivery.
            </p>
          </section>

          <section>
            <h2 className="text-white font-black text-xl mb-3">1. General Policy — All Sales Are Final</h2>
            <p>Due to the immediate digital delivery and processing costs of AI-driven analysis, <strong className="text-white">all sales on HireMax are final.</strong> Once an order is placed and payment is confirmed, the AI system begins processing your request and access to premium features is granted immediately.</p>
            <p className="mt-3">This includes, but is not limited to:</p>
            <ul className="list-disc ml-6 mt-3 space-y-2 text-slate-300">
              <li>Career Pro monthly subscriptions</li>
              <li>Career Elite monthly subscriptions</li>
              <li>Career Elite 6-Month one-time access</li>
              <li>Any individual AI analysis or report generated</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-black text-xl mb-3">2. Technical Error Exception</h2>
            <p>If you experience a verifiable technical error — such as your AI report failing to generate, a critical platform malfunction preventing access to purchased features, or a duplicate billing error — you may contact our support team within <strong className="text-white">7 days</strong> of the transaction date.</p>
            <p className="mt-3">Please contact us at: <a href="mailto:hiremax.ai@gmail.com" className="text-blue-400 hover:text-blue-300 underline">hiremax.ai@gmail.com</a></p>
            <p className="mt-3">Include in your message:</p>
            <ul className="list-disc ml-6 mt-3 space-y-2 text-slate-300">
              <li>Your account email address</li>
              <li>Date and amount of the transaction</li>
              <li>A clear description of the technical error experienced</li>
              <li>Any screenshots or error messages, if available</li>
            </ul>
            <p className="mt-4">Our team will investigate and, where the error is confirmed on our end, issue a <strong className="text-white">manual credit reissue or a full refund</strong> at our discretion within 5 business days.</p>
          </section>

          <section>
            <h2 className="text-white font-black text-xl mb-3">3. Subscription Cancellations</h2>
            <p>You may cancel your monthly subscription at any time directly from your account settings. Upon cancellation:</p>
            <ul className="list-disc ml-6 mt-3 space-y-2 text-slate-300">
              <li>You will retain access to your paid tier until the end of the current billing period</li>
              <li>No future charges will be made after cancellation</li>
              <li>No partial-month refunds are issued for unused days in the current period</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-black text-xl mb-3">4. Chargebacks & Disputes</h2>
            <p>If you initiate a chargeback with your bank or payment provider without first contacting HireMax support, we reserve the right to permanently suspend your account. We strongly encourage you to contact us first at <a href="mailto:hiremax.ai@gmail.com" className="text-blue-400 hover:text-blue-300 underline">hiremax.ai@gmail.com</a> — we are committed to resolving legitimate issues quickly and fairly.</p>
          </section>

          <section>
            <h2 className="text-white font-black text-xl mb-3">5. Instant Delivery Confirmation</h2>
            <p><strong className="text-white">Digital delivery of all HireMax products and services is instantaneous upon successful payment verification.</strong> You will receive immediate access to your purchased plan and all associated AI tools without any shipping delay, as HireMax operates entirely as a digital SaaS platform.</p>
          </section>

          <section>
            <h2 className="text-white font-black text-xl mb-3">6. Contact for Refund Requests</h2>
            <p>All refund-related inquiries must be submitted via email to: <a href="mailto:hiremax.ai@gmail.com" className="text-blue-400 hover:text-blue-300 underline">hiremax.ai@gmail.com</a></p>
            <p className="mt-2">Response time: within 1–2 business days. We aim to resolve all legitimate concerns quickly and professionally.</p>
          </section>

        </div>
      </div>
    </div>
  );
};

export default RefundView;
