import React from 'react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  ScatterChart, Scatter, Cell, ReferenceLine, LineChart, Line
} from 'recharts';
import { TrendingUp, TrendingDown, Globe, Zap, DollarSign, Brain, AlertTriangle, CheckCircle2, Info, RefreshCw } from 'lucide-react';
import { GlassCard, Sparkline, StatMetric, LifecycleBadge, MiniBar, BetaDistChart, SkillRow, PolarCycleRing, StreamEntry } from './MarketSubComponents';
import type { MarketSignal, GeoOpportunity, HiringCycle, BayesianPrior, FundingEvent, SkillPrediction, MacroSignal, MomentumSignal, SystemHealth } from './MarketTypes';

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ─────────────────────────────────────────────────────────────────────────────
// 1. COMMAND BAR (top status strip)
// ─────────────────────────────────────────────────────────────────────────────
export const CommandBar = ({
  health, onRefresh, activeRole, onRoleChange, lastRefresh, roleOptions, onExportPDF, onSkillSearch, onTriggerIntel, isUpdating,
}: {
  health: SystemHealth | null; onRefresh: () => void; activeRole: string;
  onRoleChange: (r: string) => void; lastRefresh: Date | null; roleOptions: string[];
  onExportPDF: () => void; onSkillSearch: (s: string) => void;
  onTriggerIntel: () => void; isUpdating: boolean;
}) => {
  const statusColor = !health ? 'bg-slate-500' : health.status === 'OPERATIONAL' ? 'bg-emerald-500' : health.status === 'WARMING_UP' ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="bg-[#0A0B10] border border-[#1E2131] rounded-lg flex flex-wrap lg:flex-nowrap items-center gap-px overflow-hidden">
      {/* Brand */}
      <div className="px-5 py-4 flex items-center gap-3 border-r border-[#1E2131] shrink-0">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <Brain size={16} className="text-white" />
        </div>
        <div>
          <div className="text-xs font-black text-white uppercase tracking-widest font-mono">Intelligence</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`w-1.5 h-1.5 rounded-full ${statusColor} animate-pulse`} />
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] font-mono">{health?.status || 'CONNECTING'}</span>
          </div>
        </div>
      </div>

      {/* Wiring Alert (Zero-Blindspot Warning) */}
      {health?.wiring && health.wiring.missing_secrets.length > 0 && (
        <div className="px-4 py-4 border-r border-[#1E2131] bg-red-500/5 flex items-center gap-3 animate-pulse">
          <AlertTriangle size={14} className="text-red-500" />
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-red-500 uppercase tracking-widest font-mono">Missing Config</span>
            <span className="text-[8px] text-red-400/70 font-mono truncate max-w-[120px]">
              {health.wiring.missing_secrets.join(', ')}
            </span>
          </div>
        </div>
      )}

      {/* Live Metrics */}
      <div className="flex flex-1 flex-wrap">
        {[
          { label: 'Verified Jobs', val: health?.pipeline?.active_verified_jobs?.toLocaleString() ?? '…' },
          { label: 'Intel Layers', val: health ? `${health.intelligence.layers_active}/${health.intelligence.layers_total}` : '…' },
          { label: 'Coverage', val: health ? `${health.intelligence.coverage_pct}%` : '…' },
        ].map((m, i) => (
          <div key={i} className="px-5 py-4 border-r border-[#1E2131] flex flex-col gap-0.5">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest font-mono">{m.label}</span>
            <span className="text-lg font-black text-white font-mono tracking-tighter">{m.val}</span>
          </div>
        ))}
      </div>

      {/* Role Filter */}
      <div className="px-4 py-4 border-l border-[#1E2131] flex items-center gap-2">
        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest font-mono shrink-0">Role:</label>
        <select
          value={activeRole}
          onChange={e => onRoleChange(e.target.value)}
          className="bg-[#12141C] border border-[#1E2131] text-white text-[10px] font-bold font-mono px-2 py-1.5 rounded focus:outline-none focus:border-blue-500/50 min-w-[140px]"
        >
          <option value="">All Roles</option>
          {roleOptions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* Global Skill Pulse */}
      <div className="px-4 py-4 border-l border-[#1E2131] flex items-center gap-2 shrink-0">
        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest font-mono shrink-0">Skill Pulse:</label>
        <div className="relative">
          <input
            type="text"
            placeholder="Search skill..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onSkillSearch((e.target as HTMLInputElement).value);
              }
            }}
            className="bg-[#12141C] border border-[#1E2131] text-white text-[10px] font-bold font-mono px-3 py-1.5 rounded focus:outline-none focus:border-purple-500/50 w-32"
          />
        </div>
      </div>

      {/* Action Suite */}
      <div className="px-4 py-4 border-l border-[#1E2131] flex items-center gap-3">
        <button
          onClick={onTriggerIntel}
          disabled={isUpdating}
          className={`group relative flex items-center gap-2 px-4 py-2 rounded-lg border transition-all font-mono text-[9px] font-black uppercase tracking-widest ${
            isUpdating 
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 cursor-wait' 
              : 'bg-blue-600/10 border-blue-500/30 text-blue-400 hover:bg-blue-600 hover:text-white hover:border-blue-500'
          }`}
        >
          <Zap size={12} className={isUpdating ? 'animate-bounce' : 'group-hover:animate-pulse'} />
          {isUpdating ? 'Synchronizing Layers...' : 'Trigger Intel Sweep'}
        </button>

        <button 
          onClick={onExportPDF}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600 hover:text-white hover:border-emerald-500 transition-all font-mono text-[9px] font-black uppercase tracking-widest"
        >
          <div className={`w-2 h-2 rounded-full bg-emerald-500 ${!isUpdating && 'animate-pulse'}`} />
          Intelligence Report (PDF)
        </button>
        
        <button 
          onClick={onRefresh}
          className="p-2 rounded-lg hover:bg-white/5 text-slate-500 hover:text-white transition-all"
          title="Refresh Snapshot"
        >
          <RefreshCw size={14} className={isUpdating ? 'animate-spin' : ''} />
        </button>
        {lastRefresh && <span className="text-[8px] text-slate-700 font-mono shrink-0">{lastRefresh.toLocaleTimeString('en-US', { hour12: false })}</span>}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. DEMAND NEXUS — top 4 stats for the selected role
