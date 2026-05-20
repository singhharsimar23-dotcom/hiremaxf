
import React from 'react';
import { AppView } from '../types';
import { ArrowLeft } from 'lucide-react';

interface PrivacyViewProps {
  setView?: (v: AppView) => void;
}

export const PrivacyView: React.FC<PrivacyViewProps> = ({ setView }) => {
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
          <h1 className="text-5xl font-black text-white tracking-tighter leading-none mb-4">Privacy Policy</h1>
          <p className="text-slate-400 text-base font-medium">Last Updated: May 18, 2025 &nbsp;·&nbsp; Effective Immediately</p>
        </div>

        <div className="space-y-10 text-slate-300 leading-relaxed text-[15px]">

          <section>
            <h2 className="text-white font-black text-xl mb-3">1. Introduction</h2>
            <p>HireMax Technologies ("we", "us", or "our") is committed to protecting your personal information. This Privacy Policy explains what data we collect, how we use it, and the rights you have over your information. By using HireMax, you agree to the practices described in this policy.</p>
          </section>

          <section>
            <h2 className="text-white font-black text-xl mb-3">2. Information We Collect</h2>
            <p>We collect the following categories of personal information:</p>
            <ul className="list-disc ml-6 mt-3 space-y-2 text-slate-300">
              <li><strong className="text-white">Account Information:</strong> We collect your name and email address when you register for an account or sign in via a third-party provider (Google, LinkedIn).</li>
              <li><strong className="text-white">Resume Data:</strong> We collect the resume files and resume text that you upload or paste into the HireMax platform for analysis and rebuilding.</li>
              <li><strong className="text-white">Professional Information:</strong> Information contained in your resume including work history, education, skills, and contact details.</li>
              <li><strong className="text-white">Usage Data:</strong> We collect anonymized analytics about how you interact with the platform (e.g., features used, pages visited) to improve service quality.</li>
              <li><strong className="text-white">Payment Information:</strong> Payment details are processed directly by our payment processor and are not stored on HireMax servers. We only retain transaction records (amount, date, plan).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-black text-xl mb-3">3. How We Use Your Information</h2>
            <p>Your personal data is processed for the following purposes:</p>
            <ul className="list-disc ml-6 mt-3 space-y-2 text-slate-300">
              <li>To generate your AI-powered resume analysis, diagnostic reports, and career intelligence</li>
              <li>To rebuild and optimize your resume documents based on your inputs</li>
              <li>To deliver interview preparation kits, cover letters, and LinkedIn optimization outputs</li>
              <li>To manage your account, subscription, and support requests</li>
              <li>To send transactional emails (account confirmation, password reset, billing receipts)</li>
              <li>To improve the quality and accuracy of our AI models using anonymized, aggregated data</li>
            </ul>
            <p className="mt-4 p-4 bg-[#161B2E] border border-[#2D313D] rounded-xl">
              <strong className="text-white">We do not sell or share your personal resume details, work history, or contact information with third-party advertisers.</strong> Your uploaded resume data is processed solely to generate your technical inference reports and evaluate your career positioning.
            </p>
          </section>

          <section>
            <h2 className="text-white font-black text-xl mb-3">4. Data Storage & Security</h2>
            <p>Your data is stored securely in our cloud database (Supabase) with industry-standard encryption at rest and in transit. We implement technical and organizational security measures to protect your data against unauthorized access, disclosure, or loss.</p>
            <p className="mt-3">Access to your personal data is strictly limited to authenticated HireMax service accounts required to process your requests. No human employee can view your resume content without your explicit consent for a support case.</p>
          </section>

          <section>
            <h2 className="text-white font-black text-xl mb-3">5. Third-Party Services</h2>
            <p>HireMax uses the following third-party services to operate the platform:</p>
            <ul className="list-disc ml-6 mt-3 space-y-2 text-slate-300">
              <li><strong className="text-white">Supabase</strong> — Secure cloud database and authentication</li>
              <li><strong className="text-white">Google Gemini AI</strong> — AI analysis and content generation engine</li>
              <li><strong className="text-white">Payment Processor</strong> — Secure payment processing (your card data never touches our servers)</li>
            </ul>
            <p className="mt-3">Each of these providers operates under their own privacy policies and security standards. We only share the minimum data necessary for service operation with these providers.</p>
          </section>

          <section>
            <h2 className="text-white font-black text-xl mb-3">6. Your Data Rights</h2>
            <p>You have the following rights over your personal data:</p>
            <ul className="list-disc ml-6 mt-3 space-y-2 text-slate-300">
              <li><strong className="text-white">Access:</strong> You may request a copy of the personal data we hold about you</li>
              <li><strong className="text-white">Correction:</strong> You may update your profile information at any time from your account settings</li>
              <li><strong className="text-white">Deletion:</strong> You may contact support at any time to request the permanent deletion of your account and all uploaded documents from our database</li>
              <li><strong className="text-white">Portability:</strong> You may request an export of your resume data and analysis history</li>
              <li><strong className="text-white">Opt-out:</strong> You may opt out of non-essential communications at any time</li>
            </ul>
            <p className="mt-4">To exercise any of these rights, contact us at: <a href="mailto:hiremax.ai@gmail.com" className="text-blue-400 hover:text-blue-300 underline">hiremax.ai@gmail.com</a></p>
          </section>

          <section>
            <h2 className="text-white font-black text-xl mb-3">7. Data Retention</h2>
            <p>We retain your account data and uploaded resumes for as long as your account is active. If you delete your account, all associated personal data and uploaded documents will be permanently removed from our systems within 30 days, except where retention is required by law.</p>
          </section>

          <section>
            <h2 className="text-white font-black text-xl mb-3">8. Cookies & Analytics</h2>
            <p>HireMax uses minimal session cookies required for authentication and security. We do not use advertising cookies or third-party tracking pixels. Anonymized usage analytics help us understand which features are most valuable so we can improve the platform.</p>
          </section>

          <section>
            <h2 className="text-white font-black text-xl mb-3">9. Children's Privacy</h2>
            <p>HireMax is not directed at children under 16 years of age. We do not knowingly collect personal data from children. If you believe a minor has provided us with personal data, contact us immediately at <a href="mailto:hiremax.ai@gmail.com" className="text-blue-400 hover:text-blue-300 underline">hiremax.ai@gmail.com</a>.</p>
          </section>

          <section>
            <h2 className="text-white font-black text-xl mb-3">10. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of material changes by updating the "Last Updated" date and, where appropriate, sending a notification to your registered email address. Continued use of HireMax after changes constitutes acceptance of the updated policy.</p>
          </section>

          <section>
            <h2 className="text-white font-black text-xl mb-3">11. Contact Us</h2>
            <p>For any privacy-related questions, data requests, or concerns, please contact our privacy team at:</p>
            <p className="mt-2"><a href="mailto:hiremax.ai@gmail.com" className="text-blue-400 hover:text-blue-300 underline font-bold">hiremax.ai@gmail.com</a></p>
            <p className="mt-1 text-slate-400">We aim to respond to all privacy inquiries within 2 business days.</p>
          </section>

        </div>
      </div>
    </div>
  );
};

export default PrivacyView;
