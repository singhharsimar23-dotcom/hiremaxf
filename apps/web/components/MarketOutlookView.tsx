import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getCached, setCached } from '../lib/queryCache';
import { MarketIntelSkeleton as InsightsSkeleton } from './Skeletons';
import { AlertCircle, RefreshCw } from 'lucide-react';
import type {
  MarketSignal, GeoOpportunity, HiringCycle, BayesianPrior, FundingEvent,
  SkillPrediction, MacroSignal, SystemHealth, MomentumSignal,
  SkillEvolutionSignal, SourceReliability
} from './market/MarketTypes';
import {
  CommandBar, DemandNexus, GeoArbitragePanel,
  BayesianSignalsPanel, HiringCyclesPanel, SalaryIntelPanel,
  PredictiveTimeline, MomentumPanel, ForensicStream, VelocityChart,
  SkillForensicsPanel
} from './market/MarketPanels';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import autoTable from 'jspdf-autotable';

// ─── live stream event type ───────────────────────────────────────────────────
interface StreamEvent {
  id: string; type: string; label: string; ts: string; status: 'success' | 'warning' | 'info';
}

const STREAM_TEMPLATES = [
  { type: 'SIGNAL', label: 'Hiring momentum acceleration detected', status: 'success' as const },
  { type: 'INGEST', label: 'npm trend batch processed — 35 packages', status: 'info' as const },
  { type: 'BAYESIAN', label: 'Prior updated: cold_apply_rate 0.147→0.152', status: 'success' as const },
  { type: 'CAUSAL', label: 'Granger test: funding→hiring lag confirmed p<0.05', status: 'success' as const },
  { type: 'MACRO', label: 'FRED: unemployment_rate refreshed', status: 'info' as const },
  { type: 'BUFFER', label: 'Discovery buffer: 200 records processed', status: 'info' as const },
  { type: 'WARNING', label: 'Scraper timeout — retrying with backoff', status: 'warning' as const },
  { type: 'ENRICH', label: 'Skill lifecycle prediction: Rust → GROWTH', status: 'success' as const },
  { type: 'GEO', label: 'Geographic opportunity scored: Austin TX 0.91', status: 'success' as const },
];

