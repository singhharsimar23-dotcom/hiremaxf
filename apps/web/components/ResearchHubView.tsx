import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search, ArrowRight, BookOpen, TrendingUp, Brain, Layers, Wifi, BarChart2, ExternalLink, Clock, ChevronRight } from 'lucide-react';

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
  entry_level_collapse: {
    label: 'Entry-Level Collapse',
    color: '#EF4444',
    icon: <TrendingUp size={14} />,
    description: 'Why the first rung on the career ladder is disappearing — and who benefits',
  },
  compensation_reality: {
    label: 'Compensation Reality',
    color: '#10B981',
    icon: <BarChart2 size={14} />,
    description: 'What salary data actually shows vs. what everyone thinks they know',
  },
  ai_hiring_impact: {
    label: 'AI Hiring Impact',
    color: '#8B5CF6',
    icon: <Brain size={14} />,
    description: 'How AI is changing who gets hired, not just how jobs are done',
  },
  remote_work_divide: {
    label: 'Remote Work Divide',
    color: '#3B82F6',
    icon: <Wifi size={14} />,
    description: 'The split between who remote work helps and who it leaves behind',
  },
  skills_velocity: {
    label: 'Skills Velocity',
    color: '#F59E0B',
    icon: <Layers size={14} />,
    description: 'Which skills are gaining value faster than people are learning them',
  },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

interface ResearchHubViewProps {
  onViewPost: (slug: string) => void;
}

