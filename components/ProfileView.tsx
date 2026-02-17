"use client";

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
    Shield,
    Linkedin,
    Github,
    Mail,
    GraduationCap,
    Activity,
    ShieldCheck,
    Lock,
    Clock,
    RefreshCcw,
    Link as LinkIcon,
    AlertCircle,
    FileText,
    UploadCloud,
    ChevronDown,
    ChevronUp,
    Info,
    CheckCircle2,
    XCircle,
    Loader2,
    AlertTriangle,
    ExternalLink,
    TrendingUp,
    Zap as ZapIcon,
    Heart,
    Database,
    Cpu,
    Terminal,
    MessageSquare,
    BookOpen,
    Fingerprint,
    Container,
    Package,
    Rocket,
    Building2,
    Globe,
    Code2,
    Book,
    FileCode
} from 'lucide-react';
import { SkillEvidenceBreakdown } from './profile/SkillEvidenceBreakdown';
import { DecayingSignalsWidget } from './profile/DecayingSignalsWidget';
import { CorroborationIndicator } from './profile/CorroborationIndicator';
import { QuickWins } from './profile/QuickWins';
import { ProfileHealthDashboard } from './profile/ProfileHealthDashboard';

// Type definitions for proper TypeScript support
interface ProfileSnapshot {
    id: string;
    user_id: string;
    version: number;
    verification_state: 'VERIFIED' | 'INCOMPLETE' | 'PENDING';
    evidence_coverage_percentage: number;
    coverage_by_source: {
        linkedin: boolean;
        github: boolean;
        gmail: boolean;
        external: boolean;
    };
    signal_health?: {
        identity_verified: boolean;
        skills_count: number;
        projects_count: number;
        overall_score: number;
        component_scores?: {
            completeness: number;
            verification: number;
            quality: number;
            recency: number;
        }
    };
    freshness_vector?: Record<string, string>;
    snapshot_data: any;
    created_at: string;
}

interface IntegrityEvent {
    id: string;
    user_id: string;
    event_type: 'INGESTION' | 'SYSTEM' | 'ERROR' | 'SECURITY';
    source: string | null;
    message: string;
    metadata: Record<string, unknown>;
    timestamp: string;
}

interface EvidenceItem {
    id: string;
    user_id: string;
    claim_type: string;
    source: string;
    claim_data: Record<string, unknown>;
    state: 'ACTIVE' | 'REVOKED' | 'PENDING';
    ingested_at: string;
}

type FilterType = 'ALL' | 'INGESTION' | 'SECURITY';

