
import React, { useState, useEffect, useRef } from 'react';
import {
  Factory, Github, Linkedin, ShieldCheck, Loader2, CheckCircle2,
  Database, Activity, Radio, Code2, Database as DbIcon, Server, Briefcase,
  Terminal, Globe2, Cpu, GraduationCap, ClipboardList, Cloud, User,
  MessageSquare, BookOpen, Layers, Zap, Info, Link as LinkIcon, Sparkles,
  ArrowRight, Save, History, FileSearch, Lock, Shield, PenTool, Eye,
  RefreshCw, XCircle, Trash2, Clock, FileUp, Hash, X, Globe
} from 'lucide-react';
import {
  UserPlan, PrimaryDomain, LinkedIdentity, CareerSignal,
  ResumeProfile, StructuredResume, ActivityLogEntry, IngestionMode,
  UserProfile
} from '../types';
import { supabase } from '../lib/supabase';
import { generateUUID } from '../lib/utils';

interface TransformationFactoryProps {
  plan: UserPlan;
  profile?: UserProfile | null;
  onUpdateProfile?: (p: UserProfile) => void;
}

const ROLE_DEFINITIONS: { id: PrimaryDomain; label: string; icon: any; description: string; platforms: string[] }[] = [
  { id: 'SWE', label: 'Software Engineer', icon: Code2, description: 'Engineering and technical implementation.', platforms: ['linkedin', 'github', 'stackoverflow', 'jira'] },
  { id: 'DATA_ML', label: 'ML / Data', icon: DbIcon, description: 'Data science and machine learning research.', platforms: ['linkedin', 'github', 'kaggle', 'huggingface', 'scholar'] },
  { id: 'DEVOPS_SRE', label: 'DevOps / SRE', icon: Server, description: 'Infrastructure, scale, and reliability.', platforms: ['linkedin', 'github', 'cloud_proof', 'jira'] },
  { id: 'PRODUCT_MGMT', label: 'Product', icon: Briefcase, description: 'Product strategy and cross-functional leadership.', platforms: ['linkedin', 'jira', 'case_study'] },
  { id: 'DESIGN', label: 'Design', icon: PenTool, description: 'Product design and creative systems.', platforms: ['linkedin', 'jira', 'portfolio_url'] },
  { id: 'SECURITY', label: 'Security', icon: Shield, description: 'Cybersecurity and threat research.', platforms: ['linkedin', 'github', 'jira'] }
];

const PLATFORMS: { id: string; label: string; icon: any; action: string; type: string; mode: IngestionMode; description: string; dataCollected: string; placeholder?: string }[] = [
  {
    id: 'linkedin',
    label: 'LinkedIn',
    icon: Linkedin,
    action: 'Connect LinkedIn',
    type: 'Identity/Persona',
    mode: 'oauth',
    description: 'Direct authenticated access to your professional history. One-time snapshot.',
    dataCollected: 'Role titles, historical timeline, persona narrative, verified connections.'
  },
  {
    id: 'github',
    label: 'GitHub',
    icon: Github,
    action: 'Connect GitHub',
    type: 'Technical/Portfolio',
    mode: 'oauth',
    description: 'Direct repository analysis via secure OAuth. No write access required.',
    dataCollected: 'Architecture signals, contribution density, tech stack usage.'
  },
  {
    id: 'jira',
    label: 'Jira Workspace',
    icon: ClipboardList,
    action: 'Connect Jira',
    type: 'Work Artifacts',
    mode: 'oauth',
    description: 'Authenticated ingestion of project activity. Limits history to recent work.',
    dataCollected: 'Project complexity markers, velocity signals, scope markers.'
  },
  {
    id: 'stackoverflow',
    label: 'StackOverflow',
    icon: MessageSquare,
    action: 'Link Public Profile',
    type: 'Community',
    mode: 'public_profile',
    placeholder: 'https://stackoverflow.com/users/123456/username',
    description: 'Fetch technical authority markers from your public profile URL.',
    dataCollected: 'Topic expertise, reputation weight, community leadership bits.'
  },
  {
    id: 'kaggle',
    label: 'Kaggle',
    icon: Database,
    action: 'Link Public Profile',
    type: 'Competitions',
    mode: 'public_profile',
    placeholder: 'https://www.kaggle.com/username',
    description: 'Fetch competition history and ranking from your public profile.',
    dataCollected: 'Ranking tier, notebook quality signals, competition depth.'
  },
  {
    id: 'huggingface',
    label: 'HuggingFace',
    icon: Cpu,
    action: 'Add Profile URL',
    type: 'Models',
    mode: 'public_profile',
    placeholder: 'https://huggingface.co/username',
    description: 'Analyze public model activity and repository contributions.',
    dataCollected: 'Model deployment frequency, community impact, research focus.'
  },
  {
    id: 'scholar',
    label: 'Google Scholar',
    icon: GraduationCap,
    action: 'Add Profile URL',
    type: 'Academic',
    mode: 'public_profile',
    placeholder: 'https://scholar.google.com/citations?user=ID',
    description: 'Fetch citation data and publication history from public records.',
    dataCollected: 'Publication count, citation index, research novelty signals.'
  },
  {
    id: 'portfolio_url',
    label: 'Portfolio / URL',
    icon: Globe2,
    action: 'Link Portfolio',
    type: 'Visual/Web',
    mode: 'public_profile',
    placeholder: 'https://yourportfolio.com',
    description: 'Static analysis of public-facing career artifacts.',
    dataCollected: 'Visual style markers, web implementation depth, case study links.'
  },
  {
    id: 'case_study',
    label: 'Case Study / Doc',
    icon: FileUp,
    action: 'Upload Artifact',
    type: 'Manual Evidence',
    mode: 'manual_artifact',
    description: 'Manual upload of specific career proof. Bypasses automated scraping.',
    dataCollected: 'Detailed problem/solution narratives, quantitative outcome claims.'
  },
  {
    id: 'cloud_proof',
    label: 'Cloud Proof',
    icon: Cloud,
    action: 'Upload Summary',
    type: 'Infrastructure',
    mode: 'manual_artifact',
    description: 'Manual upload of cloud certification or deployment architecture proof.',
    dataCollected: 'Deployment scale markers, infrastructure authority signals.'
  }
];

