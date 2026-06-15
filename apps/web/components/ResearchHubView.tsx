import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  Search, ArrowRight, BookOpen, TrendingUp, Brain, Layers, Wifi,
  BarChart2, Clock, ChevronRight, User, ExternalLink, Zap, Target,
  CheckCircle, XCircle, AlertCircle, Globe, Database, ChevronLeft,
} from 'lucide-react';

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  content_markdown: string;
  seo_meta: { description?: string; keywords?: string };
  pillar: string;
  published_at: string;
  faq_pairs: Array<{ question: string; answer: string }>;
}

const PILLAR_META: Record<string, { label: string; color: string; icon: React.ReactNode; description: string }> = {
  entry_level_collapse: { label: 'Entry-Level Collapse', color: '#EF4444', icon: <TrendingUp size={12} />, description: 'Why the first rung of the career ladder is disappearing' },
  compensation_reality: { label: 'Compensation Reality', color: '#10B981', icon: <BarChart2 size={12} />, description: 'What salary data actually shows vs. what everyone thinks' },
  ai_hiring_impact: { label: 'AI Hiring Impact', color: '#8B5CF6', icon: <Brain size={12} />, description: 'How AI is changing who gets hired' },
  remote_work_divide: { label: 'Remote Work Divide', color: '#3B82F6', icon: <Wifi size={12} />, description: 'The split between who remote work helps and who it leaves behind' },
  skills_velocity: { label: 'Skills Velocity', color: '#F59E0B', icon: <Layers size={12} />, description: 'Which skills are gaining value faster than people can learn them' },
  macro: { label: 'Macro Trends', color: '#3B82F6', icon: <BarChart2 size={12} />, description: 'Macroeconomic labor trends and market velocity' },
  tech: { label: 'Technology Signal', color: '#8B5CF6', icon: <Brain size={12} />, description: 'Software and AI hiring metrics' },
  convergence: { label: 'Convergence Analysis', color: '#F59E0B', icon: <Layers size={12} />, description: 'Synthesized insights from intersecting indicators' },
};

const PILLAR_IMAGES: Record<string, string> = {
  entry_level_collapse: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=900&h=500&q=80',
  compensation_reality: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=900&h=500&q=80',
  ai_hiring_impact: 'https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=900&h=500&q=80',
  remote_work_divide: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=900&h=500&q=80',
  skills_velocity: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&h=500&q=80',
  macro: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=900&h=500&q=80',
  tech: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=900&h=500&q=80',
  convergence: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=900&h=500&q=80',
};

