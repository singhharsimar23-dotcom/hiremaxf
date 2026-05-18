import React from 'react';
import {
    Target, ExternalLink, MapPin, ShieldCheck, Sparkles, Loader2,
    DollarSign, Zap, Code2, Lock, Briefcase, GraduationCap,
    TrendingUp, CheckCircle2, BarChart3, Tag, Clock, Globe,
    Building2, Users, AlertCircle, ChevronRight, Timer,
    Award, BadgeCheck, FileText
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchLabel {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    iconColor: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const getMatchLabel = (m: any): MatchLabel => {
    const score = m?.analysis?.skill_coverage_pct || 0;
    if (score >= 80) return { label: 'Strong Match', color: 'text-green-400', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/20', iconColor: 'text-green-400' };
    if (score >= 50) return { label: 'Good Match', color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/20', iconColor: 'text-blue-400' };
    return { label: 'Fair Match', color: 'text-amber-400', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/20', iconColor: 'text-amber-400' };
};

const formatSalary = (min?: number | null, max?: number | null, currency = 'USD', period = 'yearly', raw?: string | null): string | null => {
    // Use parsed numeric values first
    if (min || max) {
        const fmt = (v: number) => v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`;
        if (min && max) return `${fmt(min)} – ${fmt(max)}`;
        if (min) return `${fmt(min)}+`;
    }
    // Fallback to raw string
    if (raw) return raw;
    return null;
};

const formatPostingAge = (days: number | null | undefined): { label: string; color: string; urgent: boolean } => {
    if (days == null) return { label: 'Recently Posted', color: 'text-slate-500', urgent: false };
    if (days <= 1) return { label: 'Today', color: 'text-green-400', urgent: true };
    if (days <= 3) return { label: `${days}d ago`, color: 'text-green-400', urgent: true };
    if (days <= 7) return { label: `${days}d ago`, color: 'text-blue-400', urgent: false };
    if (days <= 14) return { label: `${days}d ago`, color: 'text-slate-400', urgent: false };
    if (days <= 30) return { label: `${Math.round(days / 7)}w ago`, color: 'text-slate-500', urgent: false };
    return { label: `${Math.round(days / 30)}mo ago`, color: 'text-slate-600', urgent: false };
};

const formatWorkMode = (mode?: string): string => {
    if (!mode) return 'Full-Time';
    const map: Record<string, string> = {
        full_time: 'Full-Time', part_time: 'Part-Time',
        contract: 'Contract', internship: 'Internship',
        freelance: 'Freelance', remote: 'Remote'
    };
    return map[mode.toLowerCase()] || mode;
};

// ─── Salary Indicator ─────────────────────────────────────────────────────────

export const SalaryIndicator = ({ min, max, currency, period, raw }: {
    min?: number | null, max?: number | null, currency?: string, period?: string, raw?: string | null
}) => {
    const label = formatSalary(min, max, currency, period, raw);
    if (!label) return null;
    return (
        <div className="flex items-center gap-1.5 bg-emerald-500/8 border border-emerald-500/15 px-2.5 py-1.5 rounded-xl">
            <DollarSign size={9} className="text-emerald-400 shrink-0" />
            <span className="text-[10px] font-black text-emerald-300 tracking-tight">{label}</span>
            {period === 'hourly' && <span className="text-[8px] text-emerald-600">/hr</span>}
        </div>
    );
};

// ─── Posting Age Badge ────────────────────────────────────────────────────────

export const PostingAgeBadge = ({ days }: { days?: number | null }) => {
    const { label, color, urgent } = formatPostingAge(days);
    return (
        <div className={`flex items-center gap-1.5 ${color}`}>
            {urgent ? <Zap size={9} fill="currentColor" className="animate-pulse" /> : <Clock size={9} />}
            <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
        </div>
    );
};

// ─── Work Mode Badge ──────────────────────────────────────────────────────────

export const WorkModeBadge = ({ mode }: { mode?: string }) => {
    const label = formatWorkMode(mode);
    return (
        <div className="flex items-center gap-1.5 text-slate-500">
            <Briefcase size={9} />
            <span className="text-[9px] font-bold uppercase tracking-widest">{label}</span>
        </div>
    );
};

// ─── Match Circle (JobRight-style 3 scores) ───────────────────────────────────

export const MatchTriad = ({ skill, exp, domain }: { skill: number; exp: number; domain: number }) => {
    const Circle = ({ pct, label, color }: { pct: number; label: string; color: string }) => {
        const r = 18;
        const circ = 2 * Math.PI * r;
        const dash = (pct / 100) * circ;
        return (
            <div className="flex flex-col items-center gap-1">
                <div className="relative w-12 h-12">
                    <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
                        <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                        <circle
                            cx="24" cy="24" r={r} fill="none"
                            stroke="currentColor" strokeWidth="4"
                            strokeDasharray={`${dash} ${circ}`}
                            strokeLinecap="round"
                            className={color}
                        />
                    </svg>
                    <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-black ${color}`}>
                        {pct}%
                    </span>
                </div>
                <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest">{label}</span>
            </div>
        );
    };

    return (
        <div className="flex items-center gap-4 justify-center py-2">
            <Circle pct={skill} label="Skill" color="text-blue-400" />
            <Circle pct={exp} label="Exp Level" color="text-emerald-400" />
            <Circle pct={domain} label="Domain" color="text-purple-400" />
        </div>
    );
};

// ─── Skill Tags (With user match highlight) ───────────────────────────────────

export const SkillTagCloud = ({
    skills, userSkills, maxVisible = 8, label = 'Required Skills'
}: {
    skills?: string[]; userSkills?: string[]; maxVisible?: number; label?: string;
}) => {
    if (!skills || skills.length === 0) return null;
    const userSet = new Set((userSkills || []).map(s => s.toLowerCase()));
    const visible = skills.slice(0, maxVisible);
    const remaining = skills.length - maxVisible;

    return (
        <div className="space-y-2">
            <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
                <Code2 size={9} />{label}
            </p>
            <div className="flex flex-wrap gap-1.5">
                {visible.map(skill => {
                    const matched = userSet.has(skill.toLowerCase());
                    return (
                        <span
                            key={skill}
                            className={`inline-flex items-center gap-1 text-[8px] font-bold px-2 py-0.5 rounded-lg border transition-all ${matched
                                ? 'bg-blue-500/15 text-blue-300 border-blue-500/25'
                                : 'bg-white/5 text-slate-500 border-white/8'
                                }`}
                        >
                            {matched && <CheckCircle2 size={7} className="text-blue-400" />}
                            {skill}
                        </span>
                    );
                })}
                {remaining > 0 && (
                    <span className="text-[8px] font-bold text-slate-600 px-1.5 py-0.5 bg-white/5 rounded-lg border border-white/5">
                        +{remaining}
                    </span>
                )}
            </div>
        </div>
    );
};

// ─── Eligibility Badges ───────────────────────────────────────────────────────

export const EligibilityBadges = ({ sponsorship, clearance }: { sponsorship?: string | null, clearance?: string | null }) => {
    if (!sponsorship && !clearance) return null;
    return (
        <div className="flex flex-wrap gap-1.5">
            {sponsorship && sponsorship !== 'UNKNOWN' && (
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${
                    sponsorship === 'CITIZEN_ONLY' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                    sponsorship === 'SPONSORSHIP_SUPPORTED' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                    'bg-white/5 text-slate-400 border-white/10'
                }`}>
                    <ShieldCheck size={9} />
                    {sponsorship === 'SPONSORSHIP_SUPPORTED' ? 'Visa OK' :
                     sponsorship === 'CITIZEN_ONLY' ? 'Citizens Only' :
                     sponsorship.replace(/_/g, ' ')}
                </div>
            )}
            {clearance && clearance !== 'NONE' && clearance !== 'UNKNOWN' && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Lock size={9} />
                    {clearance}
                </div>
            )}
        </div>
    );
};

// ─── TechStack Brief ──────────────────────────────────────────────────────────

export const TechStackBrief = ({ stack }: { stack?: string[] }) => {
    if (!stack || stack.length === 0) return null;
    return (
        <div className="flex flex-wrap gap-1">
            {stack.slice(0, 4).map(s => (
                <span key={s} className="text-[7px] font-black bg-indigo-500/8 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/15 uppercase tracking-widest">{s}</span>
            ))}
            {stack.length > 4 && <span className="text-[7px] font-black text-slate-600 px-1">+{stack.length - 4}</span>}
        </div>
    );
};

// ─── Urgency Badge ────────────────────────────────────────────────────────────

export const UrgencyBadge = ({ score }: { score?: number }) => {
    if (!score || score < 0.7) return null;
    return (
        <div className="flex items-center gap-1.5 text-amber-500 animate-pulse">
            <Zap size={9} fill="currentColor" />
            <span className="text-[8px] font-black uppercase tracking-widest">High Demand</span>
        </div>
    );
};

// ─── Job Card Metrics (used in card view) ─────────────────────────────────────

export const JobCardMetrics = ({ m, job }: { m: any; job?: any }) => {
    const score = m?.analysis?.skill_coverage_pct ?? null;
    const expFit = m?.analysis?.experience_fit;
    const roleAlign = m?.analysis?.role_alignment;
    const domainRel = m?.analysis?.domain_relevance;

    // If AI analysis is done — show the rich triad
    if (m?.state === 'COMPLETED' && m?.analysis && score !== null) {
        const expScore = expFit === 'strong' ? 95 : expFit === 'moderate' ? 70 : 45;
        const domainScore = domainRel === 'high' ? 90 : domainRel === 'medium' ? 65 : 40;
        return (
            <div className="space-y-3">
                <MatchTriad skill={score} exp={expScore} domain={domainScore} />
                <div className="flex flex-wrap gap-1 justify-center">
                    {roleAlign && (
                        <span className={`text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${
                            roleAlign === 'strong' ? 'text-green-400 bg-green-500/8 border-green-500/15' : 'text-slate-500 bg-white/5 border-white/8'
                        }`}>
                            {roleAlign} role fit
                        </span>
                    )}
                </div>
            </div>
        );
    }

    // Pending AI — show deterministic match_score as single progress bar
    const matchPct = job?.match_score || job?.skill_match_breakdown?.overlap_ratio ? Math.round((job?.skill_match_breakdown?.overlap_ratio || 0) * 100) : null;
    return (
        <div className="space-y-2">
            {matchPct !== null && (
                <div className="space-y-1">
                    <div className="flex justify-between items-end">
                        <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Skill Overlap</span>
                        <span className="text-[9px] font-black text-white">{matchPct}%</span>
                    </div>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-1000 ease-out ${matchPct >= 60 ? 'bg-green-500' : matchPct >= 35 ? 'bg-blue-500' : 'bg-amber-500'}`}
                            style={{ width: `${matchPct}%` }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Deterministic Intelligence Badges (Hardened Data) ────────────────────────
export const DeterministicIntelligenceBadges = ({ job }: { job: any }) => {
    // Only render if we have at least one deterministic feature
    const hasData = job.hiring_signal || job.has_high_value_skill || job.skill_rarity_score != null || job.role_category || job.experience_level;
    if (!hasData) return null;

    return (
        <div className="flex flex-wrap gap-1.5 pt-1">
            {job.hiring_signal && (
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border ${
                    job.hiring_signal === 'STRONG_BUY' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                    job.hiring_signal === 'CAUTIOUS' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                    job.hiring_signal === 'AVOID' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                    'bg-blue-500/10 text-blue-400 border-blue-500/20'
                }`}>
                    <Target size={8} /> Market Signal: {job.hiring_signal.replace('_', ' ')}
                </div>
            )}
            {job.has_high_value_skill && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border bg-purple-500/10 text-purple-400 border-purple-500/20">
                    <Award size={8} /> Golden Skills Detected
                </div>
            )}
            {job.skill_rarity_score != null && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                    <BarChart3 size={8} /> Tech Rarity: {Math.round(job.skill_rarity_score * 100)}%
                </div>
            )}
            {job.role_category && job.role_category !== 'UNKNOWN' && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border bg-white/5 text-slate-400 border-white/10">
                    <Briefcase size={8} /> {job.role_category}
                </div>
            )}
            {job.experience_level && job.experience_level !== 'UNKNOWN' && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border bg-white/5 text-slate-400 border-white/10">
                    <Timer size={8} /> {job.experience_level.replace('_', ' ')}
                </div>
            )}
        </div>
    );
};
// ─── Competitiveness Badge ────────────────────────────────────────────────────

export const CompetitivenessBadge = ({ tier }: { tier?: string }) => {
    if (!tier) return null;
    const configs: Record<string, { label: string; color: string; bg: string; border: string }> = {
        very_high: { label: 'Very Competitive', color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20' },
        high:      { label: 'Competitive',      color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
        medium:    { label: 'Moderate',          color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20' },
        low:       { label: 'Approachable',      color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20' },
    };
    const cfg = configs[tier] || configs.medium;
    return (
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
            <BarChart3 size={8} />{cfg.label}
        </div>
    );
};

// ─── Skills Grid ──────────────────────────────────────────────────────────────

export const SkillsGrid = ({ skills, label = 'Skills' }: { skills?: string[], label?: string }) => {
    if (!skills || skills.length === 0) return null;
    return (
        <div className="space-y-2">
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Code2 size={9} />{label}
            </p>
            <div className="flex flex-wrap gap-1.5">
                {skills.slice(0, 18).map(skill => (
                    <span key={skill} className="text-[9px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded-md">{skill}</span>
                ))}
                {skills.length > 18 && <span className="text-[9px] text-slate-500 px-2 py-0.5">+{skills.length - 18} more</span>}
            </div>
        </div>
    );
};

// ─── Requirements List ────────────────────────────────────────────────────────

export const RequirementsList = ({ items, icon: Icon, label }: { items?: string[], icon: any, label: string }) => {
    if (!items || items.length === 0) return null;
    return (
        <div className="space-y-2">
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Icon size={9} />{label}
            </p>
            <ul className="space-y-1.5">
                {items.slice(0, 8).map((item, i) => (
                    <li key={i} className="flex gap-2 text-[11px] text-slate-300 leading-relaxed">
                        <CheckCircle2 size={10} className="text-indigo-400 mt-0.5 shrink-0" />
                        <span>{item}</span>
                    </li>
                ))}
                {items.length > 8 && <li className="text-[10px] text-slate-500 pl-5">+{items.length - 8} more...</li>}
            </ul>
        </div>
    );
};

// ─── Industry Tags ────────────────────────────────────────────────────────────

export const IndustryTagList = ({ tags }: { tags?: string[] }) => {
    if (!tags || tags.length === 0) return null;
    return (
        <div className="flex flex-wrap gap-1.5">
            {tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 text-[8px] font-semibold uppercase tracking-widest bg-white/5 text-slate-400 border border-white/10 px-2 py-1 rounded-lg">
                    <Tag size={7} />{tag}
                </span>
            ))}
        </div>
    );
};

// ─── Enriched Job Detail Panel ────────────────────────────────────────────────
// Shows EVERYTHING we know about the job — built for the expanded card / modal

interface EnrichedJobDetailPanelProps {
    job: {
        has_enriched_data?: boolean;
        skills?: string[];
        required_skills?: string[];
        tech_stack?: string[];
        requirements?: string[];
        responsibilities?: string[];
        industry_tags?: string[];
        salary_min?: number | null;
        salary_max?: number | null;
        salary_currency?: string;
        salary_period?: string;
        salary_raw?: string | null;
        experience_required?: number;
        experience_min?: number;
        experience_max?: number;
        experience_level?: string;
        education_required?: string;
        employment_type?: string;
        work_mode?: string;
        competitiveness_tier?: string;
        market_alignment_score?: number;
        sponsorship_type?: string | null;
        clearance_level?: string | null;
        posting_age_days?: number | null;
        posted_at?: string | null;
        source_url?: string | null;
        source?: string | null;
        location?: string;
        role?: string;
        company?: string;
        job_description?: string | null;
    };
}

const EMPLOYMENT_LABELS: Record<string, string> = {
    full_time: 'Full-Time', part_time: 'Part-Time',
    contract: 'Contract', internship: 'Internship', freelance: 'Freelance',
};
const EDUCATION_LABELS: Record<string, string> = {
    phd: 'Ph.D Required', master: "Master's", bachelor: "Bachelor's",
    associate: 'Associate', none: 'No Degree Required', preferred: 'Degree Preferred',
};

export const EnrichedJobDetailPanel: React.FC<EnrichedJobDetailPanelProps> = ({ job }) => {
    const salaryLabel = formatSalary(job.salary_min, job.salary_max, job.salary_currency, job.salary_period, job.salary_raw);
    const hasExpInfo = job.experience_min != null || job.experience_max != null || job.experience_level;
    const allSkills = [...new Set([...(job.skills || []), ...(job.required_skills || []), ...(job.tech_stack || [])])];
    const hasAnyData = salaryLabel || hasExpInfo || job.employment_type || job.work_mode || job.sponsorship_type || job.clearance_level || allSkills.length > 0 || job.posting_age_days != null || job.job_description;

    if (!hasAnyData && !job.has_enriched_data) {
        return (
            <div className="mt-3 rounded-2xl border border-white/5 bg-white/[0.015] px-4 py-3 flex items-center gap-2">
                <Sparkles size={10} className="text-slate-700 shrink-0" />
                <p className="text-[8px] font-bold uppercase tracking-widest text-slate-700">
                    Enrichment in progress — limited data available
                </p>
            </div>
        );
    }

    const ageInfo = formatPostingAge(job.posting_age_days);

    return (
        <div className="mt-3 space-y-4 rounded-2xl border border-white/5 bg-white/[0.015] px-4 py-4">
            {/* Header row with fresh signal */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Sparkles size={10} className="text-indigo-400" />
                    <span className="text-[8px] font-black uppercase tracking-widest text-indigo-400">Job Intelligence</span>
                </div>
                {job.posting_age_days != null && (
                    <div className={`flex items-center gap-1 ${ageInfo.color}`}>
                        {ageInfo.urgent ? <Zap size={8} fill="currentColor" className="animate-pulse" /> : <Clock size={8} />}
                        <span className="text-[8px] font-black uppercase tracking-widest">{ageInfo.label}</span>
                    </div>
                )}
            </div>

            {/* Metadata chips */}
            <div className="flex flex-wrap gap-2">
                {salaryLabel && (
                    <div className="flex items-center gap-1.5 bg-emerald-500/8 border border-emerald-500/15 px-2.5 py-1 rounded-xl">
                        <DollarSign size={9} className="text-emerald-400" />
                        <span className="text-[9px] font-black text-emerald-300">{salaryLabel}</span>
                        {job.salary_period === 'yearly' && <span className="text-[7px] text-emerald-700">/yr</span>}
                    </div>
                )}
                {hasExpInfo && (
                    <div className="flex items-center gap-1.5 bg-white/5 border border-white/8 px-2.5 py-1 rounded-xl">
                        <TrendingUp size={9} className="text-slate-400" />
                        <span className="text-[9px] font-semibold text-slate-300">
                            {job.experience_min != null && job.experience_max != null
                                ? `${job.experience_min}–${job.experience_max} yrs`
                                : job.experience_min != null ? `${job.experience_min}+ yrs` : job.experience_level}
                        </span>
                    </div>
                )}
                {(job.employment_type || job.work_mode) && (
                    <div className="flex items-center gap-1.5 bg-white/5 border border-white/8 px-2.5 py-1 rounded-xl">
                        <Briefcase size={9} className="text-slate-400" />
                        <span className="text-[9px] font-semibold text-slate-300">
                            {EMPLOYMENT_LABELS[job.employment_type || ''] ||
                             EMPLOYMENT_LABELS[job.work_mode || ''] ||
                             formatWorkMode(job.work_mode)}
                        </span>
                    </div>
                )}
                {job.education_required && job.education_required !== 'none' && (
                    <div className="flex items-center gap-1.5 bg-white/5 border border-white/8 px-2.5 py-1 rounded-xl">
                        <GraduationCap size={9} className="text-slate-400" />
                        <span className="text-[9px] font-semibold text-slate-300">
                            {EDUCATION_LABELS[job.education_required] || job.education_required}
                        </span>
                    </div>
                )}
            </div>

            {/* Job Description (The Meat) */}
            {job.job_description && (
                <div className="space-y-2">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                        <FileText size={9} />About the Role
                    </p>
                    <div className="text-[11px] text-slate-400 leading-relaxed whitespace-pre-wrap max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                        {job.job_description}
                    </div>
                </div>
            )}

            {/* Eligibility */}
            <EligibilityBadges sponsorship={job.sponsorship_type} clearance={job.clearance_level} />

            {/* Competitiveness */}
            {job.competitiveness_tier && <CompetitivenessBadge tier={job.competitiveness_tier} />}

            {/* Deterministic Hardened Intelligence Signals */}
            <DeterministicIntelligenceBadges job={job as any} />

            {/* Skills */}
            {allSkills.length > 0 && <SkillsGrid skills={allSkills} label="Skills & Technologies" />}

            {/* Requirements */}
            {(job.requirements?.length ?? 0) > 0 && (
                <RequirementsList items={job.requirements} icon={CheckCircle2} label="Requirements" />
            )}

            {/* Responsibilities */}
            {(job.responsibilities?.length ?? 0) > 0 && (
                <RequirementsList items={job.responsibilities} icon={Briefcase} label="What You'll Do" />
            )}

            {/* Industry */}
            {(job.industry_tags?.length ?? 0) > 0 && (
                <div className="space-y-2">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                        <Tag size={9} />Industry Signals
                    </p>
                    <IndustryTagList tags={job.industry_tags} />
                </div>
            )}

            {/* Apply link */}
            {job.source_url && (
                <a
                    href={job.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-[8px] font-black text-slate-600 hover:text-blue-400 uppercase tracking-widest transition-all group"
                >
                    <ExternalLink size={9} className="group-hover:scale-110 transition-transform" />
                    View Original Posting
                    {job.source && <span className="text-slate-700 normal-case font-normal">via {job.source}</span>}
                </a>
            )}
        </div>
    );
};