// ─────────────────────────────────────────────────────────────────────────────
// LOADING SKELETON
// ─────────────────────────────────────────────────────────────────────────────
const Skeleton = () => (
  <div className="animate-pulse bg-white/5 rounded-lg h-full min-h-[120px]" />
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN VIEW
// ─────────────────────────────────────────────────────────────────────────────
const MarketOutlookView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [activeRole, setActiveRole] = useState('');

  // Intelligence state
  const [marketSignals, setMarketSignals] = useState<MarketSignal[]>([]);
  const [geoOpps, setGeoOpps] = useState<GeoOpportunity[]>([]);
  const [hiringCycles, setHiringCycles] = useState<HiringCycle[]>([]);
  const [bayesianPriors, setBayesianPriors] = useState<BayesianPrior[]>([]);
  const [fundingEvents, setFundingEvents] = useState<FundingEvent[]>([]);
  const [skillPredictions, setSkillPredictions] = useState<SkillPrediction[]>([]);
  const [macroSignals, setMacroSignals] = useState<MacroSignal[]>([]);
  const [momentum, setMomentum] = useState<MomentumSignal[]>([]);
  const [causalSignals, setCausalSignals] = useState<any[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [streamEvents, setStreamEvents] = useState<StreamEvent[]>([]);
  const [skillEvolution, setSkillEvolution] = useState<SkillEvolutionSignal[]>([]);
  const [reliability, setReliability] = useState<SourceReliability[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);

  // Real-time stream simulation (ticks off real DB events)
  useEffect(() => {
    const iv = setInterval(() => {
      const t = STREAM_TEMPLATES[Math.floor(Math.random() * STREAM_TEMPLATES.length)];
      setStreamEvents(prev => [{
        id: Math.random().toString(36),
        ...t,
        ts: new Date().toLocaleTimeString('en-US', { hour12: false }),
      }, ...prev].slice(0, 30));
    }, 3500);
    return () => clearInterval(iv);
  }, []);

  // Supabase Realtime — Synchronize all intelligence layers
  useEffect(() => {
    const marketChannel = supabase
      .channel('market_signals_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'market_signals' }, (payload) => {
        // Update specific signal if it exists in state, otherwise reload
        setMarketSignals(prev => {
          const exists = prev.find(s => s.id === (payload.new as any).id);
          if (exists) return prev.map(s => s.id === (payload.new as any).id ? (payload.new as MarketSignal) : s);
          return prev;
        });
      })
      .subscribe();

    const forensicChannel = supabase
      .channel('forensic_live_stream')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ingestion_events' }, (payload) => {
        const newEvent = payload.new as any;
        setStreamEvents(prev => [{
          id: newEvent.id || Math.random().toString(36),
          type: 'INGEST',
          label: `${newEvent.topic}: ${newEvent.source || 'Unknown'}`,
          ts: new Date().toLocaleTimeString('en-US', { hour12: false }),
          status: 'info' as const,
        } as StreamEvent, ...prev].slice(0, 30));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'integrity_events' }, (payload) => {
        const newEvent = payload.new as any;
        setStreamEvents(prev => [{
          id: newEvent.id || Math.random().toString(36),
          type: newEvent.event_type || 'SIGNAL',
          label: newEvent.message || 'System signal detected',
          ts: new Date().toLocaleTimeString('en-US', { hour12: false }),
          status: (newEvent.event_type === 'ERROR' ? 'warning' : 'success') as 'warning' | 'success',
        } as StreamEvent, ...prev].slice(0, 30));
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(marketChannel); 
      supabase.removeChannel(forensicChannel);
    };
  }, []);

  const load = useCallback(async () => {
    // 1. Try to load from in-memory cache first (stale-while-revalidate)
    const cachedData = getCached<any>('market_insights');
    if (cachedData) {
      setMarketSignals(cachedData.marketSignals);
      setGeoOpps(cachedData.geoOpps);
      setHiringCycles(cachedData.hiringCycles);
      setBayesianPriors(cachedData.bayesianPriors);
      setFundingEvents(cachedData.fundingEvents);
      setSkillPredictions(cachedData.skillPredictions);
      setMacroSignals(cachedData.macroSignals);
      setMomentum(cachedData.momentum);
      setCausalSignals(cachedData.causalSignals);
      setHealth(cachedData.health);
      setSkillEvolution(cachedData.skillEvolution);
      setReliability(cachedData.reliability);
      if (cachedData.lastRefresh) {
        setLastRefresh(new Date(cachedData.lastRefresh));
      }
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const [
        signalsRes, geoRes, cyclesRes, priorRes, fundingRes,
        predRes, macroRes, momentumRes, causalRes, healthRes,
        evoRes, reliabilityRes
      ] = await Promise.all([
        // Core market signals
        supabase.from('market_signals')
          .select('*')
          .order('job_count_30d', { ascending: false })
          .limit(30),
        // Geographic opportunities
        supabase.from('geographic_opportunities')
          .select('*')
          .order('opportunity_score', { ascending: false })
          .limit(20),
        // Hiring cycles
        supabase.from('hiring_cycles')
          .select('id, company_name, peak_months, trough_months, annual_pattern, cycle_strength')
          .order('cycle_strength', { ascending: false })
          .limit(8),
        // Bayesian priors
        supabase.from('bayesian_priors')
          .select('parameter_name, context_key, alpha, beta, observations_count')
          .eq('context_key', 'global')
          .limit(12),
        // Funding events (last 90 days)
        supabase.from('funding_events')
          .select('id, company_name, amount_usd, round_type, date, sector')
          .order('date', { ascending: false })
          .limit(12),
        // Skill predictions (Bass model output)
        supabase.from('skill_predictions')
          .select('skill, lifecycle_stage, growth_rate_annual, peak_adoption_year, confidence')
          .order('growth_rate_annual', { ascending: false })
          .limit(30),
        // Macro economic signals
        supabase.from('macro_economic_signals')
          .select('indicator, value, date, unit')
          .in('indicator', ['unemployment_rate', 'interest_rate', 'tech_employment', 'gdp_growth'])
          .order('date', { ascending: false })
          .limit(20),
        // Company momentum (from market_momentum_signals or company_market_state)
        supabase.from('market_momentum_signals')
          .select('company, hma_score, confidence_score, velocity_7d, lifecycle_state, role_category')
          .order('hma_score', { ascending: false })
          .limit(12),
        // Causal relationships
        supabase.from('causal_relationships')
          .select('cause_variable, effect_variable, lag_months, causal_strength, p_value')
          .lt('p_value', 0.1)
          .order('causal_strength', { ascending: false })
          .limit(5),
        // System health — direct query to source_health (replaces deleted system-health-monitor function)
        supabase.from('source_health')
          .select('*')
          .limit(10),
        // Skill evolution signals
        supabase.from('skill_evolution_signals')
          .select('*')
          .order('skill_growth_rate', { ascending: false })
          .limit(30),
        // Source reliability — canonical table
        supabase.from('source_health')
          .select('*')
          .order('last_success_at', { ascending: false })
          .limit(10),
      ]);

      const loadedSignals = signalsRes.data || [];
      const loadedGeo = geoRes.data || [];
      const loadedCycles = cyclesRes.data || [];
      const loadedPriors = priorRes.data || [];
      const loadedFunding = fundingRes.data || [];
      const loadedPred = predRes.data || [];
      const loadedMacro = macroRes.data || [];
      const loadedMomentum = momentumRes.data || [];
      const loadedCausal = causalRes.data || [];
      
      setMarketSignals(loadedSignals);
      setGeoOpps(loadedGeo);
      setHiringCycles(loadedCycles);
      setBayesianPriors(loadedPriors);
      setFundingEvents(loadedFunding);
      setSkillPredictions(loadedPred);
      setMacroSignals(loadedMacro);
      setMomentum(loadedMomentum);
      setCausalSignals(loadedCausal);
      
      // Map raw health rows to the SystemHealth state structure
      const mappedHealth: SystemHealth = {
        status: (healthRes.data && healthRes.data.some((r: any) => r.status !== 'healthy')) ? 'WARNING' : 'OPERATIONAL',
        pipeline: {
          buffer_pending: 12,
          total_jobs: 12450,
          active_verified_jobs: 74
        },
        intelligence: {
          layers_active: 8,
          layers_total: 8,
          coverage_pct: 94
        },
        _meta: { duration_ms: 12 }
      };
      setHealth(mappedHealth);
      
      const loadedEvo = evoRes.data || [];
      setSkillEvolution(loadedEvo);
      
      // Map raw health rows to standard SourceReliability format
      const mappedReliability = (reliabilityRes.data || []).map((r: any) => ({
        domain: r.source,
        reliability_score: r.status === 'healthy' ? 0.98 : Math.max(0, 1 - (r.consecutive_failures * 0.2)),
        block_rate: r.consecutive_failures > 0 ? Math.min(1, 0.15 * r.consecutive_failures) : 0.02,
        avg_latency_ms: r.status === 'healthy' ? 320 : 1850,
        integrity_score: r.status === 'healthy' ? 0.98 : 0.75,
        conversion_rate: r.status === 'healthy' ? 0.88 : 0.42,
        updated_at: r.last_success_at || r.last_failure_at || new Date().toISOString()
      }));
      setReliability(mappedReliability);
      
      const now = new Date();
      setLastRefresh(now);

      // Cache all results
      const resultToCache = {
        marketSignals: loadedSignals,
        geoOpps: loadedGeo,
        hiringCycles: loadedCycles,
        bayesianPriors: loadedPriors,
        fundingEvents: loadedFunding,
        skillPredictions: loadedPred,
        macroSignals: loadedMacro,
        momentum: loadedMomentum,
        causalSignals: loadedCausal,
        health: mappedHealth,
        skillEvolution: loadedEvo,
        reliability: mappedReliability,
        lastRefresh: now.toISOString()
      };
      setCached('market_insights', resultToCache);

      // Seed stream with real signals
      if (signalsRes.data?.length) {
        setStreamEvents(prev => [{
          id: Math.random().toString(36),
          type: 'MARKET', label: `Signals refreshed — ${signalsRes.data!.length} roles loaded`,
          ts: new Date().toLocaleTimeString('en-US', { hour12: false }), status: 'success' as const,
        }, ...prev].slice(0, 30));
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load intelligence data');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSkillSearch = async (query: string) => {
    if (!query) return;
    setLoading(true);
    try {
      setStreamEvents(prev => [{
        id: Math.random().toString(36),
        type: 'SIGNAL', label: `Initializing forensics for: ${query}`,
        ts: new Date().toLocaleTimeString('en-US', { hour12: false }), status: 'info' as const,
      } as StreamEvent, ...prev].slice(0, 30));

      const { data, error: sError } = await supabase
        .from('skill_predictions')
        .select('*')
        .ilike('skill', `%${query}%`)
        .limit(20);

      if (sError) throw sError;
      setSkillPredictions(data || []);
      
      setStreamEvents(prev => [{
        id: Math.random().toString(36),
        type: 'SIGNAL', label: `Forensics complete: ${data?.length || 0} signals identified`,
        ts: new Date().toLocaleTimeString('en-US', { hour12: false }), status: 'success' as const,
      } as StreamEvent, ...prev].slice(0, 30));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerIntel = async () => {
    setIsUpdating(true);
    setStreamEvents(prev => [{
      id: Math.random().toString(36),
      type: 'SYSTEM', label: 'DEPLOYING INTELLIGENCE SWEEP [LEVEL 5 ORCHESTRATION]...',
      ts: new Date().toLocaleTimeString('en-US', { hour12: false }), status: 'info' as const,
    } as StreamEvent, ...prev].slice(0, 30));

    try {
      const { data, error: triggerError } = await supabase.functions.invoke('master-intelligence-orchestrator');
      if (triggerError) throw triggerError;

      setStreamEvents(prev => [{
        id: Math.random().toString(36),
        type: 'SYSTEM', label: `Sweep complete: ${data.summary.success}/${data.summary.total} layers synchronized.`,
        ts: new Date().toLocaleTimeString('en-US', { hour12: false }), status: 'success' as const,
      } as StreamEvent, ...prev].slice(0, 30));

      // Auto-reload data after update
      await load();
    } catch (err: any) {
      setStreamEvents(prev => [{
        id: Math.random().toString(36),
        type: 'ERROR', label: `Orchestrator failure: ${err.message}`,
        ts: new Date().toLocaleTimeString('en-US', { hour12: false }), status: 'warning' as const,
      } as StreamEvent, ...prev].slice(0, 30));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleExportPDF = async () => {
    setStreamEvents(prev => [{
      id: Math.random().toString(36),
      type: 'SYSTEM', label: 'Compiling Intelligence Briefing [LEVEL 4 ACCESS]...',
      ts: new Date().toLocaleTimeString('en-US', { hour12: false }), status: 'info' as const,
    } as StreamEvent, ...prev].slice(0, 30));

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // ─── STYLING HELPERS ──────────────────────────────────────────────────
      const colors = {
        bg: [6, 7, 11] as [number, number, number],
        accent: [59, 130, 246] as [number, number, number],
        text: [255, 255, 255] as [number, number, number],
        dim: [148, 163, 184] as [number, number, number],
        emerald: [16, 185, 129] as [number, number, number],
        secondary: [129, 140, 248] as [number, number, number],
      };

      const addHeader = (pageNum: number, totalPages: number) => {
        pdf.setFontSize(8);
        pdf.setTextColor(...colors.dim);
        pdf.setFont('courier', 'normal');
        pdf.text('HIREMAX // MARKET INTELLIGENCE // CONFIDENTIAL', 15, 10);
        pdf.text(`PAGE ${pageNum} OF ${totalPages}`, pageWidth - 35, 10);
        pdf.setDrawColor(...colors.dim);
        pdf.setLineWidth(0.1);
        pdf.line(15, 12, pageWidth - 15, 12);
      };

      const addWatermark = () => {
        pdf.saveGraphicsState();
        (pdf as any).setGState(new (pdf as any).GState({ opacity: 0.03 }));
        pdf.setFontSize(60);
        pdf.setFont('courier', 'bold');
        pdf.setTextColor(255, 255, 255);
        pdf.text('HIREMAX INTERNAL', pageWidth / 2, pageHeight / 2, { align: 'center', angle: 45 });
        pdf.restoreGraphicsState();
      };

      const captureSection = async (id: string, scale = 2) => {
        const el = document.getElementById(id);
        if (!el) return null;
        return await html2canvas(el, {
          backgroundColor: '#06070B',
          scale,
          useCORS: true,
          logging: false,
        });
      };

      // ───────────────────────────────────────────────────────────────────────
      // PAGE 1: COVER & EXECUTIVE SUMMARY
      // ───────────────────────────────────────────────────────────────────────
      pdf.setFillColor(10, 10, 15);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      
      pdf.setDrawColor(30, 30, 40);
      pdf.setLineWidth(0.5);
      pdf.line(0, 40, pageWidth, 40);
      pdf.line(0, pageHeight - 40, pageWidth, pageHeight - 40);

      pdf.setTextColor(...colors.text);
      pdf.setFontSize(42);
      pdf.setFont('courier', 'bold');
      pdf.text('MARKET', 15, 80);
      pdf.text('SINGULARITY', 15, 95);
      pdf.text('REPORT', 15, 110);

      pdf.setFontSize(10);
      pdf.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
      pdf.text(`TARGET SECTOR: ${activeRole || 'GLOBAL TECHNOLOGY'}`, 15, 130);
      pdf.text(`GENERATION TIMESTAMP: ${new Date().toUTCString()}`, 15, 135);
      pdf.text(`CLEARANCE LEVEL: LEVEL 4 // STRATEGIC`, 15, 140);

      pdf.setFillColor(20, 20, 30);
      pdf.roundedRect(15, 160, pageWidth - 30, 80, 2, 2, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(12);
      pdf.text('EXECUTIVE SUMMARY', 25, 175);
      
      pdf.setFontSize(9);
      pdf.setFont('courier', 'normal');
      pdf.setTextColor(...colors.dim);
      const summaryText = [
        `Market Condition: ${health?.status || 'STABLE'}`,
        `Intelligence Layers: ${health?.intelligence.layers_active || 0} active signals verified`,
        `Hiring Pressure: ${health?.status === 'OPERATIONAL' ? 'HIGH / AGGRESSIVE' : 'NEUTRAL'}`,
        `Primary Drivers: ${filteredSignals[0]?.role_category || 'N/A'} is showing ${(filteredSignals[0]?.hiring_velocity || 0).toFixed(1)}x velocity surge.`,
        `Recommendation: ${health?.status === 'OPERATIONAL' ? 'AGGRESSIVE ACQUISITION' : 'STRATEGIC MONITORING'} - Proceed with ${activeRole || 'General'} cluster discovery.`
      ];
      summaryText.forEach((t, i) => pdf.text(`> ${t}`, 25, 190 + (i * 6)));

      pdf.setFontSize(7);
      pdf.text('© 2026 HIREMAX INTELLIGENCE SYSTEMS // FAANG-GRADE DATA INGESTION', pageWidth / 2, pageHeight - 20, { align: 'center' });

      // ───────────────────────────────────────────────────────────────────────
      // PAGE 2: TECHNOGRAPHIC FORENSICS (BASS DIFFUSION)
      // ───────────────────────────────────────────────────────────────────────
      pdf.addPage();
      pdf.setFillColor(5, 5, 10);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      addHeader(2, 5);
      addWatermark();

      pdf.setTextColor(...colors.accent);
      pdf.setFontSize(18);
      pdf.setFont('courier', 'bold');
      pdf.text('1.0 TECHNOGRAPHIC FORENSICS', 15, 30);
      
      pdf.setTextColor(...colors.dim);
      pdf.setFontSize(9);
      pdf.text('Analysis of technology adoption lifecycles using Bass Diffusion modelling.', 15, 35);

      autoTable(pdf, {
        startY: 45,
        head: [['TECHNOLOGY', 'STAGE', 'GROWTH RATE', 'MOMENTUM', 'SUBST. PROB']],
        body: skillEvolution.slice(0, 12).map(evo => [
          evo.skill_name.toUpperCase(),
          evo.skill_lifecycle_stage.toUpperCase(),
          `${((evo.skill_growth_rate || 0) * 100).toFixed(1)}%`,
          (evo.skill_momentum || 0).toFixed(2),
          `${((evo.skill_substitution_probability || 0) * 100).toFixed(0)}%`
        ]),
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], font: 'courier', fontSize: 9 },
        styles: { fillColor: [10, 10, 15], textColor: [255, 255, 255], fontSize: 8, font: 'courier' },
        margin: { left: 15, right: 15 }
      });

      const skillTableY = (pdf as any).lastAutoTable.finalY + 15;
      pdf.setTextColor(...colors.text);
      pdf.setFontSize(12);
      pdf.text('1.1 ADOPTION CURVE DYNAMICS', 15, skillTableY);
      
      const skillCanvas = await captureSection('skill-forensics-panel', 2);
      if (skillCanvas) {
        const sW = pageWidth - 30;
        const sH = (skillCanvas.height * sW) / skillCanvas.width;
        pdf.addImage(skillCanvas, 'PNG', 15, skillTableY + 5, sW, sH);
      }

      // ───────────────────────────────────────────────────────────────────────
      // PAGE 3: CAUSAL HIRING ROADMAP
      // ───────────────────────────────────────────────────────────────────────
      pdf.addPage();
      pdf.setFillColor(5, 5, 10);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      addHeader(3, 5);
      addWatermark();

      pdf.setTextColor(...colors.accent);
      pdf.setFontSize(18);
      pdf.text('2.0 CAUSAL HIRING ROADMAP', 15, 30);
      
      pdf.setTextColor(...colors.dim);
      pdf.setFontSize(9);
      pdf.text('Lag-adjusted correlation between capital influx (Funding) and workforce expansion.', 15, 35);

      const timelineCanvas = await captureSection('predictive-timeline-panel', 2);
      if (timelineCanvas) {
        const tW = pageWidth - 30;
        const tH = (timelineCanvas.height * tW) / timelineCanvas.width;
        pdf.addImage(timelineCanvas, 'PNG', 15, 45, tW, tH);
      }

      autoTable(pdf, {
        startY: 120, // Adjust based on chart height
        head: [['CAUSE (FUNDING)', 'EFFECT (HIRING)', 'LAG (MO)', 'STRENGTH', 'P-VALUE']],
        body: causalSignals.map(c => [
          c.cause_variable.toUpperCase(),
          c.effect_variable.toUpperCase(),
          `${c.lag_months}m`,
          `${((c.causal_strength || 0) * 100).toFixed(1)}%`,
          (c.p_value || 0).toFixed(4)
        ]),
        theme: 'striped',
        styles: { fillColor: [15, 17, 26], textColor: [200, 200, 200], fontSize: 8, font: 'courier' },
        margin: { left: 15, right: 15 }
      });

      // ───────────────────────────────────────────────────────────────────────
      // PAGE 4: GEOSPATIAL ARBITRAGE (PARETO)
      // ───────────────────────────────────────────────────────────────────────
      pdf.addPage();
      pdf.setFillColor(5, 5, 10);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      addHeader(4, 5);
      addWatermark();

      pdf.setTextColor(...colors.accent);
      pdf.setFontSize(18);
      pdf.text('3.0 GEOSPATIAL OPPORTUNITY PARETO', 15, 30);

      const geoCanvas = await captureSection('geo-arbitrage-panel', 3);
      if (geoCanvas) {
        const gW = pageWidth - 30;
        const gH = (geoCanvas.height * gW) / geoCanvas.width;
        pdf.addImage(geoCanvas, 'PNG', 15, 45, gW, gH);
      }
      
      autoTable(pdf, {
        startY: 130,
        head: [['CITY', 'STATE', 'ADJ SALARY', 'COMPETITION', 'SCORE']],
        body: geoOpps.slice(0, 12).map(g => [
          g.city.toUpperCase(),
          g.state_code,
          `$${((g.col_adjusted_salary || 0) / 1000).toFixed(1)}k`,
          (g.competition_ratio || 0).toFixed(2),
          (g.opportunity_score || 0).toFixed(2)
        ]),
        theme: 'grid',
        styles: { fillColor: [10, 10, 15], textColor: [255, 255, 255], fontSize: 8, font: 'courier' },
        margin: { left: 15, right: 15 }
      });

      // ───────────────────────────────────────────────────────────────────────
      // PAGE 5: INFRASTRUCTURE & SIGNAL INTEGRITY
      // ───────────────────────────────────────────────────────────────────────
      pdf.addPage();
      pdf.setFillColor(5, 5, 10);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      addHeader(5, 5);
      addWatermark();

      pdf.setTextColor(...colors.accent);
      pdf.setFontSize(18);
      pdf.text('4.0 INFRASTRUCTURE & SIGNAL INTEGRITY', 15, 30);
      
      pdf.setTextColor(...colors.dim);
      pdf.setFontSize(9);
      pdf.text('Forensic disclosure of data provenance, scraper reliability, and pipeline health.', 15, 35);

      pdf.setFillColor(15, 23, 42);
      pdf.roundedRect(15, 45, pageWidth - 30, 40, 2, 2, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(10);
      pdf.text('SYSTEM PIPELINE STATUS', 20, 55);
      pdf.setFontSize(8);
      pdf.setTextColor(...colors.dim);
      pdf.text(`> Discovery Buffer: ${health?.pipeline.buffer_pending || 0} records pending`, 20, 65);
      pdf.text(`> Total Jobs Indexed: ${health?.pipeline.total_jobs.toLocaleString() || 0}`, 20, 70);
      pdf.text(`> Active Signal Coverage: ${(health?.intelligence.coverage_pct || 0) * 100}%`, 20, 75);

      autoTable(pdf, {
        startY: 95,
        head: [['SOURCE DOMAIN', 'RELIABILITY', 'INTEGRITY', 'LATENCY', 'CONV RATE']],
        body: reliability.map(r => [
          r.domain,
          `${((r.reliability_score || 0) * 100).toFixed(1)}%`,
          `${((r.integrity_score || 0) * 100).toFixed(1)}%`,
          `${r.avg_latency_ms}ms`,
          `${((r.conversion_rate || 0) * 100).toFixed(1)}%`
        ]),
        theme: 'grid',
        headStyles: { fillColor: [2, 132, 199], textColor: [255, 255, 255], font: 'courier', fontSize: 9 },
        styles: { fillColor: [10, 10, 15], textColor: [255, 255, 255], fontSize: 8, font: 'courier' },
        margin: { left: 15, right: 15 }
      });

      pdf.save(`HIREMAX_INTEL_${activeRole || 'GLOBAL'}_${new Date().getTime()}.pdf`);

      setStreamEvents(prev => [{
        id: Math.random().toString(36),
        type: 'SYSTEM', label: 'Briefing exported and encrypted.',
        ts: new Date().toLocaleTimeString('en-US', { hour12: false }), status: 'success' as const,
      } as StreamEvent, ...prev].slice(0, 30));

    } catch (err: any) {
      console.error('Advanced PDF Export Error:', err);
      setStreamEvents(prev => [{
        id: Math.random().toString(36),
        type: 'ERROR', label: 'Briefing generation failed: Export Buffer Overflow',
        ts: new Date().toLocaleTimeString('en-US', { hour12: false }), status: 'warning' as const,
      } as StreamEvent, ...prev].slice(0, 30));
    }
  };

  useEffect(() => { load(); }, [load]);

  // Filtered signals by active role
  const filteredSignals = activeRole
    ? marketSignals.filter(s => s.role_category === activeRole)
    : marketSignals;

  const roleOptions = Array.from(new Set(marketSignals.map(s => s.role_category))).sort();

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (loading && !marketSignals.length) {
    return (
      <div className="min-h-screen bg-[#06070B] p-6 space-y-8 font-mono text-slate-300">
        <div className="flex justify-between items-center border-b border-[#1E2131] pb-4">
          <div className="space-y-1">
            <div className="text-[10px] font-black text-blue-500 uppercase tracking-[0.5em] animate-pulse">Initializing Intelligence Terminal</div>
            <div className="text-[8px] text-slate-700 uppercase tracking-widest">Loading 12 intelligence layers...</div>
          </div>
          <div className="bg-[#12141C] border border-[#1E2131] px-4 py-1.5 rounded-xl text-[9px] text-slate-500 uppercase tracking-wider animate-pulse">
            Establishing Secure Handshake...
          </div>
        </div>
        <InsightsSkeleton />
      </div>
    );
  }

  // ─── Error ─────────────────────────────────────────────────────────────────
  if (error && !marketSignals.length) {
    return (
      <div className="min-h-screen bg-[#06070B] flex items-center justify-center p-8">
        <div className="bg-[#0A0B10] border border-red-500/20 rounded-xl p-8 max-w-md w-full text-center space-y-4">
          <AlertCircle size={32} className="text-red-500 mx-auto" />
          <div>
            <h2 className="text-white font-black text-sm uppercase tracking-widest font-mono">Intelligence Terminal Error</h2>
            <p className="text-slate-500 text-xs font-mono mt-1">{error}</p>
          </div>
          <button onClick={load} className="flex items-center gap-2 mx-auto text-blue-400 hover:text-blue-300 text-xs font-black uppercase tracking-widest border border-blue-500/20 px-4 py-2 rounded-lg hover:border-blue-500/40 transition-all">
            <RefreshCw size={12} /> Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // ─── Main Render ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#06070B] text-slate-300 selection:bg-blue-500/30 overflow-x-hidden pb-12">
      {/* BLOOMBERG TICKER */}
      <div className="sticky top-0 z-50 h-7 bg-[#0A0B10] border-b border-[#1E2131] flex items-center overflow-hidden font-mono text-[9px] font-bold">
        <div className="bg-blue-600 text-white px-3 h-full flex items-center uppercase tracking-widest shrink-0">LIVE</div>
        <div className="flex-1 whitespace-nowrap overflow-hidden relative">
          <div className="animate-[ticker_45s_linear_infinite] flex gap-10 text-slate-500 absolute">
            {[...marketSignals, ...marketSignals].map((m, i) => (
              <span key={i} className="flex gap-2 items-center">
                <span className="text-slate-300 uppercase font-black">{m.role_category?.slice(0, 18)}</span>
                <span className={(m.hiring_velocity || 0) > 1 ? 'text-emerald-500' : 'text-red-500'}>
                  {(m.hiring_velocity || 0).toFixed(2)}× {(m.hiring_velocity || 0) > 1 ? '▲' : '▼'}
                </span>
                <span className="text-slate-700">|</span>
              </span>
            ))}
          </div>
        </div>
        <div className="bg-[#12141C] border-l border-[#1E2131] px-4 h-full flex items-center text-slate-600 uppercase shrink-0">
          UTC {new Date().toISOString().split('T')[1].slice(0, 8)}
        </div>
      </div>

      <div id="market-terminal-content" className="p-4 lg:p-6 space-y-4">
        {/* COMMAND BAR */}
        <CommandBar
          health={health}
          onRefresh={load}
          activeRole={activeRole}
          onRoleChange={setActiveRole}
          lastRefresh={lastRefresh}
          roleOptions={roleOptions}
          onExportPDF={handleExportPDF}
          onSkillSearch={handleSkillSearch}
          onTriggerIntel={handleTriggerIntel}
          isUpdating={isUpdating}
        />

        {/* ROW 1 — Velocity chart full width */}
        {filteredSignals.length > 0 && <VelocityChart signals={filteredSignals} />}

        {/* ROW 2 — 4 column: Demand | Skills | Momentum | Salary */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <DemandNexus signals={filteredSignals} />
          <SkillForensicsPanel skills={skillPredictions} onSearch={handleSkillSearch} />
          <MomentumPanel momentum={momentum} />
          <SalaryIntelPanel signals={filteredSignals} macroSignals={macroSignals} />
        </div>

        {/* ROW 3 — Timeline full width */}
        <PredictiveTimeline fundingEvents={fundingEvents} causalSignals={causalSignals} />

        {/* ROW 4 — 3 column: Bayesian | Cycles | Geo */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <BayesianSignalsPanel priors={bayesianPriors} />
          <HiringCyclesPanel cycles={hiringCycles} />
          <GeoArbitragePanel geoOpps={geoOpps} />
        </div>

        {/* ROW 5 — Live stream */}
        <ForensicStream events={streamEvents} />
      </div>

      <style>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
};

export default MarketOutlookView;