// ─────────────────────────────────────────────────────────────────────────────
export const DemandNexus = ({ signals }: { signals: MarketSignal[] }) => {
  const total = signals.reduce((s, r) => s + (r.job_count_30d || 0), 0);
  const avgVel = signals.length ? signals.reduce((s, r) => s + r.hiring_velocity, 0) / signals.length : 0;
  const avgDemand = signals.length ? signals.reduce((s, r) => s + r.demand_index, 0) / signals.length : 0;
  const avgScarcity = signals.length ? signals.reduce((s, r) => s + r.scarcity_index, 0) / signals.length : 0;

  const velDelta = (avgVel - 1) * 100;
  return (
    <GlassCard title="Market Demand Overview" accent="blue" badge="Live" id="demand-nexus-panel">
      <div className="grid grid-cols-2 gap-4">
        <StatMetric label="Open Positions" value={total.toLocaleString()} sub="Last 30 days" />
        <StatMetric label="Hiring Velocity" value={`${(avgVel || 0).toFixed(2)}×`} sub="vs Prior Period" delta={velDelta} />
        <StatMetric label="Demand Index" value={`${((avgDemand || 0) * 100).toFixed(0)}%`} sub="Market Share" />
        <StatMetric label="Scarcity" value={`${((avgScarcity || 0) * 100).toFixed(0)}%`} sub="Supply Pressure" />
      </div>
      {/* role demand bars */}
      <div className="mt-4 space-y-2">
        {signals.slice(0, 6).map((s, i) => (
          <div key={i} className="space-y-0.5">
            <div className="flex justify-between text-[9px] font-mono">
              <span className="text-slate-300 font-bold">{s.role_category}</span>
              <span className="text-slate-500">{s.job_count_30d} jobs</span>
            </div>
            <MiniBar value={s.demand_index} color="#3b82f6" max={Math.max(...signals.map(x => x.demand_index), 0.01)} />
          </div>
        ))}
      </div>
    </GlassCard>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. DEEP SKILL FORENSICS (Search + Drill-down)
// ─────────────────────────────────────────────────────────────────────────────
export const SkillForensicsPanel = ({ 
  skills, onSearch 
}: { 
  skills: SkillPrediction[]; onSearch: (s: string) => void 
}) => {
  const [query, setQuery] = React.useState('');
  return (
    <GlassCard title="Autonomous Skill Forensics" accent="purple" badge="Deep Scan" id="skill-forensics-panel">
      <div className="space-y-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Search skill forensics..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-[#12141C] border border-[#1E2131] text-white text-[10px] font-bold font-mono px-3 py-2 rounded focus:outline-none focus:border-purple-500/50"
          />
          <button 
            onClick={() => onSearch(query)}
            className="absolute right-2 top-2 text-[8px] font-black text-purple-400 uppercase tracking-widest hover:text-purple-300"
          >
            Detect
          </button>
        </div>
        <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/5">
          {skills.map((sk, i) => (
            <div key={i} className="flex items-center justify-between p-2 rounded bg-white/[0.02] border border-white/[0.04] hover:border-purple-500/20 transition-all cursor-pointer group">
              <div className="flex flex-col">
                <span className="text-[11px] font-black text-white font-mono">{sk.skill}</span>
                <span className="text-[8px] text-slate-500 uppercase tracking-widest font-mono">
                  {sk.lifecycle_stage} · {((sk.growth_rate_annual || 0) * 100).toFixed(1)}% YoY
                </span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <MiniBar value={sk.confidence} color="#a855f7" max={1} />
                <span className="text-[9px] font-black text-purple-400">{((sk.confidence || 0) * 100).toFixed(0)}% CONF</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. GEO ARBITRAGE — scatter Pareto plot
// ─────────────────────────────────────────────────────────────────────────────
export const GeoArbitragePanel = ({ geoOpps }: { geoOpps: GeoOpportunity[] }) => {
  if (!geoOpps.length) return <GlassCard title="Geographic Arbitrage" accent="emerald"><p className="text-slate-600 text-xs">Run optimize-geography function to populate</p></GlassCard>;

  const top = geoOpps.slice(0, 15);
  const maxJobs = Math.max(...top.map(g => g.job_count), 1);

  return (
    <GlassCard title="Geographic Arbitrage" accent="emerald" badge="Pareto" id="geo-arbitrage-panel">
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 4, right: 8, bottom: 16, left: -10 }}>
            <CartesianGrid strokeDasharray="2 2" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="competition_ratio" name="Competition" type="number" tick={{ fill: '#475569', fontSize: 8, fontFamily: 'monospace' }} label={{ value: 'Competition', position: 'insideBottom', offset: -8, fill: '#334155', fontSize: 8 }} />
            <YAxis dataKey="col_adjusted_salary" name="COL-Adj Salary" type="number" tick={{ fill: '#475569', fontSize: 8, fontFamily: 'monospace' }} tickFormatter={v => `$${((v || 0) / 1000).toFixed(0)}k`} />
            <Tooltip
              cursor={{ strokeDasharray: '2 2', stroke: '#3b82f6' }}
              content={({ payload }) => {
                if (!payload?.length) return null;
                const d = payload[0].payload as GeoOpportunity;
                return (
                  <div className="bg-[#0A0B10] border border-blue-500/30 p-3 rounded-lg text-[9px] font-mono shadow-2xl min-w-[140px]">
                    <div className="font-black text-white text-[11px] mb-1">{d.city}</div>
                    <div className="text-slate-400">{d.role}</div>
                    <div className="mt-1.5 space-y-0.5">
                      <div className="flex justify-between gap-4"><span className="text-slate-500">COL-Adj</span><span className="text-emerald-400 font-black">${((d.col_adjusted_salary || 0) / 1000).toFixed(0)}k</span></div>
                      <div className="flex justify-between gap-4"><span className="text-slate-500">Jobs</span><span className="text-white">{d.job_count}</span></div>
                      <div className="flex justify-between gap-4"><span className="text-slate-500">Competition</span><span className="text-white">{d.competition_ratio?.toFixed(1)}:1</span></div>
                      <div className="flex justify-between gap-4"><span className="text-slate-500">Score</span><span className="text-blue-400 font-black">{((d.opportunity_score || 0) * 100).toFixed(0)}</span></div>
                    </div>
                  </div>
                );
              }}
            />
            <Scatter data={top} name="Cities">
              {top.map((entry, i) => (
                <Cell key={i} fill={entry.opportunity_score > 0.7 ? '#10b981' : entry.opportunity_score > 0.4 ? '#3b82f6' : '#6b7280'} fillOpacity={0.8} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      {/* Top 3 table */}
      <div className="mt-2 space-y-1">
        {geoOpps.sort((a, b) => b.opportunity_score - a.opportunity_score).slice(0, 3).map((g, i) => (
          <div key={i} className="flex items-center gap-2 text-[9px] font-mono py-1 border-b border-white/[0.04] last:border-0">
            <span className="text-slate-600">#{i + 1}</span>
            <span className="text-white font-black flex-1">{g.city}</span>
            <span className="text-emerald-400">${((g.col_adjusted_salary || 0) / 1000).toFixed(0)}k adj</span>
            <span className="text-slate-500">{g.job_count} jobs</span>
          </div>
        ))}
      </div>
    </GlassCard>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. BAYESIAN SIGNALS GRID
// ─────────────────────────────────────────────────────────────────────────────
export const BayesianSignalsPanel = ({ priors }: { priors: BayesianPrior[] }) => {
  if (!priors.length) return (
    <GlassCard title="Bayesian Learning" accent="purple">
      <p className="text-slate-600 text-xs font-mono">Run bayesian-outcome-learner to seed priors</p>
    </GlassCard>
  );
  const globalRate = priors.find(p => p.parameter_name === 'cold_apply_rate');
  const rate = globalRate ? globalRate.alpha / (globalRate.alpha + globalRate.beta) : null;
  return (
    <GlassCard title="Bayesian Signal Learning" accent="purple" badge={rate !== null ? `${((rate || 0) * 100).toFixed(1)}% callback` : undefined}>
      <div className="grid grid-cols-2 gap-2">
        {priors.slice(0, 6).map((p, i) => <BetaDistChart key={i} prior={p} />)}
      </div>
    </GlassCard>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. HIRING CYCLES — polar ring grid
// ─────────────────────────────────────────────────────────────────────────────
export const HiringCyclesPanel = ({ cycles }: { cycles: HiringCycle[] }) => {
  if (!cycles.length) return (
    <GlassCard title="Hiring Cycles" accent="amber">
      <p className="text-slate-600 text-xs font-mono">Run detect-hiring-cycles to populate</p>
    </GlassCard>
  );
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];
  return (
    <GlassCard title="Seasonal Hiring Cycles" accent="amber" badge="STL Model">
      <div className="grid grid-cols-2 gap-3">
        {cycles.slice(0, 4).map((c, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <PolarCycleRing pattern={c.annual_pattern || Array(12).fill(0.5)} color={colors[i % colors.length]} label={c.company_name?.slice(0, 4).toUpperCase()} />
            <div className="text-center">
              <div className="text-[9px] font-black text-white font-mono truncate">{c.company_name}</div>
              <div className="text-[8px] text-slate-500 font-mono">
                Peak: {c.peak_months?.map(m => MONTH_LABELS[m])?.join(', ') || '—'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. SALARY INTELLIGENCE
// ─────────────────────────────────────────────────────────────────────────────
export const SalaryIntelPanel = ({ signals, macroSignals }: { signals: MarketSignal[]; macroSignals: MacroSignal[] }) => {
  const salaryData = signals
    .filter(s => s.salary_p50 && s.salary_p50 > 0)
    .sort((a, b) => (b.salary_p50 || 0) - (a.salary_p50 || 0))
    .slice(0, 8);

  const unemploymentRow = macroSignals.find(m => m.indicator === 'unemployment_rate');
  const interestRow = macroSignals.find(m => m.indicator === 'interest_rate');

  if (!salaryData.length) return (
    <GlassCard title="Salary Intelligence" accent="amber">
      <p className="text-slate-600 text-xs font-mono">Run ingest-h1b-salaries to populate salary data</p>
    </GlassCard>
  );

  return (
    <GlassCard title="Salary Intelligence (H1B + Market)" accent="amber" badge="P50" id="salary-intel-panel">
      <div className="space-y-2 mb-3">
        {salaryData.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[9px] font-mono text-slate-400 flex-1 truncate">{s.role_category}</span>
            <span className="text-[11px] font-black text-amber-400 font-mono">${((s.salary_p50 || 0) / 1000).toFixed(0)}k</span>
            <MiniBar value={s.salary_p50 || 0} color="#f59e0b" max={Math.max(...salaryData.map(x => x.salary_p50 || 0), 1)} />
          </div>
        ))}
      </div>
      {(unemploymentRow || interestRow) && (
        <div className="border-t border-[#1E2131] pt-2 grid grid-cols-2 gap-2 mt-2">
          {unemploymentRow && <div className="bg-[#06070B] rounded p-2"><div className="text-[8px] text-slate-500 font-mono uppercase">Unemployment</div><div className="text-sm font-black text-white font-mono">{(unemploymentRow.value || 0).toFixed(1)}%</div></div>}
          {interestRow && <div className="bg-[#06070B] rounded p-2"><div className="text-[8px] text-slate-500 font-mono uppercase">Interest Rate</div><div className="text-sm font-black text-white font-mono">{(interestRow.value || 0).toFixed(2)}%</div></div>}
        </div>
      )}
    </GlassCard>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 8. PREDICTIVE TIMELINE (funding events)
// ─────────────────────────────────────────────────────────────────────────────
export const PredictiveTimeline = ({ fundingEvents, causalSignals }: { fundingEvents: FundingEvent[]; causalSignals: any[] }) => {
  if (!fundingEvents.length) return (
    <GlassCard title="Predictive Event Timeline" accent="blue" className="col-span-full">
      <p className="text-slate-600 text-xs font-mono">Run ingest-crunchbase-news to populate funding events</p>
    </GlassCard>
  );

  const topCausal = causalSignals[0];
  const lagMonths = topCausal?.lag_months || 3;

  return (
    <GlassCard title="Funding → Hiring Causal Timeline" accent="blue" className="col-span-full" badge={topCausal ? `+${lagMonths}mo lag, p=${topCausal.p_value?.toFixed(3)}` : 'Causal Model'} id="predictive-timeline-panel">
      <div className="relative">
        {/* Timeline rail */}
        <div className="absolute left-0 right-0 top-8 h-px bg-[#1E2131]" />
        <div className="flex gap-4 overflow-x-auto pb-2 pt-2">
          {fundingEvents.slice(0, 8).map((ev, i) => {
            const fundDate = new Date(ev.date);
            const predDate = new Date(fundDate.getTime() + lagMonths * 30 * 24 * 60 * 60 * 1000);
            const isPast = fundDate < new Date();
            return (
              <div key={i} className="flex flex-col items-center gap-2 min-w-[130px]">
                {/* Event node */}
                <div className={`relative z-10 rounded-lg border p-2.5 cursor-default transition-all hover:-translate-y-1 hover:shadow-lg w-full ${isPast ? 'bg-[#0D1017] border-[#1E2131]' : 'bg-[#0D1221] border-blue-500/20'}`}>
                  <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest font-mono">{ev.round_type || 'Funding'}</div>
                  <div className="text-[11px] font-black text-white font-mono truncate mt-0.5">{ev.company_name}</div>
                  <div className="text-[10px] text-emerald-400 font-mono font-black">${((ev.amount_usd || 0) / 1_000_000).toFixed(0)}M</div>
                  <div className="text-[8px] text-slate-600 font-mono mt-1">{fundDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}</div>
                </div>
                {/* Arrow */}
                <div className="text-[9px] text-blue-400 font-mono">↓ +{lagMonths}mo</div>
                {/* Predicted hiring spike */}
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-2 w-full">
                  <div className="text-[9px] font-black text-blue-400 font-mono uppercase">Predicted Hiring</div>
                  <div className="text-[9px] text-slate-400 font-mono mt-0.5">{predDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}</div>
                  {topCausal && <div className="text-[8px] text-slate-600 font-mono mt-0.5">Strength: {((topCausal.causal_strength || 0) * 100).toFixed(0)}%</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </GlassCard>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 9. MOMENTUM + COMPANY SIGNALS
// ─────────────────────────────────────────────────────────────────────────────
export const MomentumPanel = ({ momentum }: { momentum: MomentumSignal[] }) => (
  <GlassCard title="Hiring Momentum Radar" accent="blue" badge="HMA" id="momentum-panel">
    <div className="space-y-2">
      {momentum.slice(0, 10).map((d, i) => {
        const color = d.hma_score > 1.5 ? '#10b981' : d.hma_score > 1.0 ? '#3b82f6' : d.hma_score > 0.5 ? '#f59e0b' : '#ef4444';
        const sparkVals = [0.6, 0.8, d.hma_score * 0.7, d.hma_score * 0.9, d.hma_score];
        return (
          <div key={i} className="flex items-center gap-3 py-1.5 border-b border-white/[0.04] last:border-0 group hover:bg-white/[0.02] -mx-1 px-1 rounded transition-colors cursor-default">
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-black text-white font-mono truncate">{d.company}</div>
              <div className="text-[8px] text-slate-600 font-mono">{d.role_category || 'Multi-role'}</div>
            </div>
            <Sparkline values={sparkVals} color={color} />
            <div className="text-right">
              <div className="text-[11px] font-black font-mono" style={{ color }}>{(d.hma_score || 0).toFixed(2)}×</div>
              <div className="text-[8px] text-slate-600 font-mono">{((d.confidence_score || 0) * 100).toFixed(0)}%</div>
            </div>
          </div>
        );
      })}
    </div>
  </GlassCard>
);

// ─────────────────────────────────────────────────────────────────────────────
// 10. LIVE FORENSIC STREAM
// ─────────────────────────────────────────────────────────────────────────────
export const ForensicStream = ({ events }: { events: Array<{ id: string; type: string; label: string; ts: string; status: 'success' | 'warning' | 'info' }> }) => (
  <GlassCard title="Forensic Intelligence Stream" accent="blue" badge="Live" className="col-span-full">
    <div className="max-h-40 overflow-y-auto space-y-0 pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
      {events.length > 0
        ? events.map(e => <StreamEntry key={e.id} type={e.type} label={e.label} ts={e.ts} status={e.status} />)
        : <p className="text-slate-700 text-[9px] font-mono animate-pulse">Awaiting signal events…</p>
      }
    </div>
  </GlassCard>
);

// ─────────────────────────────────────────────────────────────────────────────
// 11. VELOCITY CHART — historical velocity across roles
// ─────────────────────────────────────────────────────────────────────────────
export const VelocityChart = ({ signals }: { signals: MarketSignal[] }) => {
  const data = signals.slice(0, 10).map(s => ({
    name: s.role_category.length > 14 ? s.role_category.slice(0, 12) + '…' : s.role_category,
    velocity: parseFloat((s.hiring_velocity || 0).toFixed(2)),
    demand: parseFloat(((s.demand_index || 0) * 100).toFixed(1)),
    scarcity: parseFloat(((s.scarcity_index || 0) * 100).toFixed(1)),
  }));
  return (
    <GlassCard title="Role Velocity Matrix" accent="blue" className="col-span-full" id="velocity-matrix-panel">
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 16, left: -16, bottom: 16 }}>
            <defs>
              <linearGradient id="velGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="demGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 2" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 8, fontFamily: 'monospace' }} interval={0} angle={-20} textAnchor="end" />
            <YAxis tick={{ fill: '#475569', fontSize: 8, fontFamily: 'monospace' }} />
            <Tooltip
              contentStyle={{ background: '#0A0B10', border: '1px solid #1E2131', borderRadius: 8, fontSize: 10, fontFamily: 'monospace' }}
              labelStyle={{ color: '#e2e8f0', fontWeight: 900 }}
              itemStyle={{ color: '#94a3b8' }}
            />
            <ReferenceLine y={1} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.5} />
            <Area type="monotone" dataKey="velocity" stroke="#3b82f6" fill="url(#velGrad)" strokeWidth={2} name="Velocity ×" />
            <Area type="monotone" dataKey="demand" stroke="#10b981" fill="url(#demGrad)" strokeWidth={1.5} name="Demand %" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
};
