import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Copy, Check, BookOpen, Clock, ChevronRight, Twitter, Linkedin } from 'lucide-react';
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
  macro: { label: 'Macro Trends', color: '#3B82F6' },
  tech: { label: 'Technology Signal', color: '#8B5CF6' },
  convergence: { label: 'Convergence Analysis', color: '#F59E0B' },
};

function getPillarImage(pillar: string): string {
  const images: Record<string, string> = {
    entry_level_collapse: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1200&h=600&q=80',
    compensation_reality: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1200&h=600&q=80',
    ai_hiring_impact: 'https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=1200&h=600&q=80',
    remote_work_divide: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=1200&h=600&q=80',
    skills_velocity: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&h=600&q=80',
    macro: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&h=600&q=80',
    tech: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&h=600&q=80',
    convergence: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&h=600&q=80',
  };
  return images[pillar] || 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&h=600&q=80';
}

// ============================================================
// MARKDOWN RENDERER — clean, vertical, no grids
// ============================================================
function renderMarkdown(md: string): string {
  if (!md) return '';
  let out = md;

  // 1. Key Data Points section — vertical list
  out = out.replace(
    /## Key Data Points\s*\n([\s\S]+?)(?=\n## |\n# |$)/i,
    (_: string, content: string) => {
      const lines = content.trim().split('\n').filter((l: string) => l.trim());
      const items = lines.map((l: string) => {
        const clean = l.replace(/^[-*\d.]+\s*/, '').trim();
        if (!clean) return '';
        const parenMatch = clean.match(/^(.+?)\s*\((.+?)\)\s*$/);
        if (parenMatch) {
          return `<div class="flex items-start gap-3 py-3 border-b border-white/[0.05] last:border-0">
            <span class="text-blue-400 shrink-0 mt-0.5">▸</span>
            <div>
              <p class="text-white text-sm font-semibold leading-snug">${parenMatch[1].trim()}</p>
              <p class="text-slate-500 text-[11px] font-bold uppercase tracking-wider mt-0.5">${parenMatch[2].trim()}</p>
            </div>
          </div>`;
        }
        return `<div class="flex items-start gap-3 py-3 border-b border-white/[0.05] last:border-0">
          <span class="text-blue-400 shrink-0 mt-0.5">▸</span>
          <p class="text-slate-200 text-sm leading-relaxed">${clean}</p>
        </div>`;
      }).join('');
      return `<div class="my-8 bg-white/[0.03] border border-white/[0.08] rounded-2xl px-5 py-2">
        <p class="text-[10px] font-black text-blue-400 uppercase tracking-widest pt-4 pb-2 flex items-center gap-2"><span>📊</span>Key Data Points</p>
        ${items}
      </div>`;
    }
  );

  // 2. FAQ section — accordion cards
  out = out.replace(
    /## FAQ\s*\n([\s\S]+?)(?=\n## |\n# |$)/i,
    (_: string, content: string) => {
      const qaPairs: Array<{ q: string; a: string }> = [];
      const pattern = /###?\s*(.+?)\n+([\s\S]+?)(?=###?\s|$)/g;
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(content)) !== null && qaPairs.length < 6) {
        qaPairs.push({
          q: m[1].replace(/\*\*/g, '').trim(),
          a: m[2].replace(/\*\*/g, '').trim().slice(0, 500),
        });
      }
      if (!qaPairs.length) {
        return `<div class="mt-10"><p class="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-4">FAQ</p>${content}</div>`;
      }
      const cards = qaPairs.map(({ q, a }) =>
        `<div class="bg-white/[0.03] border border-white/[0.07] rounded-xl p-5 mb-3">
          <p class="text-white font-bold text-sm mb-2">${q}</p>
          <p class="text-slate-400 text-sm leading-relaxed">${a}</p>
        </div>`
      ).join('');
      return `<div class="mt-12 border-t border-white/[0.06] pt-10">
        <p class="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-5">Frequently Asked Questions</p>
        ${cards}
      </div>`;
    }
  );

  // 3. Key Insight blockquotes
  out = out.replace(
    /^> \*\*Key Insight:\*\*\s*(.+)$/gm,
    `<div class="my-6 flex gap-3 bg-blue-500/[0.06] border border-blue-500/20 rounded-xl p-4">
      <div class="shrink-0 w-1 rounded-full bg-blue-500/60 self-stretch"></div>
      <div><span class="text-[9px] font-black text-blue-400 uppercase tracking-widest block mb-1">Key Insight</span>
      <p class="text-blue-100 text-sm font-semibold leading-relaxed m-0">$1</p></div>
    </div>`
  );

  // 4. Generic blockquotes
  out = out.replace(
    /^> (.+)$/gm,
    `<blockquote class="border-l-2 border-white/20 pl-4 my-4 text-slate-400 italic text-sm leading-relaxed">$1</blockquote>`
  );

  // 5. Headings
  out = out.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-black text-white mt-10 mb-4 leading-tight tracking-tight">$1</h1>');
  out = out.replace(/^## (.+)$/gm, '<h2 class="text-lg font-black text-white mt-10 mb-3 leading-tight border-b border-white/[0.06] pb-2">$1</h2>');
  out = out.replace(/^### (.+)$/gm, '<h3 class="text-base font-bold text-slate-200 mt-7 mb-2">$1</h3>');

  // 6. Bold / Italic / Code
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-bold">$1</strong>');
  out = out.replace(/\*(.+?)\*/g, '<em class="italic text-slate-300">$1</em>');
  out = out.replace(/`(.+?)`/g, '<code class="bg-white/10 text-blue-300 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>');

  // 7. HR
  out = out.replace(/^---$/gm, '<hr class="border-white/[0.08] my-10"/>');

  // 8. Ordered list items
  out = out.replace(
    /^\d+\.\s+(.+)$/gm,
    '<li class="text-slate-300 leading-relaxed mb-1.5 ml-6" style="list-style-type:decimal;display:list-item">$1</li>'
  );

  // 9. Unordered list items
  out = out.replace(
    /^[-*]\s+(.+)$/gm,
    '<li class="text-slate-300 leading-relaxed mb-1.5 flex gap-2"><span class="text-blue-400 mt-1 shrink-0">▸</span><span>$1</span></li>'
  );

  // 10. Paragraphs — blank-line separated, don't wrap existing HTML
  out = out.replace(/\n\n([^<\n].+)/g, '\n\n<p class="text-slate-300 leading-[1.85] my-5 text-[15px]">$1</p>');

  return out;
}

function getCiteText(post: BlogPost): string {
  const year = new Date(post.published_at).getFullYear();
  const month = new Date(post.published_at).toLocaleString('default', { month: 'long' });
  return `Singh, Harsimar 'sam'. "${post.title}." HireMax Research, ${month} ${year}. https://www.hiremax.site/research/${post.slug}`;
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

    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', post.seo_meta?.description || post.title);

    const articleSchema = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      description: post.seo_meta?.description || '',
      author: {
        '@type': 'Person',
        name: 'Harsimar Singh',
        url: 'https://www.hiremax.site',
        jobTitle: 'Labor Market Analyst',
      },
      publisher: {
        '@type': 'Organization',
        name: 'HireMax Intelligence',
        url: 'https://www.hiremax.site',
        logo: { '@type': 'ImageObject', url: 'https://www.hiremax.site/favicon.png' },
      },
      datePublished: post.published_at,
      dateModified: post.published_at,
      url: `https://www.hiremax.site/research/${post.slug}`,
      image: getPillarImage(post.pillar),
      articleSection: PILLAR_LABELS[post.pillar]?.label || 'Labor Market Intelligence',
      keywords: post.seo_meta?.keywords || '',
      mainEntityOfPage: { '@type': 'WebPage', '@id': `https://www.hiremax.site/research/${post.slug}` },
    };

    const faqSchema = post.faq_pairs?.length > 0 ? {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: post.faq_pairs.map(faq => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    } : null;

    const setMeta = (attr: string, attrVal: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${attrVal}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, attrVal);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    const articleUrl = `https://www.hiremax.site/research/${post.slug}`;
    const ogImage = getPillarImage(post.pillar);
    setMeta('property', 'og:type', 'article');
    setMeta('property', 'og:title', post.title);
    setMeta('property', 'og:description', post.seo_meta?.description || post.title);
    setMeta('property', 'og:url', articleUrl);
    setMeta('property', 'og:image', ogImage);
    setMeta('property', 'og:site_name', 'HireMax Intelligence');
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', post.title);
    setMeta('name', 'twitter:description', post.seo_meta?.description || post.title);
    setMeta('name', 'twitter:image', ogImage);
    setMeta('name', 'twitter:creator', '@hiremaxhq');
    setMeta('name', 'author', 'Harsimar Singh');

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = articleUrl;

    const schemas = [articleSchema, ...(faqSchema ? [faqSchema] : [])];
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
      for (let i = 0; i < 3; i++) document.getElementById(`research-post-schema-${i}`)?.remove();
      document.querySelector('link[rel="canonical"]')?.remove();
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
    year: 'numeric', month: 'long', day: 'numeric',
  });
  const readMins = Math.ceil(post.content_markdown.split(' ').length / 200);

  return (
    <div className="min-h-screen bg-[#0A0B10]">

      {/* ── Top nav bar ── */}
      <div className="border-b border-white/5 bg-[#0A0B10]/90 backdrop-blur-sm sticky top-16 z-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-bold transition-colors shrink-0"
          >
            <ArrowLeft size={14} />
            <span className="hidden sm:inline">Research Hub</span>
          </button>
          <div className="flex items-center gap-2">
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(`https://www.hiremax.site/research/${post.slug}`)}&via=hiremaxhq`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all"
            >
              <Twitter size={11} />
              <span className="hidden sm:inline">Share</span>
            </a>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`https://www.hiremax.site/research/${post.slug}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all"
            >
              <Linkedin size={11} />
              <span className="hidden sm:inline">Share</span>
            </a>
            <button
              id="cite-research-btn"
              onClick={handleCopyCitation}
              className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all"
            >
              {citeCopied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
              {citeCopied ? 'Copied!' : 'Cite'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Hero cover image ── */}
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 pt-8">
        <div className="w-full h-48 sm:h-64 rounded-2xl overflow-hidden relative border border-white/10">
          <img
            src={getPillarImage(post.pillar)}
            alt={post.title}
            className="w-full h-full object-cover opacity-50"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0B10] via-transparent to-transparent" />
        </div>
      </div>

      {/* ── Article ── */}
      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-8">

        {/* Pillar + meta */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
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
          <span className="text-slate-500 text-xs">Harsimar Singh · HireMax Research</span>
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight tracking-tight mb-6">
          {post.title}
        </h1>

        {/* Data sources */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 mb-8 flex flex-wrap gap-2 items-center">
          <span className="text-xs text-slate-500 font-bold">Data sources:</span>
          {['BLS', 'FRED', 'Eurostat', 'ILO', 'Reddit', 'HN'].map(src => (
            <span key={src} className="text-[10px] font-bold text-slate-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-md uppercase tracking-widest">
              {src}
            </span>
          ))}
        </div>

        {/* Main markdown content */}
        <div
          className="prose-content"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content_markdown) }}
        />

        {/* Structured FAQ from DB (if not already in markdown) */}
        {post.faq_pairs?.length > 0 && (
          <div className="mt-12 border-t border-white/[0.06] pt-10">
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-6">Frequently Asked Questions</p>
            <div className="space-y-4">
              {post.faq_pairs.map((faq, i) => (
                <div key={i} className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-5">
                  <p className="text-white font-bold text-sm mb-2">{faq.question}</p>
                  <p className="text-slate-400 text-sm leading-relaxed">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Citation */}
        <div className="mt-12 bg-white/[0.03] border border-white/10 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Cite This Research</p>
            <button
              onClick={handleCopyCitation}
              className="flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
            >
              {citeCopied ? <Check size={12} /> : <Copy size={12} />}
              {citeCopied ? 'Copied!' : 'Copy citation'}
            </button>
          </div>
          <p className="text-slate-500 text-xs font-mono leading-relaxed bg-black/30 rounded-lg p-3 select-all break-all">
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

        {/* CTA */}
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
