import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Copy, Check, BookOpen, Clock, ChevronRight } from 'lucide-react';
import type { AppView } from '../types';

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  content_markdown: string;
  seo_meta: { description?: string; keywords?: string; og_title?: string };
  schema_markup: Record<string, unknown>;
  pillar: string;
  faq_pairs: Array<{ question: string; answer: string }>;
  published_at: string;
  brief_id: string;
}

const PILLAR_LABELS: Record<string, { label: string; color: string }> = {
  entry_level_collapse: { label: 'Entry-Level Collapse', color: '#EF4444' },
  compensation_reality: { label: 'Compensation Reality', color: '#10B981' },
  ai_hiring_impact: { label: 'AI Hiring Impact', color: '#8B5CF6' },
  remote_work_divide: { label: 'Remote Work Divide', color: '#3B82F6' },
  skills_velocity: { label: 'Skills Velocity', color: '#F59E0B' },
};

// ============================================================
// MARKDOWN RENDERER (lightweight — no external dep)
// ============================================================
function renderMarkdown(md: string): string {
  return md
    // H1
    .replace(/^# (.+)$/gm, '<h1 class="text-3xl font-black text-white mt-10 mb-4 leading-tight tracking-tight">$1</h1>')
    // H2
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-black text-white mt-10 mb-3 leading-tight">$1</h2>')
    // H3
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-bold text-slate-200 mt-6 mb-2">$1</h3>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-bold">$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em class="italic text-slate-300">$1</em>')
    // Inline code
    .replace(/`(.+?)`/g, '<code class="bg-white/10 text-blue-300 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li class="text-slate-300 leading-relaxed ml-4 list-disc marker:text-blue-400">$1</li>')
    // Paragraphs (blank line separated)
    .replace(/\n\n([^<\n].+)/g, '\n\n<p class="text-slate-300 leading-relaxed my-4">$1</p>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr class="border-white/10 my-8"/>')
    // Key Data Points section (special styling)
    .replace(
      /## Key Data Points\n([\s\S]+?)(?=\n##|$)/,
      (_, content) => {
        const lines = content.trim().split('\n').filter(Boolean);
        return `<div class="bg-white/[0.03] border border-white/10 rounded-2xl p-6 my-8">
          <h2 class="text-xs font-black text-blue-400 uppercase tracking-widest mb-4">📊 Key Data Points</h2>
          <ul class="space-y-2">${lines.map((l: string) =>
            `<li class="text-slate-300 text-sm leading-relaxed flex items-start gap-2"><span class="text-blue-400 mt-1">•</span>${l.replace(/^- /, '')}</li>`
          ).join('')}</ul>
        </div>`;
      }
    );
}

function getCiteText(post: BlogPost): string {
  const year = new Date(post.published_at).getFullYear();
  const month = new Date(post.published_at).toLocaleString('default', { month: 'long' });
  return `HireMax Intelligence. "${post.title}." HireMax Research, ${month} ${year}. https://www.hiremax.site/research/${post.slug}`;
}

interface ResearchPostViewProps {
  slug: string;
  onBack: () => void;
  onNavigate: (view: AppView, id?: string, data?: any) => void;
}

export const ResearchPostView: React.FC<ResearchPostViewProps> = ({ slug, onBack, onNavigate }) => {
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [citeCopied, setCiteCopied] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .single();
      if (error || !data) {
        setNotFound(true);
      } else {
        setPost(data as BlogPost);
      }
      setLoading(false);
    })();
  }, [slug]);

  // SEO + JSON-LD injection
  useEffect(() => {
    if (!post) return;
    document.title = `${post.title} — HireMax Intelligence`;

    // Meta description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', post.seo_meta?.description || post.title);

    // Article schema
    const articleSchema = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      description: post.seo_meta?.description || '',
      datePublished: post.published_at,
      dateModified: post.published_at,
      author: { '@type': 'Organization', name: 'HireMax Intelligence', url: 'https://www.hiremax.site' },
      publisher: { '@type': 'Organization', name: 'HireMax', url: 'https://www.hiremax.site' },
      keywords: post.seo_meta?.keywords || '',
      mainEntityOfPage: { '@type': 'WebPage', '@id': `https://www.hiremax.site/research/${post.slug}` },
    };

    // Dataset schema
    const datasetSchema = {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: `HireMax Intelligence — ${post.title}`,
      description: post.seo_meta?.description || '',
      creator: { '@type': 'Organization', name: 'HireMax Intelligence' },
      dateModified: post.published_at,
      url: `https://www.hiremax.site/research/${post.slug}`,
      license: 'https://creativecommons.org/licenses/by/4.0/',
    };

    // FAQPage schema
    const faqSchema = post.faq_pairs?.length > 0 ? {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: post.faq_pairs.map(faq => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    } : null;

    const schemas = [articleSchema, datasetSchema, ...(faqSchema ? [faqSchema] : [])];
    schemas.forEach((schema, i) => {
      const id = `research-post-schema-${i}`;
      let el = document.getElementById(id);
      if (!el) {
        el = document.createElement('script');
        el.id = id;
        (el as HTMLScriptElement).type = 'application/ld+json';
        document.head.appendChild(el);
      }
      el.textContent = JSON.stringify(schema);
    });

    return () => {
      for (let i = 0; i < 3; i++) {
        document.getElementById(`research-post-schema-${i}`)?.remove();
      }
    };
  }, [post]);

  const handleCopyCitation = () => {
    if (!post) return;
    navigator.clipboard.writeText(getCiteText(post)).then(() => {
      setCiteCopied(true);
      setTimeout(() => setCiteCopied(false), 2500);
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0B10] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">Loading research...</span>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#0A0B10] flex items-center justify-center flex-col gap-6 text-center px-6">
        <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center">
          <BookOpen size={24} className="text-slate-600" />
        </div>
        <div>
          <h2 className="text-white font-black text-xl mb-2">Research not found</h2>
          <p className="text-slate-500 text-sm">This piece may not be published yet.</p>
        </div>
        <button onClick={onBack} className="text-blue-400 text-sm font-bold flex items-center gap-2">
          <ArrowLeft size={14} /> Back to Research Hub
        </button>
      </div>
    );
  }

  if (!post) return null;

  const pillarMeta = PILLAR_LABELS[post.pillar];
  const publishedDate = new Date(post.published_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
  const readTimeWords = post.content_markdown.split(' ').length;
  const readMins = Math.ceil(readTimeWords / 200);

  return (
    <div className="min-h-screen bg-[#0A0B10]">
      {/* Top navigation bar */}
      <div className="border-b border-white/5 bg-[#0A0B10]/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-bold transition-colors"
          >
            <ArrowLeft size={14} />
            Research Hub
          </button>
          <div className="flex items-center gap-3">
            {/* Cite This Research button */}
            <button
              id="cite-research-btn"
              onClick={handleCopyCitation}
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            >
              {citeCopied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
              {citeCopied ? 'Citation copied!' : 'Cite This Research'}
            </button>
          </div>
        </div>
      </div>

      {/* Article content */}
      <article className="max-w-3xl mx-auto px-6 py-12">
        {/* Pillar badge + meta */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {pillarMeta && (
            <span
              style={{ background: pillarMeta.color + '20', color: pillarMeta.color, borderColor: pillarMeta.color + '40' }}
              className="text-[10px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-widest"
            >
              {pillarMeta.label}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-slate-500 text-xs">
            <Clock size={11} /> {publishedDate}
          </span>
          <span className="text-slate-600 text-xs">·</span>
          <span className="text-slate-500 text-xs">{readMins} min read</span>
          <span className="text-slate-600 text-xs">·</span>
          <span className="text-slate-500 text-xs">HireMax Intelligence</span>
        </div>

        {/* Data sources citation bar */}
        <div className="bg-white/[0.03] border border-white/8 rounded-xl px-4 py-3 mb-8 flex flex-wrap gap-2 items-center">
          <span className="text-xs text-slate-500 font-bold">Data sources:</span>
          {['BLS', 'FRED', 'Eurostat', 'ILO', 'Reddit', 'HN'].map(src => (
            <span key={src} className="text-[10px] font-bold text-slate-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-md uppercase tracking-widest">
              {src}
            </span>
          ))}
        </div>

        {/* Main content */}
        <div
          className="prose-content"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content_markdown) }}
        />

        {/* FAQ section (rendered from structured data if not in markdown) */}
        {post.faq_pairs?.length > 0 && (
          <div className="mt-12 border-t border-white/8 pt-10">
            <h2 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-6">Frequently Asked Questions</h2>
            <div className="space-y-6">
              {post.faq_pairs.map((faq, i) => (
                <div key={i} className="bg-white/[0.03] border border-white/8 rounded-xl p-5">
                  <h3 className="text-white font-bold text-sm mb-2">{faq.question}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Citation block */}
        <div className="mt-12 bg-white/[0.03] border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Cite This Research</h3>
            <button
              onClick={handleCopyCitation}
              className="flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
            >
              {citeCopied ? <Check size={12} /> : <Copy size={12} />}
              {citeCopied ? 'Copied!' : 'Copy citation'}
            </button>
          </div>
          <p className="text-slate-500 text-xs font-mono leading-relaxed bg-black/30 rounded-lg p-3 select-all">
            {getCiteText(post)}
          </p>
          <p className="text-slate-600 text-xs mt-3">
            Licensed under{' '}
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-400">
              CC BY 4.0
            </a>
            {' '}— free to cite with attribution.
          </p>
        </div>

        {/* CTA — link to HireMax product */}
        <div className="mt-8 bg-gradient-to-br from-blue-900/20 to-blue-900/10 border border-blue-500/20 rounded-2xl p-6">
          <p className="text-slate-300 text-sm leading-relaxed mb-4">
            HireMax tracks real-time hiring signals across 35+ sources — see how these market shifts affect your specific role and skill set.
          </p>
          <button
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors"
          >
            Analyze your career <ChevronRight size={14} />
          </button>
        </div>
      </article>
    </div>
  );
};
