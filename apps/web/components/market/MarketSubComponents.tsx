import React, { useEffect, useRef } from 'react';
import { SkillRecord, BayesianPrior } from './MarketTypes';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// GLASS CARD  (matches site's #0F1117 / border-[#2D313D] design system)
// ─────────────────────────────────────────────────────────────────────────────
export const GlassCard = ({
  children, title, accent = 'blue', className = '', badge, id,
}: {
  children: React.ReactNode; title?: string; accent?: 'blue' | 'emerald' | 'amber' | 'red' | 'purple';
  className?: string; badge?: string; id?: string;
}) => {
  const accentColor: Record<string, string> = {
    blue: 'bg-blue-500', emerald: 'bg-emerald-500',
    amber: 'bg-amber-500', red: 'bg-red-500', purple: 'bg-purple-500',
  };
  const glowColor: Record<string, string> = {
    blue: 'hover:border-blue-500/30 hover:shadow-blue-500/10',
    emerald: 'hover:border-emerald-500/30 hover:shadow-emerald-500/10',
    amber: 'hover:border-amber-500/30 hover:shadow-amber-500/10',
    red: 'hover:border-red-500/30 hover:shadow-red-500/10',
    purple: 'hover:border-purple-500/30 hover:shadow-purple-500/10',
  };
  return (
    <div id={id} className={`bg-[#0A0B10] border border-[#1E2131] rounded-lg overflow-hidden transition-all duration-300 hover:shadow-xl ${glowColor[accent]} ${className}`}>
      {title && (
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1E2131] bg-[#0D0E14]">
          <div className="flex items-center gap-2">
            <div className={`w-1 h-3.5 rounded-full ${accentColor[accent]}`} />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em] font-mono">{title}</span>
          </div>
          {badge && <span className="text-[8px] font-black uppercase tracking-widest text-slate-600 font-mono bg-white/5 px-2 py-0.5 rounded">{badge}</span>}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SPARKLINE
// ─────────────────────────────────────────────────────────────────────────────
export const Sparkline = ({ values, color = '#3b82f6', height = 28 }: { values: number[]; color?: string; height?: number }) => {
  if (!values.length) return null;
  const w = 80, h = height;
  const min = Math.min(...values), max = Math.max(...values);
  const r = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / r) * (h - 2) - 1}`).join(' ');
  const area = `${pts} ${w},${h} 0,${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="overflow-visible" style={{ width: w, height: h }}>
      <defs>
        <linearGradient id={`sg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon fill={`url(#sg-${color.replace('#','')})`} points={area} />
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={pts} />
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// STAT METRIC
// ─────────────────────────────────────────────────────────────────────────────
export const StatMetric = ({ label, value, sub, delta }: { label: string; value: string; sub?: string; delta?: number }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest font-mono">{label}</span>
    <div className="flex items-baseline gap-1.5">
      <span className="text-2xl font-black text-white tracking-tighter font-mono leading-none">{value}</span>
      {delta !== undefined && (
        <span className={`text-[10px] font-black ${delta >= 0 ? 'text-emerald-400' : 'text-red-400'} flex items-center gap-0.5`}>
          {delta >= 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
          {Math.abs(delta || 0).toFixed(1)}%
        </span>
      )}
    </div>
    {sub && <span className="text-[9px] text-slate-600 font-bold uppercase tracking-tighter font-mono">{sub}</span>}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// LIFECYCLE BADGE
// ─────────────────────────────────────────────────────────────────────────────
export const LifecycleBadge = ({ stage }: { stage: string }) => {
  const cfg: Record<string, { color: string; bg: string }> = {
    emerging: { color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' },
    growth:   { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    mature:   { color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
    decline:  { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  };
  const c = cfg[stage?.toLowerCase()] || { color: 'text-slate-500', bg: 'bg-white/5 border-white/10' };
  return (
    <span className={`text-[8px] font-black uppercase tracking-widest border px-1.5 py-0.5 rounded font-mono ${c.color} ${c.bg}`}>
      {stage || 'unknown'}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MINI BAR (progress bar)
// ─────────────────────────────────────────────────────────────────────────────
export const MiniBar = ({ value, color = '#3b82f6', max = 1 }: { value: number; color?: string; max?: number }) => (
  <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// BAYESIAN BETA DISTRIBUTION MINI CHART
// ─────────────────────────────────────────────────────────────────────────────
function betaPDF(x: number, a: number, b: number): number {
  if (x <= 0 || x >= 1) return 0;
  const logB = (n: number) => { let s = 0; for (let i = 1; i < n; i++) s += Math.log(i); return s; };
  return Math.pow(x, a - 1) * Math.pow(1 - x, b - 1);
}

export const BetaDistChart = ({ prior }: { prior: BayesianPrior }) => {
  const { alpha, beta } = prior;
  const mean = alpha / (alpha + beta);
  const pts = Array.from({ length: 40 }, (_, i) => {
    const x = (i + 0.5) / 40;
    return { x, y: betaPDF(x, alpha, beta) };
  });
  const maxY = Math.max(...pts.map(p => p.y), 0.01);
  const w = 100, h = 40;
  const svgPts = pts.map(p => `${p.x * w},${h - (p.y / maxY) * (h - 2)}`).join(' ');
  const conf = Math.min(1, (alpha + beta) / 50);
  const confColor = conf > 0.7 ? '#10b981' : conf > 0.3 ? '#f59e0b' : '#ef4444';

  return (
    <div className="bg-[#06070B] border border-[#1E2131] rounded-lg p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest font-mono truncate">{prior.parameter_name.replace(/_/g, ' ')}</span>
        <span className="text-[8px] font-mono" style={{ color: confColor }}>n={prior.observations_count}</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: h }}>
        <defs>
          <linearGradient id={`bd-${prior.parameter_name}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon fill={`url(#bd-${prior.parameter_name})`} points={`${svgPts} ${w},${h} 0,${h}`} />
        <polyline fill="none" stroke="#3b82f6" strokeWidth="1.5" points={svgPts} />
        <line x1={mean * w} y1={0} x2={mean * w} y2={h} stroke="#60a5fa" strokeWidth="1" strokeDasharray="2,2" opacity="0.6" />
      </svg>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black text-white font-mono">{((mean || 0) * 100).toFixed(1)}%</span>
        <span className="text-[8px] text-slate-600 font-mono">α={(alpha || 0).toFixed(1)} β={(beta || 0).toFixed(1)}</span>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SKILL ROW (for emerging/stable/declining lists)
// ─────────────────────────────────────────────────────────────────────────────
export const SkillRow = ({ skill, rank }: { skill: SkillRecord; rank: number }) => {
  const stage = skill.lifecycle_stage || 'mature';
  const velColor = skill.velocity > 1.5 ? '#10b981' : skill.velocity > 1.0 ? '#3b82f6' : skill.velocity > 0.8 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-white/[0.04] last:border-0 group hover:bg-white/[0.02] -mx-1 px-1 rounded transition-colors">
      <span className="text-[9px] text-slate-700 font-mono w-4 flex-shrink-0">{rank}</span>
      <span className="text-[11px] font-bold text-slate-200 flex-1 truncate">{skill.skill_name}</span>
      <span className="text-[9px] font-mono" style={{ color: velColor }}>{(skill.velocity || 0).toFixed(2)}×</span>
      <LifecycleBadge stage={stage} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// POLAR CYCLE RING  (for hiring cycles)
// ─────────────────────────────────────────────────────────────────────────────
const MONTHS = ['J','F','M','A','M','J','J','A','S','O','N','D'];
export const PolarCycleRing = ({ pattern, color = '#3b82f6', label }: { pattern: number[]; color?: string; label?: string }) => {
  const cx = 60, cy = 60, r = 42, innerR = 20;
  const max = Math.max(...pattern, 0.01);
  const slices = pattern.map((val, i) => {
    const startAngle = (i / 12) * 2 * Math.PI - Math.PI / 2;
    const endAngle = ((i + 1) / 12) * 2 * Math.PI - Math.PI / 2;
    const norm = val / max;
    const outerR = innerR + (r - innerR) * norm;
    const x1 = cx + innerR * Math.cos(startAngle), y1 = cy + innerR * Math.sin(startAngle);
    const x2 = cx + outerR * Math.cos(startAngle), y2 = cy + outerR * Math.sin(startAngle);
    const x3 = cx + outerR * Math.cos(endAngle), y3 = cy + outerR * Math.sin(endAngle);
    const x4 = cx + innerR * Math.cos(endAngle), y4 = cy + innerR * Math.sin(endAngle);
    return { d: `M${x1},${y1} L${x2},${y2} A${outerR},${outerR} 0 0,1 ${x3},${y3} L${x4},${y4} A${innerR},${innerR} 0 0,0 ${x1},${y1}Z`, norm };
  });
  const labels = MONTHS.map((m, i) => {
    const a = (i / 12) * 2 * Math.PI - Math.PI / 2;
    return { m, x: cx + (r + 9) * Math.cos(a), y: cy + (r + 9) * Math.sin(a) };
  });
  return (
    <svg viewBox="0 0 120 120" className="w-full max-w-[150px] mx-auto">
      {slices.map((s, i) => (
        <path key={i} d={s.d} fill={color} opacity={0.2 + s.norm * 0.7} />
      ))}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
      <circle cx={cx} cy={cy} r={innerR} fill="#06070B" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      {labels.map((l, i) => (
        <text key={i} x={l.x} y={l.y} textAnchor="middle" dominantBaseline="middle" className="font-mono" fontSize="5" fill="rgba(148,163,184,0.6)">{l.m}</text>
      ))}
      {label && <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="7" fill="rgba(255,255,255,0.7)" fontWeight="bold">{label}</text>}
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// LIVE STREAM ENTRY
// ─────────────────────────────────────────────────────────────────────────────
export const StreamEntry = ({ type, label, ts, status }: { type: string; label: string; ts: string; status: 'success' | 'warning' | 'info' }) => {
  const color = status === 'success' ? 'text-emerald-400' : status === 'warning' ? 'text-amber-400' : 'text-blue-400';
  return (
    <div className="flex items-start gap-2 text-[9px] py-1.5 border-b border-white/[0.03] last:border-0 font-mono animate-in slide-in-from-top-1 duration-300">
      <span className="text-slate-700 shrink-0">{ts}</span>
      <span className={`${color} font-black shrink-0`}>[{type}]</span>
      <span className="text-slate-400 truncate">{label}</span>
    </div>
  );
};