export const ResearchHubView: React.FC<ResearchHubViewProps> = ({ onViewPost }) => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'HireMax Research — Global Labor Market Intelligence';
    // JSON-LD for collection page
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'HireMax Intelligence Research',
      description: 'Original data-backed research on global labor markets, hiring trends, and workforce economics.',
      url: 'https://www.hiremax.site/research',
      publisher: { '@type': 'Organization', name: 'HireMax Intelligence', url: 'https://www.hiremax.site' },
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
      const { data, error } = await supabase
        .from('blog_posts')
        .select('id, slug, title, seo_meta, pillar, published_at, faq_pairs')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(50);
      if (!error && data) setPosts(data as BlogPost[]);
      setLoading(false);
    })();
  }, []);

  const filtered = posts.filter(p => {
    const matchesSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) ||
      (p.seo_meta?.description || '').toLowerCase().includes(search.toLowerCase());
    const matchesPillar = !activeFilter || p.pillar === activeFilter;
    return matchesSearch && matchesPillar;
  });

  const pillarsWithPosts = [...new Set(posts.map(p => p.pillar).filter(Boolean))];

  return (
    <div className="min-h-screen bg-[#0A0B10]">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 via-transparent to-purple-600/5 pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-500/5 rounded-full blur-[80px] pointer-events-none" />
        <div className="max-w-5xl mx-auto px-6 py-20 relative">
          <div className="flex items-center gap-2 text-blue-400 mb-4">
            <BookOpen size={16} />
            <span className="text-xs font-bold tracking-widest uppercase">HireMax Intelligence Research</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight tracking-tight">
            Global Hiring Intelligence.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">Backed by data.</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl leading-relaxed mb-8">
            Original research synthesized from BLS, FRED, Eurostat, ILO, and real-time community signals. 
            Every finding cites its source. No opinions.
          </p>

          {/* Search */}
          <div className="relative max-w-lg">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              id="research-search"
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search research..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500/50 focus:bg-white/8 transition-all"
            />
          </div>

          {/* Data sources badge */}
          <div className="flex flex-wrap gap-2 mt-6">
            {['BLS', 'FRED', 'Eurostat', 'ILO', 'Reddit', 'HN'].map(src => (
              <span key={src} className="text-[10px] font-bold text-slate-500 bg-white/5 border border-white/10 px-3 py-1 rounded-full uppercase tracking-widest">
                {src}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Pillar filters */}
        <div className="flex flex-wrap gap-2 mb-10">
          <button
            onClick={() => setActiveFilter(null)}
            className={`text-xs font-bold px-4 py-2 rounded-xl transition-all ${!activeFilter ? 'bg-white text-black' : 'bg-white/5 text-slate-400 hover:text-white border border-white/10'}`}
          >
            All Research
          </button>
          {pillarsWithPosts.map(pillar => {
            const meta = PILLAR_META[pillar];
            if (!meta) return null;
            return (
              <button
                key={pillar}
                onClick={() => setActiveFilter(activeFilter === pillar ? null : pillar)}
                style={activeFilter === pillar ? { background: meta.color + '20', borderColor: meta.color + '60', color: meta.color } : {}}
                className={`text-xs font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                  activeFilter === pillar
                    ? 'border'
                    : 'bg-white/5 text-slate-400 hover:text-white border border-white/10'
                }`}
              >
                {meta.icon}
                {meta.label}
              </button>
            );
          })}
        </div>

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-52 bg-white/5 rounded-2xl animate-pulse border border-white/5" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-24">
            <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <BookOpen size={24} className="text-slate-600" />
            </div>
            <h3 className="text-white font-bold text-lg mb-2">
              {posts.length === 0 ? 'Research coming soon' : 'No results found'}
            </h3>
            <p className="text-slate-500 text-sm">
              {posts.length === 0
                ? 'Our intelligence pipeline generates new research daily. Check back tomorrow.'
                : 'Try adjusting your search or filter.'}
            </p>
          </div>
        )}

        {/* Post grid */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filtered.map((post, idx) => {
              const pillarMeta = PILLAR_META[post.pillar];
              return (
                <button
                  key={post.id}
                  onClick={() => onViewPost(post.slug)}
                  className={`text-left bg-white/[0.03] border border-white/8 rounded-2xl p-6 hover:border-blue-500/30 hover:bg-white/5 transition-all group relative overflow-hidden ${idx === 0 ? 'md:col-span-2' : ''}`}
                >
                  {idx === 0 && (
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-[60px] pointer-events-none" />
                  )}

                  {pillarMeta && (
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        style={{ background: pillarMeta.color + '20', color: pillarMeta.color, borderColor: pillarMeta.color + '40' }}
                        className="text-[10px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-widest flex items-center gap-1.5"
                      >
                        {pillarMeta.icon}
                        {pillarMeta.label}
                      </span>
                    </div>
                  )}

                  <h2 className={`text-white font-black leading-tight mb-2 group-hover:text-blue-300 transition-colors ${idx === 0 ? 'text-2xl' : 'text-base'}`}>
                    {post.title}
                  </h2>

                  {post.seo_meta?.description && (
                    <p className="text-slate-400 text-sm leading-relaxed mb-4 line-clamp-2">
                      {post.seo_meta.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-slate-600 text-xs">
                      <Clock size={12} />
                      <span>{timeAgo(post.published_at)}</span>
                    </div>
                    <span className="text-blue-400 text-xs font-bold flex items-center gap-1 group-hover:gap-2 transition-all">
                      Read analysis <ChevronRight size={12} />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Subscribe CTA */}
        <div className="mt-16 bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-500/20 rounded-2xl p-8 text-center">
          <h3 className="text-white font-black text-xl mb-2">Get the weekly intelligence brief</h3>
          <p className="text-slate-400 text-sm mb-6">Data-backed labor market findings, delivered every Friday. No noise.</p>
          <NewsletterSignup />
        </div>
      </div>
    </div>
  );
};

// Newsletter signup embedded in hub
const NewsletterSignup: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) return;
    setStatus('loading');
    try {
      const adminUrl = import.meta.env.VITE_INTELLIGENCE_ADMIN_URL || '';
      const res = await fetch(`${adminUrl}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setStatus('success');
      } else {
        // Fallback: direct Supabase insert
        const { error } = await supabase.from('newsletter_subscribers').insert({ email });
        setStatus(error ? 'error' : 'success');
      }
    } catch {
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="text-green-400 font-bold text-sm">
        ✓ You're on the list. First brief arrives Friday.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
      <input
        id="newsletter-email"
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="your@email.com"
        required
        className="flex-1 bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500/50"
      />
      <button
        type="submit"
        disabled={status === 'loading'}
        className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
      >
        {status === 'loading' ? 'Subscribing...' : <>Subscribe <ArrowRight size={14} /></>}
      </button>
    </form>
  );
};
