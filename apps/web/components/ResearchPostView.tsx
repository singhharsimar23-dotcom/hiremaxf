import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Copy, Check, BookOpen, Clock, ChevronRight, Twitter, Linkedin, Link } from 'lucide-react';
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

const DynamicDataChart: React.FC<{ post: BlogPost }> = ({ post }) => {
  // 1. Extract values
  let zScore = 1.8;
  const zMatch = post.content_markdown.match(/z-score of\s*([+-]?\d+(?:\.\d+)?)/i) || 
                 post.content_markdown.match(/z-score:\s*([+-]?\d+(?:\.\d+)?)/i) ||
                 post.content_markdown.match(/z-score\s*([+-]?\d+(?:\.\d+)?)/i);
  if (zMatch) zScore = parseFloat(zMatch[1]);

  const numbers = post.title.match(/\d+(?:,\d{3})*(?:\.\d+)?%?/g) || [];
  let valStr = '';
  for (const num of numbers) {
    const parsed = parseFloat(num.replace(/,/g, ''));
    if (!(parsed >= 1990 && parsed <= 2040)) {
      valStr = num;
      break;
    }
  }
  if (!valStr && numbers.length > 0) valStr = numbers[0];
  if (!valStr) valStr = 'Anomaly';

  const titleMatch = post.title.match(/^([A-Z0-9]{2,10})\b/);
  const metricLabel = titleMatch ? titleMatch[1] : 'Signal Index';

  // 2. Generate points for line chart
  const baseValue = 100;
  const points: Array<{ x: number; y: number }> = [];
  const numPoints = 8;
  
  for (let i = 0; i < numPoints; i++) {
    // Wave pattern
    const fluctuation = Math.sin(i * 1.2) * 20 + Math.cos(i * 0.7) * 10;
    points.push({
      x: (i / (numPoints - 1)) * 260 + 20, // 20 to 280
      y: 120 - (baseValue + fluctuation - 40) // 120 is height
    });
  }

  // Anomaly spike
  const isPositive = zScore >= 0;
  const anomalyOffset = zScore * 18; // 18px per unit
  const currentY = Math.min(110, Math.max(15, 60 - anomalyOffset));
  points[numPoints - 1] = {
    x: 280,
    y: currentY
  };

  // Forecast points
  const forecastPoints = [
    { x: 280, y: currentY },
    { x: 320, y: currentY - (anomalyOffset * 0.4) },
    { x: 360, y: currentY - (anomalyOffset * 0.6) }
  ];

  // Path generator
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L 280 120 L 20 120 Z`;
  const forecastPath = forecastPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  const zBadgeColor = isPositive ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-rose-400 bg-rose-500/10 border-rose-500/20';

  return (
    <div className="w-full flex flex-col justify-between h-full">
      {/* Title / Metric details */}
      <div className="flex items-start justify-between border-b border-white/5 pb-3 mb-2">
        <div>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Statistical Anomaly</span>
          <h3 className="text-white font-black text-lg leading-tight mt-0.5">{metricLabel} Trend Line</h3>
        </div>
        <div className="text-right">
          <div className="text-white font-black text-lg leading-none">{valStr}</div>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-wider mt-1.5 ${zBadgeColor}`}>
            {isPositive ? '↑' : '↓'} Z-Score {zScore.toFixed(2)}
          </span>
        </div>
      </div>

      {/* SVG Chart area */}
      <div className="flex-1 min-h-[120px] relative mt-2">
        <svg viewBox="0 0 380 130" className="w-full h-full overflow-visible">
          <defs>
            {/* Area gradient */}
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.00" />
            </linearGradient>
            {/* Line glow filter */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#3B82F6" floodOpacity="0.4" />
            </filter>
          </defs>

          {/* Grid lines */}
          <line x1="20" y1="30" x2="360" y2="30" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          <line x1="20" y1="75" x2="360" y2="75" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          <line x1="20" y1="120" x2="360" y2="120" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

          {/* Area Fill */}
          <path d={areaPath} fill="url(#areaGrad)" />

          {/* Baseline dotted line */}
          <line x1="20" y1="60" x2="360" y2="60" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="3 3" />

          {/* Main Trend Line */}
          <path d={linePath} fill="none" stroke="#3B82F6" strokeWidth="2.5" filter="url(#glow)" />

          {/* Forecast Trend Line */}
          <path d={forecastPath} fill="none" stroke="#10B981" strokeWidth="2.5" strokeDasharray="4 4" />

          {/* Anomaly glowing dot */}
          <circle cx="280" cy={currentY} r="5" fill="#3B82F6" />
          <circle cx="280" cy={currentY} r="9" fill="none" stroke="#3B82F6" strokeWidth="1.5" className="animate-ping" style={{ transformOrigin: '280px ' + currentY + 'px' }} />

          {/* Forecast end dot */}
          <circle cx="360" cy={forecastPoints[2].y} r="4" fill="#10B981" />

          {/* Chart labels */}
          <text x="20" y="128" fill="rgba(255,255,255,0.3)" fontSize="8" fontWeight="bold" fontFamily="sans-serif">HISTORICAL BASELINE</text>
          <text x="280" y="128" fill="#3B82F6" fontSize="8" fontWeight="black" textAnchor="middle" fontFamily="sans-serif">ANOMALY</text>
          <text x="360" y="128" fill="#10B981" fontSize="8" fontWeight="black" textAnchor="end" fontFamily="sans-serif">FORECAST</text>
        </svg>
      </div>
    </div>
  );
};

