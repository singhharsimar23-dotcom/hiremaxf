
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Factory, Github, Linkedin, ShieldCheck, Loader2, CheckCircle2, 
  AlertCircle, ArrowRight, Database, Terminal, Layers, Send, Workflow,
  Fingerprint, Link as LinkIcon, Search, Zap, Globe, Activity, FileText,
  ShieldAlert, Download, ExternalLink, ChevronRight, Sparkles, ShieldX,
  History, Gavel, Trash2, Sliders, Eye, Target, AlertOctagon, Info, Radio,
  Lock, MonitorPlay, Code2, Database as DbIcon, Server, Briefcase, 
  Globe2, Cpu, GraduationCap, ClipboardList, Cloud, User
} from 'lucide-react';
import { 
  UserPlan, UserLifecycleState, PrimaryDomain, LinkedIdentity, CareerSignal,
  ResumeProfile
} from '../types';

interface TransformationFactoryProps {
  plan: UserPlan;
}

const DOMAINS: { id: PrimaryDomain; label: string; icon: any; description: string; sources: string[] }[] = [
  { id: 'SWE', label: 'Software Engineer', icon: Code2, description: 'Prioritize Technical Truth & Contribution signals.', sources: ['github', 'linkedin', 'stackoverflow', 'jira'] },
  { id: 'DATA_ML', label: 'ML / Data Scientist', icon: DbIcon, description: 'Focus on Modeling, Research & Kaggle signals.', sources: ['github', 'linkedin', 'kaggle', 'huggingface', 'scholar'] },
  { id: 'DEVOPS_SRE', label: 'DevOps / SRE', icon: Server, description: 'Focus on Infrastructure & Cloud proof signals.', sources: ['github', 'linkedin', 'cloud_proof'] },
  { id: 'PRODUCT_MGMT', label: 'Product Manager', icon: Briefcase, description: 'Prioritize Outcome & Project Signal proofs.', sources: ['linkedin', 'notion', 'jira', 'confluence'] }
];