export const ProfileView: React.FC = () => {
    const [snapshot, setSnapshot] = useState<ProfileSnapshot | null>(null);
    const [integrityLogs, setIntegrityLogs] = useState<IntegrityEvent[]>([]);
    const [manualEvidence, setManualEvidence] = useState<EvidenceItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [resyncing, setResyncing] = useState<string | null>(null);
    const [externalUrl, setExternalUrl] = useState('');
    const [ingestingUrl, setIngestingUrl] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('Initializing profile...');
    const [showFreshnessVector, setShowFreshnessVector] = useState(false);
    const [logFilter, setLogFilter] = useState<FilterType>('ALL');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const [scholarUrlInput, setScholarUrlInput] = useState('');
    const [showScholarInput, setShowScholarInput] = useState(false);
    const [commandStatuses, setCommandStatuses] = useState<Record<string, string>>({});
    const abortControllerRef = useRef<AbortController | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [viewMode, setViewMode] = useState<'standard' | 'health'>('standard');
    const [strengthHistory, setStrengthHistory] = useState<any[]>([]);
    const [decayingSignals, setDecayingSignals] = useState<any[]>([]);
    const [urlClassification, setUrlClassification] = useState('PORTFOLIO');
    const [connectedProviders, setConnectedProviders] = useState<string[]>([]);
    const [potentialScore, setPotentialScore] = useState(0);
    const [visibleSources, setVisibleSources] = useState(6);
    const [expandedSource, setExpandedSource] = useState<string | null>(null);
    const [sourceInput, setSourceInput] = useState('');
    const [acknowledgedErrors, setAcknowledgedErrors] = useState<Set<string>>(() => {
        try {
            const saved = sessionStorage.getItem('hiremax_acknowledged_errors');
            return saved ? new Set(JSON.parse(saved)) : new Set();
        } catch { return new Set(); }
    });

    // ML IDENTITY ENGINE STATES
    const [mlTalentState, setMlTalentState] = useState<any>(null);
    const [mlCredibility, setMlCredibility] = useState<any>(null);
    const [mlSkillGraph, setMlSkillGraph] = useState<any[]>([]);
    const [mlSimulation, setMlSimulation] = useState<any[]>([]);
    const [mlCandidateEmbeddings, setMlCandidateEmbeddings] = useState<any>(null);

    const heartbeatIntervalRef = useRef<number | null>(null);

    const acknowledgeError = (msg: string) => {
        const next = new Set(acknowledgedErrors).add(msg);
        setAcknowledgedErrors(next);
        sessionStorage.setItem('hiremax_acknowledged_errors', JSON.stringify(Array.from(next)));
        setErrorMessage(null);
    };

    // Clear toast messages after 5 seconds
    useEffect(() => {
        if (errorMessage) {
            const timer = setTimeout(() => setErrorMessage(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [errorMessage]);

    useEffect(() => {
        if (successMessage) {
            const timer = setTimeout(() => setSuccessMessage(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [successMessage]);

    useEffect(() => {
        // Fail-safe: loading timeout
        const timer = window.setTimeout(() => {
            setLoading(prev => {
                if (prev) {
                    console.warn("ProfileView loading timed out after 10s");
                    setErrorMessage("Profile loading timed out. Please refresh the page.");
                }
                return false;
            });
        }, 10000);

        loadInitialData();

        // HEARTBEAT FALLBACK (Phase 5)
        // High-reliability reconciliation in case of websocket disconnects
        heartbeatIntervalRef.current = window.setInterval(() => {
            console.log("Heartbeat: Reconciling state...");
            fetchProfileData();
            rehydrateActiveCommands(); // Refresh commands from DB truth
        }, 30000);

        // REAL-TIME SUBSCRIPTIONS (Phase 3)
        // One unified channel for the user's domain
        let user_id: string | null = null;

        const setupRealtime = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            user_id = user.id;

            const channel = supabase
                .channel(`user_realtime_${user.id}`)
                // Listen to ALL ingestion command changes for THIS user
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'ingestion_commands',
                    filter: `user_id=eq.${user.id}`
                }, (payload) => {
                    console.log("Realtime: Command update", payload);
                    const cmd = (payload.new || payload.old) as any;

                    if (payload.eventType === 'DELETE') {
                        setCommandStatuses(prev => {
                            const next = { ...prev };
                            delete next[cmd.id];
                            return next;
                        });
                    } else {
                        // INSERT or UPDATE
                        setCommandStatuses(prev => ({ ...prev, [cmd.id]: cmd.status }));

                        // If it finalized, trigger refresh
                        if (cmd.status === 'completed' || cmd.status === 'failed') {
                            if (cmd.status === 'completed') setSuccessMessage(`${cmd.source} updated successfully.`);
                            else setErrorMessage(`Sync failed for ${cmd.source}: ${cmd.error_reason || 'See logs'}`);

                            fetchProfileData();
                            fetchIntegrityLogs();
                        }
                    }
                })
                // Listen to new snapshot versions
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'profile_snapshots',
                    filter: `user_id=eq.${user.id}`
                }, (payload) => {
                    console.log("Realtime: New snapshot detected", payload);
                    fetchProfileData(); // This updates Impact Score
                })
                // Listen to integrity events (logs)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'integrity_events',
                    filter: `user_id=eq.${user.id}`
                }, () => fetchIntegrityLogs())
                .subscribe();

            return channel;
        };

        const handleFocus = () => {
            console.log("Window focused: Reconciling profile state...");
            fetchProfileData();
            rehydrateActiveCommands();
        };

        window.addEventListener('focus', handleFocus);

        // Subscriptions cleanup logic is below in return block
        const channelPromise = setupRealtime();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
                loadInitialData();
            }
        });

        return () => {
            window.clearTimeout(timer);
            window.removeEventListener('focus', handleFocus);
            if (heartbeatIntervalRef.current) window.clearInterval(heartbeatIntervalRef.current);
            channelPromise.then(channel => {
                if (channel) supabase.removeChannel(channel);
            });
            subscription.unsubscribe();
            if (abortControllerRef.current) abortControllerRef.current.abort();
        };
    }, []);

    // Auto-ingest for newly connected providers - DISABLED (FORENSIC V2.5)
    // Ingestion must now be triggered by explicit user action or handleConnect success return.

    useEffect(() => {
        let potential = 0;
        if (!connectedProviders.includes('github')) potential += 35;
        if (!connectedProviders.includes('linkedin')) potential += 25;
        // Check for specific external anchors if possible, or use defaults for "missing" high-value nodes
        if (manualEvidence.every(e => e.source !== 'EXTERNAL_ANCHOR')) potential += 15;
        setPotentialScore(potential);
    }, [connectedProviders, manualEvidence]);

    const rehydrateActiveCommands = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from('ingestion_commands')
                .select('id, status')
                .eq('user_id', user.id)
                .in('status', ['pending', 'processing']);

            if (data) {
                const states: Record<string, string> = {};
                data.forEach(c => states[c.id] = c.status);
                setCommandStatuses(states);
            }
        } catch (e) {
            console.error("Rehydration failed", e);
        }
    };

    const executeIngestion = async (params: {
        source: string,
        type: 'OAUTH' | 'URL' | 'FILE' | 'MANUAL',
        action: 'INGEST' | 'RESYNC',
        payload?: any,
        workerName: string
    }) => {
        try {
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError) throw authError;
            if (!user) throw new Error("Not authenticated");

            const commandId = crypto.randomUUID();
            // V4 RPC: Nuclear Option for RLS Bypass
            const idempotency_key = `v2-${user.id}-${params.source}-${params.type}-${params.action}`.toLowerCase();

            const { data: command, error: insertError } = await supabase.rpc('create_ingestion_command', {
                p_source: params.source,
                p_source_type: params.type,
                p_action: params.action,
                p_payload: params.payload || {},
                p_idempotency_key: idempotency_key,
                p_status: 'processing'
            });

            if (insertError) throw insertError;

            const rpcResponse = command as any;
            // RPC function returns { success: true, data: { ... } }
            // But Supabase .rpc() might return the JSON directly as `data`.
            // Let's assume `data` IS the return value of the function.
            const commandData = rpcResponse.data;

            if (!commandData || !commandData.id) {
                throw new Error("Ingestion initialization failed (No ID returned)");
            }
            const activeId = commandData.id;

            // Real-time state will take over from here once DB insert hits
            setCommandStatuses(prev => ({ ...prev, [activeId]: 'processing' }));

            // INGESTION ORCHESTRATION (CLEAN AUTHORITY)
            // Frontend -> ingest-identity (Gatekeeper) -> Workers (Internal)
            const { error: orchestratorError } = await supabase.functions.invoke('ingest-identity', {
                body: {
                    user_id: user.id,
                    command_id: activeId, // Pass the ID created via RPC
                    source: params.source,
                    source_type: params.type,
                    action: params.action,
                    // Pass payload twice to ensure compatibility with all orchestrator versions
                    params: params.payload,
                    payload: {
                        ...params.payload,
                        command_id: activeId
                    },
                    url_classification: params.payload?.url_classification
                }
            });

            if (orchestratorError) {
                // WE DO NOT UPDATE DB HERE via Client.
                // The Orchestrator handles failure states.
                // If we get here, the command remains 'processing' or 'pending', which is accurate (stuck).
                throw orchestratorError;
            }

            return activeId;
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Unknown error';
            setErrorMessage(`Ingestion failed: ${message}`);
            throw e;
        }
    };

    const loadInitialData = async () => {
        setLoading(true);
        setLoadingMessage('Fetching user session...');

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // Extract connected providers from user metadata/identities
                const providers = user.identities?.map(id => id.provider) || [];
                if (user.app_metadata?.provider) providers.push(user.app_metadata.provider);
                setConnectedProviders(Array.from(new Set(providers)));

                const { data: activeCmds } = await supabase
                    .from('ingestion_commands')
                    .select('id, status')
                    .eq('user_id', user.id)
                    .in('status', ['pending', 'processing']);

                if (activeCmds && activeCmds.length > 0) {
                    const states: Record<string, string> = {};
                    activeCmds.forEach(c => states[c.id] = c.status);
                    setCommandStatuses(states);
                } else {
                    setCommandStatuses({});
                }
            }
        } catch (e) {
            console.error("Rehydration failed", e);
        }

        await fetchProfileData();
    };

    const fetchProfileData = async () => {
        try {
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError) throw authError;
            if (!user) {
                setLoading(false);
                return;
            }

            setLoadingMessage('Syncing profile inputs...');

            // Parallel Data Fetching for Performance
            const [
                snapResult,
                logsResult,
                evidenceResult,
                historyResult,
                talentResult,
                credibilityResult,
                graphResult,
                simulationResult,
                embeddingResult
            ] = await Promise.all([
                supabase.from('profile_snapshots').select('*').eq('user_id', user.id).order('version', { ascending: false }).limit(1).maybeSingle(),
                supabase.from('integrity_events').select('*').eq('user_id', user.id).order('timestamp', { ascending: false }).limit(20),
                supabase.from('evidence_ledger').select('*').eq('user_id', user.id).order('ingested_at', { ascending: false }),
                supabase.from('profile_strength_history').select('*').eq('user_id', user.id).order('recorded_at', { ascending: true }).limit(30),
                supabase.from('ml_talent_state').select('*').eq('candidate_id', user.id).maybeSingle(),
                supabase.from('ml_credibility_vector').select('*').eq('candidate_id', user.id).maybeSingle(),
                supabase.from('ml_skill_graph').select('*, ml_skill_registry(*)').eq('candidate_id', user.id),
                supabase.from('ml_simulation_results').select('*').eq('candidate_id', user.id).order('simulation_timestamp', { ascending: false }).limit(5),
                supabase.from('ml_candidate_embeddings').select('*').eq('user_id', user.id).maybeSingle()
            ]);

            setSnapshot(snapResult.data as ProfileSnapshot | null);
            setIntegrityLogs((logsResult.data as IntegrityEvent[]) || []);
            setManualEvidence((evidenceResult.data as EvidenceItem[]) || []);
            setStrengthHistory(historyResult.data || []);
            setMlTalentState(talentResult.data);
            setMlCredibility(credibilityResult.data);
            setMlSkillGraph(graphResult.data || []);
            setMlSimulation(simulationResult.data || []);
            setMlCandidateEmbeddings(embeddingResult.data);
            setDecayingSignals([]); // Placeholder

        } catch (e) {
            console.error("Error loading profile data", e);
            setErrorMessage("Failed to load profile data.");
        } finally {
            setLoading(false);
        }
    };

    const fetchIntegrityLogs = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: logs } = await supabase
            .from('integrity_events')
            .select('*')
            .eq('user_id', user.id)
            .order('timestamp', { ascending: false })
            .limit(20);
        setIntegrityLogs((logs as IntegrityEvent[]) || []);
    };

    const fetchManualEvidence = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: evidence } = await supabase
            .from('evidence_ledger')
            .select('*')
            .eq('user_id', user.id)
            .order('ingested_at', { ascending: false });
        setManualEvidence((evidence as EvidenceItem[]) || []);

        // Refresh history graph too as it might change
        const { data: history } = await supabase
            .from('profile_strength_history')
            .select('*')
            .eq('user_id', user.id)
            .order('recorded_at', { ascending: true })
            .limit(30);
        setStrengthHistory(history || []);
    };

    const triggerResync = async (source: string) => {
        setResyncing(source);
        try {
            await executeIngestion({
                source: source.toUpperCase(),
                type: 'OAUTH',
                action: 'RESYNC',
                workerName: `worker-${source.toLowerCase()}`
            });
            setSuccessMessage(`${source} resync initiated!`);
        } catch (e) { }
        finally { setTimeout(() => setResyncing(null), 2000); }
    };

    const handleConnect = async (provider: 'linkedin' | 'github' | 'google') => {
        try {
            const scopeMap: Record<string, string> = {
                github: 'repo read:user',
                linkedin: 'openid profile email',
                google: 'email profile'
            };
            const { error } = await supabase.auth.signInWithOAuth({
                provider: provider as any,
                options: {
                    redirectTo: `${window.location.origin}/profile`,
                    scopes: scopeMap[provider]
                }
            });
            if (error) throw error;
        } catch (e: any) {
            setErrorMessage(`Failed to connect ${provider}: ${e.message}`);
        }
    };

    const isValidUrl = (url: string) => { try { new URL(url); return true; } catch { return false; } };

    const handleSourceConnect = async (config: any) => {
        if (config.type === 'FILE') {
            fileInputRef.current?.click();
            return;
        }
        if (config.type === 'OAUTH') {
            if (config.id === 'github') handleConnect('github');
            else if (config.id === 'linkedin') handleConnect('linkedin');
            else setErrorMessage("OAuth provider not yet supported");
            return;
        }

        if (!sourceInput || !isValidUrl(sourceInput)) {
            setErrorMessage(`Please enter a valid URL for ${config.label}`);
            return;
        }

        setIngestingUrl(true);
        try {
            await executeIngestion({
                source: 'EXTERNAL',
                type: 'URL',
                action: 'INGEST',
                payload: { url: sourceInput, extractor_hint: config.hint, url_classification: config.hint },
                workerName: 'worker-external'
            });
            setSuccessMessage(`${config.label} linked successfully!`);
            setExpandedSource(null);
            setSourceInput('');
        } catch (e: any) {
            setErrorMessage(e.message);
        } finally {
            setIngestingUrl(false);
        }
    };

    const handleUrlIngestion = async () => {
        if (!externalUrl || !isValidUrl(externalUrl)) {
            setErrorMessage('PLEASE PROVIDE A VALID TECHNICAL OR RESEARCH URL');
            return;
        }

        setIngestingUrl(true);
        try {
            await executeIngestion({
                source: externalUrl,
                type: 'URL',
                action: 'INGEST',
                payload: {
                    url: externalUrl,
                    url_classification: urlClassification
                },
                workerName: 'worker-external'
            });
            setSuccessMessage(`ANCHOR SYNCHRONIZED AS ${urlClassification}`);
            setExternalUrl('');
        } catch (err: any) {
            setErrorMessage(err.message);
        } finally {
            setIngestingUrl(false);
        }
    };

    const handleFileUpload = useCallback(async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setUploadingFile(true);
        try {
            const file = files[0];
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");
            const fileName = `${user.id}/${Date.now()}_${file.name}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('evidence-files').upload(fileName, file);
            if (uploadError) throw uploadError;

            await executeIngestion({
                source: 'MANUAL', type: 'FILE', action: 'INGEST',
                payload: { file_path: uploadData.path, file_name: file.name, file_type: file.type },
                workerName: 'worker-resume'
            });
            setSuccessMessage("File uploaded successfully!");
        } catch (e: any) { setErrorMessage(`Upload failed: ${e.message}`); }
        finally { setUploadingFile(false); setIsDragOver(false); }
    }, []);

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); };
    const handleDrop = (e: React.DragEvent) => { e.preventDefault(); handleFileUpload(e.dataTransfer.files); };

    const filteredLogs = integrityLogs.filter(log => {
        if (logFilter === 'ALL') return true;
        if (logFilter === 'INGESTION') return log.event_type === 'INGESTION';
        return log.event_type === 'SECURITY' || log.event_type === 'ERROR';
    });

    const handleScholarConnect = async () => {
        if (!isValidUrl(scholarUrlInput)) { setErrorMessage("Invalid Scholar URL"); return; }
        try {
            await executeIngestion({
                source: 'EXTERNAL', type: 'URL', action: 'INGEST',
                payload: { url: scholarUrlInput, extractor_hint: 'SCHOLAR' },
                workerName: 'worker-external'
            });
            setSuccessMessage("Scholar profile ingestion started!");
            setShowScholarInput(false); setScholarUrlInput('');
        } catch (e) { }
    };

    if (loading) {
        return <div className="p-20 text-slate-500 font-black uppercase text-center">{loadingMessage}</div>;
    }

    return (
        <div className="max-w-[1400px] mx-auto px-10 py-12 animate-in fade-in duration-700 bg-[#0A0B10] min-h-screen text-slate-200">
            {/* Notifications */}
            {errorMessage && !acknowledgedErrors.has(errorMessage) && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-[#1A1D26] border border-red-500/30 p-10 rounded-[2.5rem] max-w-md text-center">
                        <AlertTriangle size={40} className="text-red-500 mx-auto mb-6" />
                        <h3 className="text-2xl font-black text-white mb-4">INGESTION GUARD</h3>
                        <p className="text-slate-400 mb-8">{errorMessage}</p>
                        <button onClick={() => acknowledgeError(errorMessage)} className="w-full bg-red-600 py-4 rounded-xl font-black uppercase tracking-widest text-[10px]">Acknowledge</button>
                    </div>
                </div>
            )}
            {successMessage && (
                <div className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3">
                    <CheckCircle2 size={20} />
                    <span className="text-sm font-bold">{successMessage}</span>
                </div>
            )}

            {/* Navigation / View Toggle */}
            <div className="flex gap-4 mb-10">
                <button
                    onClick={() => setViewMode('standard')}
                    className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${viewMode === 'standard' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'bg-slate-900 text-slate-500 border border-slate-800 hover:text-white'}`}
                >
                    System Control
                </button>
                <button
                    onClick={() => setViewMode('health')}
                    className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${viewMode === 'health' ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-600/20' : 'bg-slate-900 text-slate-500 border border-slate-800 hover:text-white'}`}
                >
                    Health Dashboard
                </button>
            </div>

            {viewMode === 'health' && snapshot?.signal_health ? (
                <ProfileHealthDashboard
                    overallScore={snapshot.signal_health.overall_score}
                    potentialScore={potentialScore}
                    componentScores={snapshot.signal_health.component_scores || { completeness: 0, verification: 0, quality: 0, recency: 0 }}
                    skills={snapshot.snapshot_data?.skills || {}}
                    commandStatuses={commandStatuses}
                    integrityLogs={integrityLogs}
                    manualEvidence={manualEvidence}
                    mlTalentState={mlTalentState}
                    mlCredibility={mlCredibility}
                    mlSkillGraph={mlSkillGraph}
                    mlSimulation={mlSimulation}
                    mlCandidateEmbeddings={mlCandidateEmbeddings}
                    onRefresh={() => fetchProfileData()}
                />
            ) : (
                <div className="space-y-12">
                    {/* Hero Stats */}
                    <div className="bg-[#12141C] border border-[#23262F] rounded-[3rem] p-12 relative overflow-hidden group">
                        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-full tracking-wide">
                                        {snapshot?.signal_health?.overall_score && snapshot.signal_health.overall_score > 75 ? "Profile Strength: High" : "Building Profile"}
                                    </span>
                                    <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Verified Profile</span>
                                </div>
                                <h1 className="text-5xl font-bold text-white tracking-tight leading-none mb-6">Professional Profile</h1>
                                <p className="text-slate-400 text-lg font-medium max-w-xl">
                                    A comprehensive view of your professional achievements, verified and weighted for impact via connected accounts.
                                </p>

                                {Object.keys(commandStatuses).length > 0 && (
                                    <div className="flex items-center gap-3 mt-6 bg-blue-600/10 border border-blue-600/20 px-4 py-2 rounded-xl w-fit">
                                        <Loader2 size={14} className="text-blue-500 animate-spin" />
                                        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">
                                            Syncing {Object.keys(commandStatuses).length} Source{Object.keys(commandStatuses).length > 1 ? 's' : ''}...
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="bg-[#0A0B10] border border-[#23262F] p-8 rounded-[2rem] min-w-[320px] shadow-2xl relative overflow-hidden">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Impact Score</p>
                                        <h3 className="text-5xl font-black text-white">{snapshot?.signal_health?.overall_score || 0}</h3>
                                    </div>
                                    <Activity className="text-blue-500/20" size={32} />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500">
                                        <span>Profile Completeness</span>
                                        <span>{snapshot?.evidence_coverage_percentage || 0}%</span>
                                    </div>
                                    <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-600 transition-all duration-1000" style={{ width: `${snapshot?.evidence_coverage_percentage || 0}%` }} />
                                    </div>
                                </div>
                                {/* Sparkline History Overlay */}
                                <div className="absolute bottom-0 left-0 right-0 h-16 opacity-10 pointer-events-none">
                                    {strengthHistory.length > 1 && (
                                        <svg className="w-full h-full" viewBox={`0 0 ${strengthHistory.length - 1} 100`} preserveAspectRatio="none">
                                            <path d={`M 0 ${100 - (strengthHistory[0].total_score || 0)} ${strengthHistory.map((s, i) => `L ${i} ${100 - (s.total_score || 0)}`).join(' ')}`} fill="none" stroke="#3b82f6" strokeWidth="4" />
                                        </svg>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/5 blur-[100px] -translate-y-1/2 translate-x-1/2 rounded-full" />
                    </div>

                    {/* Main Content Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                        <div className="lg:col-span-8 space-y-10">
                            {/* Alerts / In-line widgets */}
                            {decayingSignals.length > 0 && Object.keys(commandStatuses).length === 0 && (
                                <DecayingSignalsWidget signals={decayingSignals} onStartFix={() => triggerResync('GITHUB')} />
                            )}

                            {/* Node Source Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* LinkedIn Card */}
                                <div className="bg-[#12141C] border border-[#23262F] rounded-[2.5rem] p-8 flex flex-col group hover:border-blue-500/30 transition-all">
                                    <div className="flex justify-between items-start mb-10">
                                        <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl">
                                            <Linkedin className="text-blue-500" size={24} />
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] font-bold uppercase text-slate-600 tracking-wider">Verified</span>
                                            {snapshot?.coverage_by_source?.linkedin && <CheckCircle2 size={16} className="text-emerald-500 ml-auto mt-1" />}
                                        </div>
                                    </div>
                                    <h4 className="text-xl font-bold text-white mb-2">LinkedIn Profile</h4>
                                    <p className="text-slate-400 text-sm font-medium leading-relaxed mb-6">Import your verified employment history and connections.</p>
                                    <div className="mt-auto pt-6 border-t border-[#23262F]">
                                        {Object.values(commandStatuses).some(s => s === 'processing') && integrityLogs.some(l => l.source === 'LINKEDIN_WORKER' && l.message.toLowerCase().includes('started')) ? (
                                            <div className="w-full bg-blue-600/20 text-blue-400 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 border border-blue-600/30">
                                                <Loader2 size={12} className="animate-spin" />
                                                Syncing...
                                            </div>
                                        ) : snapshot?.coverage_by_source?.linkedin ? (
                                            <button disabled className="w-full bg-emerald-500/10 text-emerald-500 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                                                <CheckCircle2 size={14} /> Active
                                            </button>
                                        ) : connectedProviders.includes('linkedin') ? (
                                            <button onClick={() => triggerResync('linkedin')} className="w-full bg-blue-600 text-white py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-blue-700 transition-all">Sync Profile</button>
                                        ) : (
                                            <button onClick={() => handleConnect('linkedin')} className="w-full bg-slate-900 text-slate-300 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-all">Connect</button>
                                        )}
                                    </div>
                                </div>

                                {/* GitHub Card */}
                                <div className="bg-[#12141C] border border-[#23262F] rounded-[2.5rem] p-8 flex flex-col group hover:border-blue-500/30 transition-all">
                                    <div className="flex justify-between items-start mb-10">
                                        <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                                            <Github className="text-white" size={24} />
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] font-bold uppercase text-slate-600 tracking-wider">Verified</span>
                                            {snapshot?.coverage_by_source?.github && <CheckCircle2 size={16} className="text-emerald-500 ml-auto mt-1" />}
                                        </div>
                                    </div>
                                    <h4 className="text-xl font-bold text-white mb-2">GitHub Activity</h4>
                                    <p className="text-slate-400 text-sm font-medium leading-relaxed mb-6">Showcase your code quality, contributions, and open source impact.</p>
                                    <div className="mt-auto pt-6 border-t border-[#23262F]">
                                        {Object.values(commandStatuses).some(s => s === 'processing') && integrityLogs.some(l => l.source === 'GITHUB_WORKER' && l.message.toLowerCase().includes('started')) ? (
                                            <div className="w-full bg-blue-600/20 text-blue-400 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 border border-blue-600/30">
                                                <Loader2 size={12} className="animate-spin" />
                                                Analyzing...
                                            </div>
                                        ) : snapshot?.coverage_by_source?.github ? (
                                            <button disabled className="w-full bg-emerald-500/10 text-emerald-500 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                                                <CheckCircle2 size={14} /> Active
                                            </button>
                                        ) : connectedProviders.includes('github') ? (
                                            <button onClick={() => triggerResync('github')} className="w-full bg-blue-600 text-white py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-blue-700 transition-all">Sync Profile</button>
                                        ) : (
                                            <button onClick={() => handleConnect('github')} className="w-full bg-slate-900 text-slate-300 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-all">Connect</button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Sidebar */}
                        <div className="lg:col-span-4 space-y-8">
                            <QuickWins wins={snapshot?.snapshot_data?.recommendations || []} />

                            <div className="bg-[#12141C] border border-[#23262F] rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden">
                                <div className="flex justify-between items-center mb-8">
                                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Verification Log</h3>
                                    {Object.keys(commandStatuses).length > 0 && (
                                        <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                                    )}
                                </div>
                                <div className="space-y-6 max-h-[350px] overflow-y-auto pr-4 custom-scrollbar">
                                    {filteredLogs.length > 0 ? filteredLogs.map((log) => (
                                        <div key={log.id} className="pb-4 border-b border-[#23262F] last:border-0 hover:border-blue-500/20 transition-all">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase ${log.event_type === 'ERROR' ? 'bg-red-500 text-white' : 'bg-blue-600/10 text-blue-500'}`}>{log.event_type}</span>
                                                <span className="text-[8px] text-slate-600 font-bold">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                            </div>
                                            <p className="text-[10px] text-slate-400 leading-relaxed">{log.message}</p>
                                        </div>
                                    )) : <p className="text-slate-700 text-[10px] italic text-center py-10">No integrity events recorded.</p>}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tech Source Grid */}
                    <div className="mt-16 bg-[#12141C] border border-[#23262F] rounded-[3.5rem] p-12 shadow-2xl">
                        <div className="flex items-center gap-4 mb-4">
                            <UploadCloud className="text-blue-500" size={28} />
                            <h2 className="text-3xl font-bold text-white tracking-tight">Connect Professional Sources</h2>
                        </div>
                        <p className="text-slate-400 text-base mb-12 max-w-2xl">
                            Link your technical profiles, research, and creative portfolios. Our AI verifies these sources to build your comprehensive professional graph.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Keep Resume Upload separate as it's special */}
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="bg-[#0A0B10] border-2 border-dashed border-[#23262F] hover:border-blue-500/50 hover:bg-blue-500/5 rounded-[2rem] p-8 cursor-pointer transition-all group flex flex-col items-center justify-center text-center py-12"
                            >
                                <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => handleFileUpload(e.target.files)} />
                                <div className="w-16 h-16 bg-[#1A1D26] rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <FileText size={32} className="text-slate-400 group-hover:text-blue-400" />
                                </div>
                                <h3 className="text-white font-bold text-lg mb-2">Upload Resume / CV</h3>
                                <p className="text-slate-500 text-xs font-medium max-w-[200px]">PDF or Docx. Max 10MB.</p>
                                {uploadingFile && <div className="mt-4 text-blue-500 text-xs font-bold uppercase animate-pulse">Uploading...</div>}
                            </div>

                            {/* Dynamic Sources */}
                            {[
                                { id: 'github', label: 'GitHub', icon: Github, desc: 'Code repositories & contributions', type: 'OAUTH', hint: 'GITHUB' },
                                { id: 'linkedin', label: 'LinkedIn', icon: Linkedin, desc: 'Professional network & history', type: 'OAUTH', hint: 'LINKEDIN' },
                                { id: 'kaggle', label: 'Kaggle', icon: Database, desc: 'Data science competitions', type: 'URL', hint: 'KAGGLE' },
                                { id: 'huggingface', label: 'Hugging Face', icon: Cpu, desc: 'AI models & datasets', type: 'URL', hint: 'HUGGINGFACE' },
                                { id: 'stackoverflow', label: 'Stack Overflow', icon: MessageSquare, desc: 'Developer Q&A reputation', type: 'URL', hint: 'STACKOVERFLOW' },
                                { id: 'leetcode', label: 'LeetCode', icon: Code2, desc: 'Algorithmic problem solving', type: 'URL', hint: 'LEETCODE' },
                                { id: 'codeforces', label: 'Codeforces', icon: Terminal, desc: 'Competitive programming', type: 'URL', hint: 'CODEFORCES' },
                                { id: 'medium', label: 'Medium', icon: BookOpen, desc: 'Technical writing & blogs', type: 'URL', hint: 'MEDIUM' },
                                { id: 'devto', label: 'Dev.to', icon: Book, desc: 'Developer community articles', type: 'URL', hint: 'DEVTO' },
                                { id: 'scholar', label: 'Google Scholar', icon: GraduationCap, desc: 'Academic research papers', type: 'URL', hint: 'SCHOLAR' },
                                { id: 'orcid', label: 'ORCID', icon: Fingerprint, desc: 'Research researcher identifier', type: 'URL', hint: 'ORCID' },
                                { id: 'docker', label: 'Docker Hub', icon: Container, desc: 'Container image repositories', type: 'URL', hint: 'DOCKER' },
                                { id: 'npm', label: 'NPM', icon: Package, desc: 'Node.js package registry', type: 'URL', hint: 'NPM' },
                                { id: 'pypi', label: 'PyPI', icon: FileCode, desc: 'Python package index', type: 'URL', hint: 'PYPI' },
                                { id: 'producthunt', label: 'Product Hunt', icon: Rocket, desc: 'Product launches & makers', type: 'URL', hint: 'PRODUCTHUNT' },
                                { id: 'crunchbase', label: 'Crunchbase', icon: Building2, desc: 'Startup & business data', type: 'URL', hint: 'CRUNCHBASE' },
                                { id: 'portfolio', label: 'Portfolio', icon: Globe, desc: 'Personal website / portfolio', type: 'URL', hint: 'PORTFOLIO' },
                            ].sort((a, b) => {
                                // Sort logic: Missing first
                                const aActive = manualEvidence.some(e => e.source === a.hint || (e.claim_data as any)?.url_classification === a.hint) || connectedProviders.includes(a.id);
                                const bActive = manualEvidence.some(e => e.source === b.hint || (e.claim_data as any)?.url_classification === b.hint) || connectedProviders.includes(b.id);
                                if (aActive === bActive) return 0;
                                return aActive ? 1 : -1;
                            }).slice(0, visibleSources).map((source) => {
                                const isActive = manualEvidence.some(e => e.source === source.hint || (e.claim_data as any)?.url_classification === source.hint) || connectedProviders.includes(source.id);
                                const isExpanded = expandedSource === source.id;

                                return (
                                    <div key={source.id} className={`bg-[#0A0B10] border rounded-[2rem] p-8 flex flex-col transition-all ${isActive ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-[#23262F] hover:border-blue-500/30'}`}>
                                        <div className="flex justify-between items-start mb-6">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isActive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-400'}`}>
                                                <source.icon size={24} />
                                            </div>
                                            {isActive && <CheckCircle2 size={16} className="text-emerald-500" />}
                                        </div>
                                        <h3 className="text-white font-bold text-lg mb-2">{source.label}</h3>
                                        <p className="text-slate-500 text-xs font-medium mb-6 min-h-[40px]">{source.desc}</p>

                                        <div className="mt-auto">
                                            {isActive ? (
                                                <button disabled className="w-full py-2.5 bg-emerald-500/10 text-emerald-500 rounded-lg text-xs font-bold uppercase tracking-widest cursor-default">
                                                    Linked
                                                </button>
                                            ) : isExpanded ? (
                                                <div className="animate-in fade-in zoom-in duration-300">
                                                    {source.type === 'URL' ? (
                                                        <>
                                                            <input
                                                                autoFocus
                                                                value={sourceInput}
                                                                onChange={(e) => setSourceInput(e.target.value)}
                                                                placeholder="https://..."
                                                                className="w-full bg-[#1A1D26] border border-[#2D313D] rounded-xl px-4 py-3 text-sm text-white mb-3 focus:outline-none focus:border-blue-500 transition-colors"
                                                                onKeyDown={(e) => e.key === 'Enter' && handleSourceConnect(source)}
                                                            />
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => setExpandedSource(null)}
                                                                    className="flex-1 py-2.5 bg-slate-800 text-slate-400 rounded-lg text-xs font-bold hover:bg-slate-700 transition-all"
                                                                >
                                                                    Cancel
                                                                </button>
                                                                <button
                                                                    onClick={() => handleSourceConnect(source)}
                                                                    disabled={ingestingUrl || !sourceInput}
                                                                    className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-500 transition-all disabled:opacity-50"
                                                                >
                                                                    {ingestingUrl ? '...' : 'Verify'}
                                                                </button>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleSourceConnect(source)}
                                                            className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-500 transition-all"
                                                        >
                                                            Connect {source.label}
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => {
                                                        setExpandedSource(source.id);
                                                        setSourceInput('');
                                                    }}
                                                    className="w-full py-2.5 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-700 transition-all"
                                                >
                                                    Connect
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {visibleSources < 18 && (
                            <div className="mt-12 text-center">
                                <button
                                    onClick={() => setVisibleSources(prev => prev + 6)}
                                    className="px-8 py-3 bg-[#1A1D26] hover:bg-[#23262F] text-white border border-[#2D313D] rounded-full text-xs font-bold uppercase tracking-widest transition-all shadow-xl"
                                >
                                    Load More Sources
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Actual Ledger List */}
                    <div className="mt-16 space-y-4">
                        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6">Connected Sources</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {manualEvidence.length > 0 ? manualEvidence.map((ev) => (
                                <div key={ev.id} className="bg-black/40 border border-[#23262F] p-5 rounded-2xl flex flex-col hover:border-blue-500/30 transition-all group">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-2">
                                            <div className={`p-2 rounded-lg ${ev.source === 'GITHUB' ? 'bg-white/10 text-white' :
                                                ev.source === 'LINKEDIN' ? 'bg-blue-600/10 text-blue-400' :
                                                    'bg-slate-800 text-slate-400'
                                                }`}>
                                                {ev.source === 'GITHUB' ? <Github size={14} /> :
                                                    ev.source === 'LINKEDIN' ? <Linkedin size={14} /> :
                                                        <Shield size={14} />}
                                            </div>
                                            <span className="text-[8px] font-black uppercase text-slate-500 tracking-tighter">{ev.claim_type}</span>
                                        </div>
                                        <span className="text-[8px] font-mono text-slate-600 italic">
                                            {new Date(ev.ingested_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <h5 className="text-xs font-black text-white uppercase truncate mb-1">
                                        {(ev.claim_data as any).name || (ev.claim_data as any).title || (ev.claim_data as any).company || 'Unlabeled Signal'}
                                    </h5>
                                    <p className="text-[9px] text-slate-500 font-medium line-clamp-2">
                                        {(ev.claim_data as any).url || (ev.claim_data as any).institution || 'Verified source from professional history.'}
                                    </p>
                                    <div className="mt-4 pt-4 border-t border-[#23262F] flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="flex items-center gap-1">
                                            <ShieldCheck size={10} className="text-emerald-500" />
                                            <span className="text-[8px] font-bold text-emerald-500">VERIFIED</span>
                                        </div>
                                        {(ev.claim_data as any).url && (
                                            <a href={(ev.claim_data as any).url} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-400">
                                                <ExternalLink size={12} />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )) : (
                                <div className="col-span-full py-12 text-center border-2 border-dashed border-[#23262F] rounded-3xl">
                                    <p className="text-slate-700 text-[10px] font-bold uppercase tracking-widest">Awaiting Verification Sources</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