function getPillarImage(pillar: string): string {
  return PILLAR_IMAGES[pillar] || PILLAR_IMAGES.convergence;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function readingTime(content: string): number {
  return Math.max(1, Math.ceil(content.split(/\s+/).length / 220));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ── Headline Ticker ── */
const HeadlineTicker: React.FC<{ posts: BlogPost[]; onViewPost: (slug: string) => void }> = ({ posts, onViewPost }) => {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (posts.length < 2) return;
    const t = setInterval(() => setIdx(i => (i + 1) % posts.length), 4500);
    return () => clearInterval(t);
  }, [posts.length]);

  if (posts.length === 0) return null;
  const post = posts[idx];
  const meta = PILLAR_META[post.pillar];

  return (
    <div className="border-b border-white/[0.06] bg-[#07070D]">
      <div className="max-w-6xl mx-auto px-6 py-2.5 flex items-center gap-4">
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[9px] font-black text-red-400 uppercase tracking-widest">Live</span>
        </div>
        <div className="w-px h-3 bg-white/10 shrink-0" />
        <button
          onClick={() => onViewPost(post.slug)}
          className="flex items-center gap-2 min-w-0 group"
        >
          {meta && (
            <span
              style={{ color: meta.color, borderColor: meta.color + '40', background: meta.color + '12' }}
              className="text-[8px] font-black px-2 py-0.5 rounded border uppercase tracking-widest shrink-0 hidden sm:inline-flex items-center gap-1"
            >
              {meta.icon}{meta.label}
            </span>
          )}
          <span className="text-slate-300 text-xs truncate group-hover:text-white transition-colors">
            {post.title}
          </span>
          <ChevronRight size={11} className="text-slate-600 shrink-0 group-hover:text-slate-400 transition-colors" />
        </button>
        <div className="ml-auto flex items-center gap-1 shrink-0">
          {posts.slice(0, Math.min(5, posts.length)).map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`w-1.5 h-1.5 rounded-full transition-all ${i === idx ? 'bg-blue-400 w-3' : 'bg-white/15 hover:bg-white/30'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

/* ── Article Card (compact, for grid) ── */
const ArticleCard: React.FC<{ post: BlogPost; onViewPost: (slug: string) => void; size?: 'sm' | 'md' }> = ({ post, onViewPost, size = 'md' }) => {
  const meta = PILLAR_META[post.pillar];
  const mins = readingTime(post.content_markdown || post.seo_meta?.description || '');
  return (
    <button
      onClick={() => onViewPost(post.slug)}
      className="text-left w-full group flex flex-col bg-[#0D0D16] border border-white/[0.07] rounded-2xl overflow-hidden hover:border-white/15 hover:bg-[#111118] transition-all duration-200"
    >
      {/* Pillar color bar */}
      <div className="h-[2px] w-full" style={{ background: meta?.color || '#3B82F6' }} />
      <div className="p-5 flex flex-col flex-1">
        {/* Pillar + time */}
        <div className="flex items-center justify-between gap-2 mb-3">
          {meta && (
            <span
              style={{ color: meta.color, background: meta.color + '12' }}
              className="text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest inline-flex items-center gap-1"
            >
              {meta.icon}{meta.label}
            </span>
          )}
          <span className="text-slate-600 text-[9px] flex items-center gap-1 shrink-0">
            <Clock size={8} />{timeAgo(post.published_at)}
          </span>
        </div>

        {/* Title */}
        <h3 className={`text-white font-bold leading-snug mb-2 group-hover:text-blue-200 transition-colors flex-1 ${size === 'sm' ? 'text-sm line-clamp-3' : 'text-sm line-clamp-3'}`}>
          {post.title}
        </h3>

        {/* Description */}
        {post.seo_meta?.description && (
          <p className="text-slate-500 text-xs leading-relaxed line-clamp-2 mb-4">
            {post.seo_meta.description}
          </p>
        )}

        {/* Footer: read time + data source badges */}
        <div className="flex items-center justify-between pt-3 border-t border-white/[0.05] mt-auto">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-slate-600 font-medium">{mins} min read</span>
            <span className="text-slate-700">·</span>
            <div className="flex gap-1">
              {['BLS', 'FRED'].map(src => (
                <span key={src} className="text-[7px] font-bold text-slate-700 bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 rounded uppercase tracking-wider">
                  {src}
                </span>
              ))}
            </div>
          </div>
          <ChevronRight size={12} className="text-slate-700 group-hover:text-blue-400 transition-colors" />
        </div>
      </div>
    </button>
  );
};

/* ── Featured Hero Card ── */
const FeaturedCard: React.FC<{ post: BlogPost; onViewPost: (slug: string) => void }> = ({ post, onViewPost }) => {
  const meta = PILLAR_META[post.pillar];
  const mins = readingTime(post.content_markdown || '');
  return (
    <button
      onClick={() => onViewPost(post.slug)}
      className="w-full text-left group relative rounded-2xl overflow-hidden border border-white/[0.08] hover:border-white/15 transition-all duration-300"
    >
      {/* Background image */}
      <div className="relative h-72 md:h-80">
        <img
          src={getPillarImage(post.pillar)}
          alt={post.title}
          className="w-full h-full object-cover opacity-40 group-hover:opacity-50 group-hover:scale-[1.02] transition-all duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D16] via-[#0D0D16]/70 to-transparent" />
      </div>

      {/* Content overlay */}
      <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-8">
        <div className="flex items-center gap-3 mb-3">
          {meta && (
            <span
              style={{ color: meta.color, background: meta.color + '20', borderColor: meta.color + '50' }}
              className="text-[8px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-widest inline-flex items-center gap-1"
            >
              {meta.icon}{meta.label}
            </span>
          )}
          <span className="text-white/50 text-[9px] font-black uppercase tracking-widest">Featured</span>
        </div>
        <h2 className="text-xl md:text-2xl lg:text-3xl font-black text-white leading-tight mb-3 max-w-2xl group-hover:text-blue-100 transition-colors">
          {post.title}
        </h2>
        {post.seo_meta?.description && (
          <p className="text-slate-400 text-sm leading-relaxed max-w-xl line-clamp-2 mb-4">
            {post.seo_meta.description}
          </p>
        )}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-500/30 border border-blue-500/40 flex items-center justify-center">
              <User size={10} className="text-blue-300" />
            </div>
            <span className="text-white/70 text-xs font-semibold">Harsimar Singh · HireMax Research</span>
          </div>
          <span className="text-slate-600 text-xs">·</span>
          <span className="text-slate-500 text-xs flex items-center gap-1"><Clock size={10} />{mins} min read</span>
          <span className="text-slate-600 text-xs">·</span>
          <span className="text-slate-500 text-xs">{formatDate(post.published_at)}</span>
          <span className="ml-auto text-blue-400 text-xs font-bold flex items-center gap-1 group-hover:gap-2 transition-all">
            Read analysis <ArrowRight size={12} />
          </span>
        </div>
      </div>
    </button>
  );
};

/* ── Sidebar Latest ── */
const SidebarLatest: React.FC<{ posts: BlogPost[]; onViewPost: (slug: string) => void }> = ({ posts, onViewPost }) => (
  <div className="bg-[#0D0D16] border border-white/[0.07] rounded-2xl p-5">
    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-4">Latest Intelligence</p>
    <div className="space-y-4">
      {posts.slice(0, 6).map((post, i) => {
        const meta = PILLAR_META[post.pillar];
        return (
          <button
            key={post.id}
            onClick={() => onViewPost(post.slug)}
            className="w-full text-left group flex gap-3"
          >
            <span className="text-[9px] font-black text-slate-700 w-4 shrink-0 mt-0.5">{String(i + 1).padStart(2, '0')}</span>
            <div className="min-w-0">
              {meta && (
                <span style={{ color: meta.color }} className="text-[8px] font-black uppercase tracking-widest block mb-0.5">
                  {meta.label}
                </span>
              )}
              <p className="text-slate-300 text-xs font-semibold leading-snug line-clamp-2 group-hover:text-white transition-colors">
                {post.title}
              </p>
              <span className="text-slate-700 text-[9px] flex items-center gap-1 mt-1">
                <Clock size={8} />{timeAgo(post.published_at)}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  </div>
);

/* ── Stats Bar ── */
const StatsBar: React.FC<{ posts: BlogPost[]; predictions: any[] }> = ({ posts, predictions }) => {
  const resolved = predictions.filter(p => p.prediction_correct !== null);
  const correct = predictions.filter(p => p.prediction_correct === true).length;
  const pending = predictions.filter(p => p.prediction_correct === null).length;
  const accuracy = resolved.length > 0 ? Math.round((correct / resolved.length) * 100) : null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
      {[
        { label: 'Published Analyses', value: String(posts.length), icon: <BookOpen size={13} className="text-blue-400" />, color: 'text-blue-400' },
        { label: 'Research Pillars', value: String(new Set(posts.map(p => p.pillar)).size), icon: <Layers size={13} className="text-purple-400" />, color: 'text-purple-400' },
        { label: 'Live Predictions', value: String(pending), icon: <Target size={13} className="text-amber-400" />, color: 'text-amber-400' },
        { label: 'Forecast Accuracy', value: accuracy !== null ? `${accuracy}%` : '—', icon: <CheckCircle size={13} className="text-emerald-400" />, color: 'text-emerald-400' },
      ].map(stat => (
        <div key={stat.label} className="bg-[#0D0D16] border border-white/[0.07] rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 bg-white/[0.04] rounded-lg shrink-0">{stat.icon}</div>
          <div>
            <div className={`text-xl font-black ${stat.color}`}>{stat.value}</div>
            <div className="text-slate-600 text-[9px] font-bold uppercase tracking-wider mt-0.5">{stat.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

/* ── Predictions Strip ── */
const PredictionsStrip: React.FC<{ predictions: any[] }> = ({ predictions }) => {
  if (predictions.length === 0) return null;
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Target size={14} className="text-amber-400" />
        <h2 className="text-sm font-black text-white uppercase tracking-wider">Falsifiable Forecasts</h2>
        <span className="text-[8px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
          Accountability Tracker
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {predictions.slice(0, 3).map(pred => {
          const isCorrect = pred.prediction_correct;
          const isPending = isCorrect === null;
          const dateStr = pred.prediction_timeframe
            ? new Date(pred.prediction_timeframe).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
            : '—';
          return (
            <div
              key={pred.id}
              className={`bg-[#0D0D16] border rounded-xl p-4 flex flex-col gap-3 ${
                isPending ? 'border-amber-500/15' : isCorrect ? 'border-emerald-500/15' : 'border-red-500/15'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest leading-tight">
                  {(pred.prediction_metric || 'Signal').replace(/_/g, ' ')}
                </span>
                {isPending ? (
                  <span className="text-[8px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded whitespace-nowrap shrink-0">⏳ {dateStr}</span>
                ) : isCorrect ? (
                  <span className="text-[8px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded shrink-0">✓ Correct</span>
                ) : (
                  <span className="text-[8px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded shrink-0">✗ Missed</span>
                )}
              </div>
              <p className="text-white text-xs font-semibold leading-snug line-clamp-2">"{pred.prediction_text}"</p>
              <div className="flex items-center justify-between text-[9px] pt-2 border-t border-white/[0.04]">
                <span className="text-slate-600">{pred.prediction_direction} · {pred.prediction_magnitude_range}</span>
                <span className="text-blue-400 font-bold">{pred.confidence_score * 10}% confidence</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ── Newsletter CTA ── */
const NewsletterSignup: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes('@') || trimmed.length < 5) return;
    setStatus('loading');
    try {
      const distributorUrl = 'https://hiremax-intelligence-distributor.singh-harsimar23.workers.dev';
      const res = await fetch(`${distributorUrl}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      if (res.ok) { setStatus('success'); return; }
      // Fallback: direct Supabase insert
      const { error } = await supabase
        .from('newsletter_subscribers')
        .upsert({ email: trimmed, subscribed_at: new Date().toISOString() }, { onConflict: 'email', ignoreDuplicates: true });
      if (error && !error.message?.toLowerCase().includes('duplicate')) throw error;
      setStatus('success');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'success') {
    return <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm"><CheckCircle size={16} /> You're on the list. First brief this Friday.</div>;
  }
  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5">
      <input type="text" name="website" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />
      <input
        id="newsletter-email"
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="your@email.com"
        required
        className="flex-1 md:w-52 bg-white/[0.06] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500/40 transition-all"
      />
      <button
        type="submit"
        disabled={status === 'loading'}
        className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
      >
        {status === 'loading' ? 'Subscribing...' : <>Subscribe <ArrowRight size={13} /></>}
      </button>
    </form>
  );
};

/* ── Main Component ── */
interface ResearchHubViewProps {
  onViewPost: (slug: string) => void;
}

export const ResearchHubView: React.FC<ResearchHubViewProps> = ({ onViewPost }) => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<any[]>([]);

  useEffect(() => {
    document.title = 'HireMax Research — Global Labor Market Intelligence by Harsimar Singh';
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'HireMax Intelligence Research',
      description: 'Original data-backed research on global labor markets, hiring trends, and workforce economics by Harsimar Singh.',
      url: 'https://www.hiremax.site/research',
      publisher: {
        '@type': 'Organization',
        name: 'HireMax Intelligence',
        url: 'https://www.hiremax.site',
        founder: { '@type': 'Person', name: "Harsimar 'sam' Singh", jobTitle: 'Founder & Research Director', url: 'https://www.hiremax.site' },
      },
    };
    let el = document.getElementById('research-schema');
    if (!el) {
      el = document.createElement('script');
      el.id = 'research-schema';
      (el as HTMLScriptElement).type = 'application/ld+json';
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(schema);
    return () => { el?.remove(); };
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [postsRes, predsRes] = await Promise.all([
        supabase
          .from('blog_posts')
          .select('id, slug, title, content_markdown, seo_meta, pillar, published_at, faq_pairs')
          .eq('status', 'published')
          .order('published_at', { ascending: false })
          .limit(50),
        supabase
          .from('predictions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(6)
          .then(r => r) // swallow missing-table error gracefully
          .catch(() => ({ data: [], error: null })),
      ]);
      if (!postsRes.error && postsRes.data) setPosts(postsRes.data as BlogPost[]);
      const predsData = (predsRes as any)?.data;
      if (Array.isArray(predsData)) setPredictions(predsData);
      setLoading(false);
    })();
  }, []);

  const filtered = posts.filter(p => {
    const matchesSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) || (p.seo_meta?.description || '').toLowerCase().includes(search.toLowerCase());
    const matchesPillar = !activeFilter || p.pillar === activeFilter;
    return matchesSearch && matchesPillar;
  });

  const pillarsWithPosts = [...new Set(posts.map(p => p.pillar).filter(Boolean))];
  const pillarCounts: Record<string, number> = {};
  posts.forEach(p => { pillarCounts[p.pillar] = (pillarCounts[p.pillar] || 0) + 1; });

  const [featured, second, ...rest] = filtered;

  return (
    <div className="min-h-screen bg-[#07070D] font-sans">

      {/* ── Live Ticker ── */}
      <HeadlineTicker posts={posts} onViewPost={onViewPost} />

      {/* ── Masthead ── */}
      <div className="border-b border-white/[0.06] bg-[#09090F]">
        <div className="max-w-6xl mx-auto px-6 py-10 md:py-14">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen size={12} className="text-blue-400" />
                <span className="text-blue-400 text-[9px] font-black tracking-[0.2em] uppercase">HireMax Intelligence</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-white mb-3 leading-[1.1] tracking-tight">
                Labor Market<br />Research Hub
              </h1>
              <p className="text-slate-400 text-sm max-w-md leading-relaxed">
                Original analysis from BLS, FRED, Eurostat, and ILO data.
                Every finding is falsifiable. Every prediction is tracked.
              </p>
            </div>
            <div className="w-full md:w-72 shrink-0">
              <div className="relative mb-3">
                <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
                <input
                  id="research-search"
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search research..."
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500/30 focus:bg-white/[0.06] transition-all"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                <p className="text-slate-700 text-[8px] font-bold uppercase tracking-widest w-full mb-1">Data Sources</p>
                {['BLS', 'FRED', 'Eurostat', 'ILO', 'Reddit', 'HN', 'RSS'].map(src => (
                  <span key={src} className="text-[8px] font-bold text-slate-600 bg-white/[0.03] border border-white/[0.06] px-2 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-1">
                    <Database size={7} className="text-slate-700" />{src}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            <div className="h-80 bg-white/[0.03] rounded-2xl animate-pulse border border-white/[0.05]" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <div key={i} className="h-52 bg-white/[0.03] rounded-2xl animate-pulse border border-white/[0.05]" />)}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-32">
            <div className="w-14 h-14 bg-white/[0.04] border border-white/[0.07] rounded-2xl flex items-center justify-center mx-auto mb-5">
              <BookOpen size={20} className="text-slate-600" />
            </div>
            <h3 className="text-white font-bold text-lg mb-2">
              {posts.length === 0 ? 'Research publishing soon' : 'No results'}
            </h3>
            <p className="text-slate-500 text-sm max-w-xs mx-auto">
              {posts.length === 0 ? 'Intelligence pipeline runs multiple times daily. Check back shortly.' : 'Try adjusting your search or removing the filter.'}
            </p>
          </div>
        )}

        {!loading && (
          <>
            {/* Stats bar */}
            <StatsBar posts={posts} predictions={predictions} />

            {/* Category filter tabs */}
            <div className="flex flex-wrap gap-2 mb-8">
              <button
                onClick={() => setActiveFilter(null)}
                className={`text-[10px] font-bold px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                  !activeFilter ? 'bg-white text-black' : 'bg-white/[0.04] text-slate-500 hover:text-white border border-white/[0.07]'
                }`}
              >
                All
                <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black ${!activeFilter ? 'bg-black/20 text-black' : 'bg-white/10 text-slate-400'}`}>
                  {posts.length}
                </span>
              </button>
              {pillarsWithPosts.map(pillar => {
                const meta = PILLAR_META[pillar];
                if (!meta) return null;
                const isActive = activeFilter === pillar;
                return (
                  <button
                    key={pillar}
                    onClick={() => setActiveFilter(isActive ? null : pillar)}
                    style={isActive ? { background: meta.color + '16', borderColor: meta.color + '45', color: meta.color } : {}}
                    className={`text-[10px] font-bold px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                      isActive ? 'border' : 'bg-white/[0.04] text-slate-500 hover:text-white border border-white/[0.07] hover:border-white/15'
                    }`}
                  >
                    {meta.icon}
                    <span className="hidden sm:inline">{meta.label}</span>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black ${isActive ? 'bg-white/20' : 'bg-white/10 text-slate-500'}`}>
                      {pillarCounts[pillar] || 0}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Two-column layout: main + sidebar */}
            <div className="flex flex-col lg:flex-row gap-6">

              {/* Main column */}
              <div className="flex-1 min-w-0">

                {/* Featured hero */}
                {featured && (
                  <div className="mb-6">
                    <FeaturedCard post={featured} onViewPost={onViewPost} />
                  </div>
                )}

                {/* Second + predictions strip */}
                {second && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <ArticleCard post={second} onViewPost={onViewPost} />
                    {/* Predictions mini-card */}
                    <div className="bg-[#0D0D16] border border-amber-500/10 rounded-2xl overflow-hidden">
                      <div className="h-[2px] w-full bg-gradient-to-r from-amber-500 to-orange-500" />
                      <div className="p-5">
                        <div className="flex items-center gap-2 mb-4">
                          <Target size={13} className="text-amber-400" />
                          <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest">Live Forecasts</span>
                        </div>
                        {predictions.slice(0, 2).map(pred => (
                          <div key={pred.id} className="mb-3 pb-3 border-b border-white/[0.04] last:border-0 last:mb-0 last:pb-0">
                            <p className="text-white text-xs font-semibold leading-snug line-clamp-2 mb-1">"{pred.prediction_text}"</p>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-600 text-[8px]">{pred.prediction_direction} · {pred.prediction_magnitude_range}</span>
                              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                                pred.prediction_correct === null ? 'text-amber-400 bg-amber-500/10' :
                                pred.prediction_correct ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'
                              }`}>
                                {pred.prediction_correct === null ? '⏳ Pending' : pred.prediction_correct ? '✓ Correct' : '✗ Missed'}
                              </span>
                            </div>
                          </div>
                        ))}
                        {predictions.length === 0 && (
                          <p className="text-slate-600 text-xs">Forecasts generated with each analysis.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Article grid */}
                {rest.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {rest.map(post => (
                      <ArticleCard key={post.id} post={post} onViewPost={onViewPost} />
                    ))}
                  </div>
                )}
              </div>

              {/* Sidebar */}
              <div className="w-full lg:w-64 xl:w-72 shrink-0 space-y-4">
                <SidebarLatest posts={posts} onViewPost={onViewPost} />

                {/* About this research */}
                <div className="bg-[#0D0D16] border border-white/[0.07] rounded-2xl p-5">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">About This Research</p>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/30 border border-white/10 flex items-center justify-center shrink-0">
                      <User size={12} className="text-blue-300" />
                    </div>
                    <div>
                      <p className="text-white text-xs font-bold">Harsimar 'sam' Singh</p>
                      <p className="text-slate-600 text-[9px]">Founder & Research Director</p>
                    </div>
                  </div>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    Every analysis is synthesized from raw government datasets (BLS, FRED, Eurostat, ILO) — not news articles. Predictions are falsifiable and tracked publicly.
                  </p>
                </div>

                {/* Newsletter */}
                <div className="bg-[#0D0D16] border border-blue-500/15 rounded-2xl p-5">
                  <div className="h-[2px] w-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full mb-4" />
                  <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Weekly Brief</p>
                  <h3 className="text-white font-black text-sm leading-tight mb-1">Get the intelligence brief</h3>
                  <p className="text-slate-500 text-xs mb-4">Data-backed labor findings every Friday. No noise.</p>
                  <NewsletterSignup />
                </div>
              </div>

            </div>
          </>
        )}
      </div>
    </div>
  );
};