export const TransformationFactory: React.FC<TransformationFactoryProps> = ({ plan }) => {
  const [domain, setDomain] = useState<PrimaryDomain>('UNSELECTED');
  const [activeTab, setActiveTab] = useState<'ingest' | 'profiles' | 'signals'>('ingest');
  const [identities, setIdentities] = useState<Record<string, LinkedIdentity>>({});
  const [signals, setSignals] = useState<CareerSignal[]>([]);
  const [profiles, setProfiles] = useState<ResumeProfile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const readinessScore = domain === 'UNSELECTED' ? 0 : 72; // Simulated

  const handleOAuth = (provider: 'github' | 'linkedin') => {
    setIsProcessing(true);
    setTimeout(() => {
      setIdentities(prev => ({
        ...prev,
        [provider]: {
          provider,
          scopeLevel: provider === 'github' ? 'full' : 'identity_only',
          verified: true,
          lastSync: new Date().toISOString()
        }
      }));
      setIsProcessing(false);
    }, 1500);
  };

  if (domain === 'UNSELECTED') {
    return (
      <div className="max-w-6xl mx-auto py-24 px-10 animate-in fade-in duration-700">
        <div className="text-center mb-16 space-y-4">
          <div className="flex items-center justify-center gap-3 text-blue-500 mb-2">
            <Radio size={20} className="animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em]">Initialize Career Perimeter</span>
          </div>
          <h2 className="text-6xl font-black text-white uppercase tracking-tighter">Factory Setup</h2>
          <p className="text-slate-500 text-lg font-medium max-w-xl mx-auto">
            Build your professional truth source by selecting your primary domain and ingesting technical artifacts.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {DOMAINS.map(d => (
            <button 
              key={d.id}
              onClick={() => setDomain(d.id)}
              className="bg-[#16161E] border border-[#2D313D] p-10 rounded-[3rem] text-left hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group flex items-start gap-8"
            >
              <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 group-hover:text-blue-500 transition-all">
                <d.icon size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-white uppercase tracking-tight">{d.label}</h3>
                <p className="text-slate-500 text-sm font-medium leading-relaxed">{d.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto py-12 px-10 space-y-12">
      <div className="bg-[#111118] border border-[#2D313D] p-10 rounded-[3.5rem] shadow-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-end gap-8">
         <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none">
            <Factory size={240} />
         </div>
         <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-4">
              <div className="px-4 py-1.5 rounded-full bg-blue-600/10 border border-blue-500/20 text-blue-500 text-[10px] font-black uppercase tracking-widest">
                Domain: {domain}
              </div>
              <div className="px-4 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-500 text-[10px] font-black uppercase tracking-widest">
                READY FOR EXECUTION
              </div>
            </div>
            <h1 className="text-6xl font-black text-white tracking-tighter uppercase leading-none">Transformation Factory</h1>
            <p className="text-slate-500 text-lg font-medium max-w-xl">
               The internal source of truth. Manage ingestion, signal normalization, and persistent resume variants.
            </p>
         </div>

         <div className="relative z-10 bg-[#16161E] border border-white/5 p-8 rounded-[2.5rem] shrink-0 w-full md:w-96 space-y-8">
            <div className="flex justify-between items-end">
               <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Signal Coverage</p>
                  <p className="text-4xl font-black text-white">{readinessScore}%</p>
               </div>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
               <div className="h-full bg-blue-600" style={{ width: `${readinessScore}%` }} />
            </div>
         </div>
      </div>

      <div className="flex items-center gap-4 bg-white/5 p-2 rounded-2xl w-fit border border-white/5">
         {[
           { id: 'ingest', label: 'Ingestion Control', icon: Database },
           { id: 'profiles', label: 'Resume Profiles (5)', icon: User },
           { id: 'signals', label: 'Signal Map', icon: Activity }
         ].map(tab => (
           <button 
             key={tab.id}
             onClick={() => setActiveTab(tab.id as any)}
             className={`flex items-center gap-2 px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
               activeTab === tab.id ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-500 hover:text-white'
             }`}
           >
             <tab.icon size={14} /> {tab.label}
           </button>
         ))}
      </div>

      <div className="min-h-[600px]">
        {activeTab === 'ingest' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
             <div className="lg:col-span-8 space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className={`p-8 rounded-[2.5rem] border transition-all ${identities.github?.verified ? 'bg-green-600/5 border-green-500/20' : 'bg-[#16161E] border-white/5'}`}>
                      <Github size={24} className="mb-8" />
                      <h4 className="text-white font-black text-xl uppercase tracking-tighter mb-2">GitHub Control</h4>
                      <p className="text-slate-500 text-xs font-medium leading-relaxed mb-8">Technical Truth: Repos, Commits, & README extraction.</p>
                      <button onClick={() => handleOAuth('github')} className="w-full py-4 rounded-2xl bg-[#0D0D12] border border-white/5 text-white font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 transition-all">
                        {identities.github?.verified ? 'Connected' : 'Handshake'}
                      </button>
                   </div>
                   <div className={`p-8 rounded-[2.5rem] border transition-all ${identities.linkedin?.verified ? 'bg-indigo-600/5 border-indigo-500/20' : 'bg-[#16161E] border-white/5'}`}>
                      <Linkedin size={24} className="mb-8" />
                      <h4 className="text-white font-black text-xl uppercase tracking-tighter mb-2">LinkedIn Verify</h4>
                      <p className="text-slate-500 text-xs font-medium leading-relaxed mb-8">Verification only. No activity ingestion allowed.</p>
                      <button onClick={() => handleOAuth('linkedin')} className="w-full py-4 rounded-2xl bg-[#0D0D12] border border-white/5 text-white font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all">
                        {identities.linkedin?.verified ? 'Verified' : 'Identity Only'}
                      </button>
                   </div>
                </div>
                <div className="bg-[#16161E] border border-white/5 p-10 rounded-[3rem] relative overflow-hidden group">
                   <ClipboardList size={20} className="text-indigo-500 mb-8" />
                   <h4 className="text-white font-black text-lg uppercase tracking-tight mb-4">Enterprise Proof Upload</h4>
                   <p className="text-slate-500 text-sm leading-relaxed mb-8">Upload Jira summaries or project snapshots to extract deterministic internal metrics.</p>
                   <div className="w-full h-32 border-2 border-dashed border-white/5 bg-[#0D0D12] rounded-3xl flex flex-col items-center justify-center gap-3 text-slate-700 hover:border-indigo-500/50 transition-all cursor-pointer">
                      <Cloud size={24} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Drop Achievement Proofs</span>
                   </div>
                </div>
             </div>
             <div className="lg:col-span-4 bg-[#0D0D12] border border-[#2D313D] rounded-[3rem] p-10 space-y-8">
                <h3 className="text-white font-black uppercase text-xs tracking-widest">Signal Integrity Standard</h3>
                <p className="text-slate-500 text-xs leading-relaxed font-medium">The Factory strictly isolates PII from matching loops. All matching is based on normalized signals created here.</p>
                <div className="space-y-4">
                   {['SOC-2 Compliance', 'Encrypted Handshakes', 'Zero-Loss Parsing'].map(x => (
                     <div key={x} className="flex items-center gap-3 text-[10px] font-black text-slate-700 uppercase tracking-widest">
                        <CheckCircle2 size={14} className="text-green-500" /> {x}
                     </div>
                   ))}
                </div>
             </div>
          </div>
        )}

        {activeTab === 'profiles' && (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="bg-[#16161E] border border-white/5 p-8 rounded-[2.5rem] space-y-6 group hover:border-blue-500 transition-all shadow-xl">
                   <div className="flex justify-between items-start">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-slate-600 group-hover:text-blue-500">
                        <User size={24} />
                      </div>
                      {i === 1 && <span className="text-[8px] font-black uppercase tracking-widest bg-blue-600 text-white px-2 py-1 rounded">Primary</span>}
                   </div>
                   <h4 className="text-white font-black text-xl uppercase tracking-tighter">Profile #{i}</h4>
                   <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Target: Backend Engineer / Infrastructure</p>
                   <button className="w-full py-3 bg-[#0D0D12] border border-white/5 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-white/5">Edit Profile Structure</button>
                </div>
              ))}
           </div>
        )}

        {activeTab === 'signals' && (
          <div className="bg-[#111118] border border-[#2D313D] rounded-[3rem] p-12 text-center space-y-4">
             <Activity size={48} className="text-blue-500 mx-auto mb-6" />
             <h3 className="text-2xl font-black text-white uppercase tracking-tight">Normalized Signal Radar</h3>
             <p className="text-slate-500 max-w-xl mx-auto font-medium">Visualization of extracted technical metrics used by the Applications Engine.</p>
          </div>
        )}
      </div>
    </div>
  );
};