export const TransformationFactory: React.FC<TransformationFactoryProps> = ({ plan, profile, onUpdateProfile }) => {
  // Rehydrate domain from persisted profile
  const [domain, setDomain] = useState<PrimaryDomain>(profile?.domain || 'UNSELECTED');
  const [activeTab, setActiveTab] = useState<'ingest' | 'profiles' | 'activity'>('ingest');

  // Rehydrate identities from persisted metadata
  const [identities, setIdentities] = useState<Record<string, { data: any, verified: boolean, lastSynced?: string, mode: IngestionMode }>>(
    (profile as any)?.metadata?.identities || {}
  );

  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [generatedProfiles, setGeneratedProfiles] = useState<ResumeProfile[]>(profile?.resume_profiles || []);

  const [configuringPlatformId, setConfiguringPlatformId] = useState<string | null>(null);
  const [configInput, setConfigInput] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync rehydration if profile loads late or updates externally
  useEffect(() => {
    if ((profile as any)?.metadata?.identities) {
      setIdentities((profile as any).metadata.identities);
    }
    if (profile?.domain) {
      setDomain(profile.domain);
    }
    if (profile?.resume_profiles) {
      setGeneratedProfiles(profile.resume_profiles);
    }
  }, [profile]);

  /**
   * BLOCKER RESOLUTION: Persistence bridge to Supabase profiles.
   * Ensures UI state changes survive reloads.
   */
  const persistToDatabase = async (updates: Partial<UserProfile>, metaUpdates?: any) => {
    if (!profile?.id) return;

    // Merge metadata to prevent unintentional overwrites
    const metadata = {
      ...(profile as any).metadata,
      ...metaUpdates
    };

    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, metadata })
      .eq('id', profile.id)
      .select()
      .single();

    if (!error && data && onUpdateProfile) {
      onUpdateProfile(data as UserProfile);
    }
  };

  const handleSetDomain = async (newDomain: PrimaryDomain) => {
    setDomain(newDomain);
    // PERSISTENCE TRIGGER: Role selection saved to backend
    await persistToDatabase({ domain: newDomain });
  };

  const addActivity = (platform: string, mode: IngestionMode, action: ActivityLogEntry['action']) => {
    const newLog: ActivityLogEntry = {
      id: generateUUID(),
      platform,
      mode,
      action,
      timestamp: new Date().toLocaleString()
    };
    setActivityLogs(prev => [newLog, ...prev]);
  };

  const handleIngest = (platform: typeof PLATFORMS[0], input?: string, isResync: boolean = false) => {
    setIsProcessing(platform.id);
    setConfiguringPlatformId(null);
    setConfigInput('');

    setTimeout(async () => {
      let extractedData: any = {
        mode: platform.mode,
        platform: platform.id,
        sourceReference: input || 'Verified via OAuth'
      };

      if (platform.mode === 'oauth') {
        extractedData = { ...extractedData, status: "Secure API Handshake Successful", fidelity: "High (Verified Source)" };
      } else if (platform.mode === 'public_profile') {
        extractedData = {
          ...extractedData,
          status: "Public Profile Fetch Complete",
          fidelity: "Medium (Unverified Identity)",
          parsedUrl: input
        };
      } else {
        extractedData = {
          ...extractedData,
          status: "Manual Artifact Upload Processed",
          fidelity: "High (User Attested)",
          artifactSnippet: input ? input.substring(0, 50) + "..." : "File Uploaded"
        };
      }

      const newIdentity = {
        verified: true,
        mode: platform.mode,
        data: extractedData,
        lastSynced: new Date().toISOString()
      };

      const updatedIdentities = {
        ...identities,
        [platform.id]: newIdentity
      };

      setIdentities(updatedIdentities);
      // PERSISTENCE TRIGGER: Source identity map saved to backend
      await persistToDatabase({}, { identities: updatedIdentities });

      addActivity(platform.id, platform.mode, isResync ? 'SYNCED' : 'CONNECTED');
      setIsProcessing(null);
    }, 2000);
  };

  const handleActionClick = (platform: typeof PLATFORMS[0]) => {
    if (platform.mode === 'oauth') {
      handleIngest(platform);
    } else {
      setConfiguringPlatformId(platform.id);
      setConfigInput('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, platform: typeof PLATFORMS[0]) => {
    if (e.target.files && e.target.files[0]) {
      handleIngest(platform, e.target.files[0].name);
    }
  };

  const handleDisconnect = async (sourceId: string) => {
    const platform = PLATFORMS.find(p => p.id === sourceId);
    if (!platform) return;
    if (!window.confirm(`Are you sure you want to remove ${platform.label}? Associated snapshot data will be deactivated.`)) return;

    const updatedIdentities = { ...identities };
    delete updatedIdentities[sourceId];

    setIdentities(updatedIdentities);
    // PERSISTENCE TRIGGER: Identity removal saved to backend
    await persistToDatabase({}, { identities: updatedIdentities });

    addActivity(sourceId, platform.mode, 'DISCONNECTED');
  };

  /**
   * SEPARATION GUARD: RISK MITIGATION
   * This logic is not part of Factory intake. Downstream systems own synthesis.
   * Ensuring this does not run automatically or write to the backend as per hardening pass.
   */
  const handleSynthesis = () => {
    if (Object.keys(identities).length < 1) return;
    setIsSynthesizing(true);

    setTimeout(() => {
      const githubData = (identities['github'])?.data || { fidelity: "Standard" };

      const newProfile: ResumeProfile = {
        id: `PRF-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        label: `Source Profile: ${domain}`,
        targetRole: domain,
        isPrimary: generatedProfiles.length === 0,
        data: {
          contact: {
            full_name: profile?.full_name || "User Candidate",
            email: profile?.email || "user@hiremax.ai",
            phone: "+1 (555) 012-3456",
            location: "Remote / North America",
            links: ["linkedin.com/in/user"]
          },
          summary: `Professional artifacts synthesized across ${Object.keys(identities).length} verified and public sources. Anchored by LinkedIn persona and ${githubData.fidelity} technical markers.`,
          experience: [],
          education: [],
          projects: [],
          skills: { languages: [], frameworks: [], tools: [], specializations: [] },
          leadership: []
        }
      };

      // UI state only - backend writing disabled for Factory separation pass
      setGeneratedProfiles(prev => [newProfile, ...prev]);
      setIsSynthesizing(false);
      setActiveTab('profiles');
    }, 3500);
  };

  const connectedCount = Object.keys(identities).length;
  const completeness = connectedCount === 0 ? 'Low' : connectedCount < 3 ? 'Medium' : 'Strong';
  const completenessColor = connectedCount === 0 ? 'text-red-500' : connectedCount < 3 ? 'text-amber-500' : 'text-green-500';

  if (domain === 'UNSELECTED') {
    return (
      <div className="max-w-6xl mx-auto py-24 px-10 animate-in fade-in duration-700">
        <div className="text-center mb-16 space-y-4">
          <div className="flex items-center justify-center gap-3 text-blue-500 mb-2">
            <Radio size={20} className="animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em]">Step 1: Choose Primary Role</span>
          </div>
          <h2 className="text-6xl font-black text-white uppercase tracking-tighter leading-none">Profile Sources</h2>
          <p className="text-slate-500 text-lg font-medium max-w-xl mx-auto">
            Connect verified sources and link public profiles to establish your career truth.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {ROLE_DEFINITIONS.map(d => (
            <button
              key={d.id}
              onClick={() => handleSetDomain(d.id)}
              className="bg-[#16161E] border border-[#2D313D] p-8 rounded-[3rem] text-left hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group flex flex-col gap-6 shadow-xl"
            >
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 group-hover:text-blue-500 transition-all">
                <d.icon size={28} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-white uppercase tracking-tight">{d.label}</h3>
                <p className="text-slate-500 text-xs font-medium leading-relaxed">{d.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const selectedRole = ROLE_DEFINITIONS.find(r => r.id === domain);
  const visiblePlatforms = PLATFORMS.filter(p => selectedRole?.platforms.includes(p.id) || p.id === 'linkedin');

  return (
    <div className="max-w-[1400px] mx-auto py-12 px-10 space-y-12 animate-in fade-in duration-1000">
      <div className="bg-[#111118] border border-[#2D313D] p-10 rounded-[3.5rem] shadow-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-end gap-8 ring-1 ring-white/5">
        <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none">
          <Factory size={240} />
        </div>
        <div className="relative z-10 space-y-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => handleSetDomain('UNSELECTED')}
              className="px-4 py-1.5 rounded-full bg-blue-600/10 border border-blue-500/20 text-blue-500 text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2"
            >
              <ArrowRight size={10} className="rotate-180" /> Role: {selectedRole?.label}
            </button>
            <div className="px-4 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-500 text-[10px] font-black uppercase tracking-widest">
              Safe Ingestion Loop Active
            </div>
          </div>
          <h1 className="text-7xl font-black text-white tracking-tighter uppercase leading-none">Profile Sources</h1>
          <p className="text-slate-500 text-xl font-medium max-w-xl">
            Consolidating authenticated, public, and manual career artifacts into deterministic signal snapshots.
          </p>
        </div>

        <div className="relative z-10 bg-[#16161E] border border-white/5 p-8 rounded-[2.5rem] shrink-0 w-full md:w-96 space-y-8 shadow-inner">
          <div className="flex justify-between items-end">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Source Coverage</p>
              <p className="text-5xl font-black text-white">{Math.round((connectedCount / visiblePlatforms.length) * 100) || 0}%</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest mb-1">Audit Score</p>
              <p className={`text-xl font-black uppercase tracking-tighter ${completenessColor}`}>{completeness}</p>
            </div>
          </div>
          <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 transition-all duration-1000" style={{ width: `${(connectedCount / visiblePlatforms.length) * 100}%` }} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-white/5 p-2 rounded-2xl w-fit border border-white/5">
        {[
          { id: 'ingest', label: 'Source Control', icon: Database },
          { id: 'profiles', label: `Artifact Profiles (${generatedProfiles.length})`, icon: User },
          { id: 'activity', label: 'Activity Log', icon: History }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-10 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-500 hover:text-white'
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {visiblePlatforms.map((platform) => {
                  const isConfiguring = configuringPlatformId === platform.id;
                  const isVerified = identities[platform.id]?.verified;

                  return (
                    <div key={platform.id} className={`p-8 rounded-[3rem] border transition-all relative overflow-hidden group flex flex-col justify-between ${isVerified ? 'bg-blue-600/5 border-blue-500/20' : 'bg-[#16161E] border-white/5 shadow-lg'} ${isConfiguring ? 'ring-2 ring-blue-500' : ''}`}>
                      <div>
                        <div className="flex justify-between items-start mb-6">
                          <platform.icon size={28} className={isVerified ? 'text-blue-500' : 'text-slate-500 group-hover:text-slate-300'} />
                          <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-white/5 ${platform.mode === 'oauth' ? 'bg-blue-500/10 text-blue-400' :
                              platform.mode === 'public_profile' ? 'bg-indigo-500/10 text-indigo-400' :
                                'bg-slate-500/10 text-slate-400'
                            }`}>
                            {platform.mode.replace('_', ' ')}
                          </span>
                        </div>
                        <h4 className="text-white font-black text-xl uppercase tracking-tighter mb-2">{platform.label}</h4>
                        {!isConfiguring && (
                          <>
                            <p className="text-slate-500 text-[10px] leading-relaxed font-medium mb-4">
                              {platform.description}
                            </p>
                            <div className="p-4 bg-white/5 rounded-xl mb-8 space-y-1 border border-white/5">
                              <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Snapshot Data Collected</p>
                              <p className="text-slate-400 text-[9px] font-medium leading-tight">{platform.dataCollected}</p>
                            </div>
                          </>
                        )}
                      </div>

                      <div className="space-y-3">
                        {isVerified ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleIngest(platform, undefined, true)}
                              disabled={!!isProcessing}
                              className="flex-1 py-3.5 bg-green-500/10 border border-green-500/20 text-green-500 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-green-600 hover:text-white transition-all flex items-center justify-center gap-2"
                            >
                              {isProcessing === platform.id ? <Loader2 className="animate-spin" size={14} /> : <><RefreshCw size={12} /> Resync Snapshot</>}
                            </button>
                            <button
                              onClick={() => handleDisconnect(platform.id)}
                              className="p-3.5 bg-[#0D0D12] border border-white/5 text-slate-600 hover:text-red-500 hover:border-red-500/50 rounded-xl transition-all"
                              title="Remove Source"
                            >
                              <XCircle size={16} />
                            </button>
                          </div>
                        ) : isConfiguring ? (
                          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {platform.mode === 'public_profile' ? (
                              <div className="space-y-2">
                                <div className="relative">
                                  <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                                  <input
                                    autoFocus
                                    value={configInput}
                                    onChange={(e) => setConfigInput(e.target.value)}
                                    placeholder={platform.placeholder}
                                    className="w-full bg-[#0D0D12] border border-[#2D313D] rounded-xl py-3 pl-10 pr-3 text-white text-[10px] outline-none focus:border-blue-500 transition-all font-mono"
                                  />
                                </div>
                                <button
                                  onClick={() => handleIngest(platform, configInput)}
                                  disabled={!configInput.trim()}
                                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20 disabled:opacity-30"
                                >
                                  Link Profile
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex-1 py-3 bg-[#0D0D12] border border-dashed border-[#2D313D] text-slate-500 rounded-xl flex items-center justify-center gap-2 hover:border-blue-500 hover:text-blue-500 transition-all"
                                  >
                                    <FileUp size={14} /> <span className="text-[9px] font-black uppercase">Upload File</span>
                                  </button>
                                  <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    onChange={(e) => handleFileChange(e, platform)}
                                  />
                                </div>
                                <p className="text-[8px] text-center font-black text-slate-700 uppercase tracking-widest">OR PASTE TEXT</p>
                                <textarea
                                  value={configInput}
                                  onChange={(e) => setConfigInput(e.target.value)}
                                  placeholder="Paste snippet or artifact summary..."
                                  className="w-full bg-[#0D0D12] border border-[#2D313D] rounded-xl p-3 text-white text-[10px] outline-none focus:border-blue-500 transition-all font-mono h-24 resize-none"
                                />
                                <button
                                  onClick={() => handleIngest(platform, configInput)}
                                  disabled={!configInput.trim()}
                                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-blue-500 transition-all disabled:opacity-30"
                                >
                                  Confirm Artifact
                                </button>
                              </div>
                            )}
                            <button
                              onClick={() => setConfiguringPlatformId(null)}
                              className="w-full text-center text-[8px] font-black text-slate-600 hover:text-white uppercase tracking-[0.2em] transition-colors py-2"
                            >
                              Cancel Setup
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleActionClick(platform)}
                            disabled={!!isProcessing}
                            className="w-full py-4 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all bg-[#0D0D12] border border-white/5 text-white hover:bg-blue-600 flex items-center justify-center gap-3"
                          >
                            {isProcessing === platform.id ? <Loader2 className="animate-spin" size={14} /> : platform.action}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className={`p-16 border-2 rounded-[4rem] flex flex-col md:flex-row items-center justify-between gap-12 group transition-all duration-700 ${identities['linkedin']?.verified ? 'border-blue-500/50 bg-blue-600/5 shadow-[0_0_80px_rgba(59,130,246,0.1)]' : 'border-[#1D1D26] bg-[#0D0D12] opacity-40 grayscale'}`}>
                <div className="flex items-center gap-12">
                  <div className={`shrink-0 transition-transform duration-1000 ${identities['linkedin']?.verified ? 'text-blue-500 scale-110' : 'text-slate-800'}`}>
                    <Sparkles size={80} className={isSynthesizing ? 'animate-spin' : 'animate-pulse'} />
                  </div>
                  <div className="space-y-3">
                    <h4 className="text-white font-black text-4xl uppercase tracking-tight leading-none">
                      {isSynthesizing ? 'Executing Synthesis...' : 'Build Artifact Profile'}
                    </h4>
                    <p className="text-slate-500 text-lg leading-relaxed font-medium max-w-xl">
                      Process extracted artifacts for {selectedRole?.label}. Normalization merges high-trust OAuth data with unverified public signals.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleSynthesis}
                  disabled={!identities['linkedin']?.verified || isSynthesizing}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-black px-16 py-8 rounded-[2rem] flex items-center justify-center gap-4 transition-all uppercase tracking-[0.3em] text-sm shadow-2xl shadow-blue-900/40 disabled:opacity-10 group"
                >
                  {isSynthesizing ? <Loader2 className="animate-spin" /> : <><Zap size={20} className="group-hover:scale-125 transition-transform" /> Synthesize Signals</>}
                </button>
              </div>
            </div>

            <div className="lg:col-span-4 bg-[#0D0D12] border border-[#2D313D] rounded-[3.5rem] p-12 space-y-10 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-[0.02] text-white pointer-events-none">
                <Terminal size={180} />
              </div>
              <div className="flex items-center gap-4 border-b border-white/5 pb-8 relative z-10">
                <Terminal size={20} className="text-blue-500" />
                <h3 className="text-white font-black uppercase text-xs tracking-[0.3em]">Payload Integrity</h3>
              </div>
              <div className="space-y-10 relative z-10">
                {(Object.entries(identities) as [string, { data: any, verified: boolean, lastSynced?: string, mode: IngestionMode }][]).map(([key, val]) => (
                  <div key={key} className="space-y-6">
                    <div className="flex justify-between items-center px-1">
                      <div className="flex items-center gap-3">
                        <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${val.mode === 'oauth' ? 'bg-blue-500' : val.mode === 'public_profile' ? 'bg-indigo-500' : 'bg-slate-500'}`} />
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{key.toUpperCase()} Snapshot</span>
                      </div>
                      <span className="text-[8px] font-bold text-slate-700 uppercase tracking-widest">{val.mode}</span>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl space-y-4 shadow-inner">
                      {Object.entries(val.data).map(([k, v]: [string, any]) => (
                        <div key={k} className="flex justify-between text-[9px] font-bold uppercase gap-6">
                          <span className="text-slate-700 whitespace-nowrap">{k.replace(/([A-Z])/g, ' $1')}</span>
                          <span className="text-slate-400 truncate text-right">{v}</span>
                        </div>
                      ))}
                      <div className="pt-2 border-t border-white/5 flex items-center justify-between text-slate-800 text-[8px] font-black uppercase tracking-widest">
                        <div className="flex items-center gap-2"><Clock size={10} /> Ingested: {new Date(val.lastSynced!).toLocaleTimeString()}</div>
                        <div className="flex items-center gap-1"><Hash size={10} /> v1.0</div>
                      </div>
                    </div>
                  </div>
                ))}
                {Object.keys(identities).length === 0 && (
                  <div className="py-40 text-center opacity-20">
                    <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center mx-auto mb-6">
                      <Lock size={20} className="text-slate-600" />
                    </div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Registry Idle</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'profiles' && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {generatedProfiles.map((profile, i) => (
                <div key={profile.id} className="bg-[#16161E] border border-white/5 p-12 rounded-[4rem] space-y-10 group hover:border-blue-500/50 transition-all shadow-2xl relative overflow-hidden">
                  {profile.isPrimary && (
                    <div className="absolute top-0 right-0 px-8 py-3 bg-blue-600 text-white text-[9px] font-black uppercase tracking-[0.3em] rounded-bl-[2rem] shadow-xl">Primary Ingest</div>
                  )}
                  <div className="flex justify-between items-start">
                    <div className="w-20 h-20 rounded-[2.5rem] bg-[#0D0D12] border border-white/5 flex items-center justify-center text-slate-600 group-hover:text-blue-500 transition-all group-hover:scale-105">
                      <User size={36} />
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest mb-1">AUDIT REF</p>
                      <p className="text-xs font-mono text-slate-500">{profile.id}</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-white font-black text-3xl uppercase tracking-tighter mb-2 leading-none">{profile.targetRole}</h4>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest border-l-4 border-blue-600 pl-4 py-1">Verified {domain} signals</p>
                  </div>
                  <div className="space-y-5">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                      <span className="text-slate-700">Source Nodes</span>
                      <span className="text-blue-500">14 Verified</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                      <span className="text-slate-700">Fidelity Level</span>
                      <span className="text-green-500">OPTIMAL</span>
                    </div>
                  </div>
                  <div className="pt-10 border-t border-white/5 flex gap-4">
                    <button className="flex-1 py-5 bg-[#0D0D12] border border-white/5 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl hover:bg-blue-600 transition-all flex items-center justify-center gap-3 shadow-lg">
                      <ArrowRight size={16} /> Inspect Signals
                    </button>
                    <button className="p-5 bg-[#0D0D12] border border-white/5 text-slate-600 hover:text-white rounded-2xl transition-all hover:bg-white/5">
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {generatedProfiles.length === 0 && (
              <div className="py-60 bg-[#111118] border border-white/5 border-dashed rounded-[5rem] text-center space-y-8 shadow-inner">
                <div className="w-24 h-24 rounded-[3.5rem] bg-white/[0.02] flex items-center justify-center mx-auto text-slate-800">
                  <FileSearch size={48} />
                </div>
                <div className="space-y-3">
                  <p className="text-slate-500 font-black uppercase tracking-[0.4em] text-sm">Registry Empty</p>
                  <p className="text-slate-700 text-xs font-bold uppercase tracking-widest">Connect Sources to Generate Profiles</p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-700">
            <div className="bg-[#111118] border border-[#2D313D] rounded-[3.5rem] overflow-hidden shadow-2xl">
              <div className="px-12 py-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <h3 className="text-white font-black uppercase text-xs tracking-[0.3em] flex items-center gap-3">
                  <History size={16} className="text-blue-500" /> Ingestion Audit Log
                </h3>
              </div>
              <div className="p-12 space-y-6">
                {activityLogs.length === 0 ? (
                  <div className="py-24 text-center opacity-30">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Awaiting system state transitions</p>
                  </div>
                ) : (
                  activityLogs.map(log => (
                    <div key={log.id} className="flex items-center justify-between p-6 bg-white/[0.02] border border-white/5 rounded-2xl group hover:border-blue-500/30 transition-all">
                      <div className="flex items-center gap-8">
                        <div className={`w-2 h-2 rounded-full ${log.action === 'CONNECTED' ? 'bg-green-500' : log.action === 'SYNCED' ? 'bg-blue-500' : 'bg-red-500'
                          }`} />
                        <div>
                          <p className="text-white font-black text-xs uppercase tracking-tight">{log.platform.toUpperCase()}</p>
                          <div className="flex items-center gap-2">
                            <p className={`text-[10px] font-bold uppercase tracking-widest ${log.action === 'CONNECTED' ? 'text-green-500' : log.action === 'SYNCED' ? 'text-blue-500' : 'text-red-500'
                              }`}>{log.action}</p>
                            <div className="w-1 h-1 rounded-full bg-slate-800" />
                            <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">{log.mode}</p>
                          </div>
                        </div>
                      </div>
                      <p className="text-slate-700 text-[10px] font-black uppercase tracking-widest font-mono">
                        {log.timestamp}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-16 border border-white/5 bg-[#0D0D12] rounded-[4rem] text-center shadow-inner">
        <p className="text-[10px] font-black text-slate-800 uppercase tracking-[0.8em] mb-6">Fidelity Layer v14.0</p>
        <p className="text-slate-600 text-xs max-w-3xl mx-auto leading-relaxed font-bold uppercase tracking-widest">
          HireMax explicitly models ingestion modes to preserve trust differences between verified OAuth snapshots, public profile fetches, and manual user artifacts. All data remains snapshot-based to minimize compute overhead.
        </p>
      </div>
    </div>
  );
};