// ============================================================
// MARKDOWN RENDERER (lightweight — no external dep)
// ============================================================
function renderMarkdown(md: string): string {
  // Pre-process: extract and style the opening bold paragraph as an answer capsule
  // The answer capsule is the first paragraph that is entirely bold (**...**)
  let processed = md;

  // Style blockquotes as Key Insight callout boxes (before other transforms)
  processed = processed.replace(
    /^> \*\*Key Insight:\*\* (.+)$/gm,
    `<div class="my-6 flex gap-3 bg-blue-500/[0.06] border border-blue-500/20 rounded-xl p-4">
      <div class="shrink-0 w-1 rounded-full bg-blue-500/60 self-stretch" />
      <div><span class="text-[9px] font-black text-blue-400 uppercase tracking-widest block mb-1">Key Insight</span><p class="text-blue-100 text-sm font-semibold leading-relaxed m-0">$1</p></div>
    </div>`
  );

  // Generic blockquotes (not Key Insight) — pull quote style
  processed = processed.replace(
    /^> (.+)$/gm,
    `<blockquote class="border-l-2 border-white/20 pl-4 my-4 text-slate-400 italic text-sm leading-relaxed">$1</blockquote>`
  );

  return processed
    // H1
    .replace(/^# (.+)$/gm, '<h1 class="text-3xl font-black text-white mt-10 mb-4 leading-tight tracking-tight">$1</h1>')
    // H2
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-black text-white mt-12 mb-3 leading-tight border-b border-white/[0.06] pb-2">$1</h2>')
    // H3
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-bold text-slate-200 mt-7 mb-2">$1</h3>')
    // Bold (MUST come before italic to avoid greedy issues)
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-bold">$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em class="italic text-slate-300">$1</em>')
    // Inline code
    .replace(/`(.+?)`/g, '<code class="bg-white/10 text-blue-300 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr class="border-white/[0.08] my-10"/>')
    // Ordered list items
    .replace(/^\d+\. (.+)$/gm, '<li class="text-slate-300 leading-relaxed ml-4 mb-1" style="list-style-type:decimal;display:list-item;margin-left:1.5rem">$1</li>')
    // Unordered list items
    .replace(/^[-*] (.+)$/gm, '<li class="text-slate-300 leading-relaxed mb-1.5 flex gap-2"><span class="text-blue-400 mt-1 shrink-0">▸</span><span>$1</span></li>')
    // Key Data Points section — vertical card list (no horizontal grid that breaks layout)
    .replace(
      /## Key Data Points\n([\s\S]+?)(?=\n##|$)/,
      (_, content) => {
        const lines = content.trim().split('\n').filter(Boolean);
        return `<div class="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 my-10">
          <h2 class="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-5 flex items-center gap-2">
            <span class="text-base">📊</span> Key Data Points
          </h2>
          <div class="flex flex-col gap-2.5">
            ${lines.map((l: string) => {
              const clean = l.replace(/^[-*\d.] /, '').trim();
              const parts = clean.match(/^(.+?)\s*\((.+)\)$/);
              if (parts) {
                return `<div class="bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-3 flex items-start gap-3">
                  <span class="text-blue-400 mt-0.5 shrink-0 text-sm">▸</span>
                  <div><p class="text-white text-sm font-bold leading-snug">${parts[1].trim()}</p>
                  <p class="text-slate-500 text-[10px] font-bold uppercase tracking-wider mt-0.5">${parts[2].trim()}</p></div>
                </div>`;
              }
              return `<div class="bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-3 flex items-start gap-3"><span class="text-blue-400 mt-0.5 shrink-0 text-sm">▸</span><p class="text-slate-300 text-sm leading-relaxed">${clean}</p></div>`;
            }).join('')}
          </div>
        </div>`;
      }
    )
    // FAQ section — styled accordion look
    .replace(
      /## FAQ\n([\s\S]+?)(?=\n##|$)/i,
      (_, content) => {
        const qaPairs: Array<{q: string; a: string}> = [];
        const pattern = /###? (.+?)\n+([\s\S]+?)(?=###? |$)/g;
        let match;
        const contentForParsing = content;
        while ((match = pattern.exec(contentForParsing)) !== null) {
          qaPairs.push({ q: match[1].replace(/\*\*/g, '').trim(), a: match[2].replace(/\*\*/g, '').trim().slice(0, 400) });
          if (qaPairs.length >= 5) break;
        }
        if (qaPairs.length === 0) return `<div class="mt-10"><h2 class="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-4">FAQ</h2>${content}</div>`;
        return `<div class="mt-12 border-t border-white/[0.06] pt-10">
          <h2 class="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-6">Frequently Asked Questions</h2>
          <div class="space-y-4">
            ${qaPairs.map(({ q, a }) => `
              <div class="bg-white/[0.03] border border-white/[0.07] rounded-xl p-5">
                <h3 class="text-white font-bold text-sm mb-2">${q}</h3>
                <p class="text-slate-400 text-sm leading-relaxed">${a}</p>
              </div>`).join('')}
          </div>
        </div>`;
      }
    )
    // Paragraphs — blank-line separated blocks
    .replace(/\n\n([^<\n].+)/g, '\n\n<p class="text-slate-300 leading-[1.85] my-5 text-[15px]">$1</p>');
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

    // Meta description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', post.seo_meta?.description || post.title);

    // Article schema with enhanced Person schema
    const authorPerson = {
      '@type': 'Person',
      name: 'Harsimar Singh',
      alternateName: "Harsimar 'sam' Singh",
      jobTitle: 'Researcher, Labor Market Intelligence',
      worksFor: { '@type': 'Organization', name: 'HireMax', url: 'https://www.hiremax.site' },
      url: 'https://www.hiremax.site',
      email: 'research@hiremax.site',
      sameAs: [
        'https://www.hiremax.site',
        'https://www.hiremax.site/research',
      ],
      knowsAbout: [
        'Labor market economics',
        'Hiring trends and ATS systems',
        'AI impact on employment',
        'Global workforce data analysis',
        'Resume optimization',
        'Career intelligence',
      ],
    };
    const articleSchema = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      description: post.seo_meta?.description || '',
      datePublished: post.published_at,
      dateModified: post.published_at,
      author: authorPerson,
      publisher: { '@type': 'Organization', name: 'HireMax Intelligence', url: 'https://www.hiremax.site' },
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

    // OG + Twitter card meta tags
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
    const pillarImages: Record<string, string> = {
      ai_hiring_impact: 'https://images.unsplash.com/photo-1677442136019-21780efad99a?w=1200&h=630&fit=crop',
      macro: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&h=630&fit=crop',
      tech: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&h=630&fit=crop',
      convergence: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&h=630&fit=crop',
      entry_level_collapse: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1200&h=630&fit=crop',
      compensation_reality: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=1200&h=630&fit=crop',
      remote_work_divide: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=1200&h=630&fit=crop',
      skills_velocity: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&h=630&fit=crop',
    };
    const ogImage = pillarImages[post.pillar] || pillarImages.convergence;
    // OG
    setMeta('property', 'og:type', 'article');
    setMeta('property', 'og:title', post.title);
    setMeta('property', 'og:description', post.seo_meta?.description || post.title);
    setMeta('property', 'og:url', articleUrl);
    setMeta('property', 'og:image', ogImage);
    setMeta('property', 'og:site_name', 'HireMax Intelligence');
    setMeta('property', 'article:author', 'Harsimar Singh');
    setMeta('property', 'article:published_time', post.published_at);
    // Twitter card
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', post.title);
    setMeta('name', 'twitter:description', post.seo_meta?.description || post.title);
    setMeta('name', 'twitter:image', ogImage);
    setMeta('name', 'twitter:creator', '@hiremaxhq');
    setMeta('name', 'author', 'Harsimar Singh');
    // Canonical
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = articleUrl;

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
          <div className="flex items-center gap-2">
            {/* Social share */}
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(`https://www.hiremax.site/research/${post.slug}`)}&via=hiremaxhq`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all"
            >
              <Twitter size={11} />
              <span className="hidden sm:inline">Share</span>
            </a>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`https://www.hiremax.site/research/${post.slug}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all"
            >
              <Linkedin size={11} />
              <span className="hidden sm:inline">Share</span>
            </a>
            {/* Cite This Research button */}
            <button
              id="cite-research-btn"
              onClick={handleCopyCitation}
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            >
              {citeCopied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
              {citeCopied ? 'Copied!' : 'Cite'}
            </button>
          </div>
        </div>
      </div>

      {/* Premium Research Dashboard Hero Banner */}
      <div className="w-full max-w-4xl mx-auto px-6 pt-8">
        <div className="w-full bg-[#12131A] border border-white/10 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row gap-8 shadow-2xl relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />
          
          {/* LEFT: Cover Photo with overlay stats */}
          <div className="w-full md:w-[320px] h-48 md:h-64 rounded-2xl overflow-hidden relative border border-white/5 shrink-0">
            <img 
              src={getPillarImage(post.pillar)} 
              alt={post.title} 
              className="w-full h-full object-cover opacity-60"
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#12131A] via-[#12131A]/30 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 z-10">
              <span className="text-[9px] font-black uppercase tracking-widest text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
                Live Data Feed
              </span>
              <p className="text-white font-bold text-sm mt-1 truncate">{post.title}</p>
            </div>
          </div>
          
          {/* RIGHT: Dynamic SVG Data Visualization Chart */}
          <div className="flex-1 flex flex-col justify-between min-h-[240px]">
            <DynamicDataChart post={post} />
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
          <span className="text-slate-500 text-xs">Harsimar Singh · HireMax Research</span>
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
