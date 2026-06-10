-- ============================================================
-- HireMax Intelligence Engine — Full Schema Migration
-- Run in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- DATA LAYER
-- ============================================================

CREATE TABLE IF NOT EXISTS data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT NOT NULL UNIQUE,
  fetch_url TEXT NOT NULL,
  last_fetched_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active',
  config JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS raw_data_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT NOT NULL,
  data_type TEXT NOT NULL,
  geography TEXT DEFAULT 'Global',
  sector TEXT DEFAULT 'All',
  metric_name TEXT NOT NULL,
  metric_value NUMERIC,
  metric_unit TEXT,
  period_date DATE,
  period_label TEXT,
  raw_payload JSONB DEFAULT '{}',
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raw_data_lookup ON raw_data_points(data_type, period_date DESC);
CREATE INDEX IF NOT EXISTS idx_raw_data_source ON raw_data_points(source_name, fetched_at DESC);

CREATE TABLE IF NOT EXISTS trend_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pillar TEXT NOT NULL,
  headline TEXT NOT NULL,
  supporting_data JSONB DEFAULT '[]',
  contrarian_angle TEXT,
  significance_score NUMERIC DEFAULT 0.5,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  used_in_content BOOLEAN DEFAULT FALSE
);

-- ============================================================
-- CONTENT PIPELINE
-- ============================================================

CREATE TABLE IF NOT EXISTS research_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID REFERENCES trend_signals(id),
  title TEXT NOT NULL,
  core_finding TEXT NOT NULL,
  supporting_data JSONB DEFAULT '[]',
  content_pillar TEXT NOT NULL,
  contrarian_angle TEXT NOT NULL,
  target_keywords JSONB DEFAULT '[]',
  citation_potential TEXT DEFAULT 'medium',
  sams_angle TEXT DEFAULT '',
  sams_angle_added_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  reviewed_at TIMESTAMPTZ,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_pieces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id UUID REFERENCES research_briefs(id),
  content_type TEXT NOT NULL,
  title TEXT,
  slug TEXT UNIQUE,
  content TEXT NOT NULL,
  schema_markup JSONB DEFAULT '{}',
  seo_meta JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  scheduled_for TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  platform_post_id TEXT,
  platform TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_schedule ON content_pieces(status, scheduled_for ASC);
CREATE INDEX IF NOT EXISTS idx_content_type ON content_pieces(content_type, published_at DESC);

-- ============================================================
-- BLOG POSTS (serves /research frontend)
-- ============================================================

CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_piece_id UUID REFERENCES content_pieces(id),
  brief_id UUID REFERENCES research_briefs(id),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content_markdown TEXT NOT NULL,
  seo_meta JSONB DEFAULT '{}',
  schema_markup JSONB DEFAULT '{}',
  pillar TEXT,
  faq_pairs JSONB DEFAULT '[]',
  status TEXT DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_pillar ON blog_posts(pillar, published_at DESC);

-- ============================================================
-- CITATION FEEDBACK LOOP
-- ============================================================

CREATE TABLE IF NOT EXISTS citation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_piece_id UUID REFERENCES content_pieces(id),
  citation_source TEXT NOT NULL,
  referrer_domain TEXT,
  session_count INTEGER DEFAULT 1,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pillar_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pillar TEXT NOT NULL,
  week_start DATE NOT NULL,
  ai_citation_sessions INTEGER DEFAULT 0,
  linkedin_impressions INTEGER DEFAULT 0,
  reddit_upvotes INTEGER DEFAULT 0,
  total_score NUMERIC DEFAULT 0,
  UNIQUE(pillar, week_start)
);

CREATE TABLE IF NOT EXISTS distribution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_piece_id UUID REFERENCES content_pieces(id),
  platform TEXT NOT NULL,
  attempt_status TEXT NOT NULL,
  platform_response JSONB DEFAULT '{}',
  error_message TEXT,
  attempted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS newsletter_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_number SERIAL,
  subject_line TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  subscriber_count INTEGER DEFAULT 0
);

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- blog_posts: public read, service role write
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blog_posts_public_read" ON blog_posts
  FOR SELECT USING (status = 'published');

CREATE POLICY "blog_posts_service_write" ON blog_posts
  FOR ALL USING (auth.role() = 'service_role');

-- research_briefs: service role only
ALTER TABLE research_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "research_briefs_service_all" ON research_briefs
  FOR ALL USING (auth.role() = 'service_role');

-- Allow authenticated admin to read briefs (for admin dashboard)
CREATE POLICY "research_briefs_admin_read" ON research_briefs
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated admin to update briefs (approve/reject/angle)
CREATE POLICY "research_briefs_admin_update" ON research_briefs
  FOR UPDATE USING (auth.role() = 'authenticated');

-- content_pieces: service role write, authenticated read
ALTER TABLE content_pieces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_pieces_service_write" ON content_pieces
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "content_pieces_admin_read" ON content_pieces
  FOR SELECT USING (auth.role() = 'authenticated');

-- newsletter_subscribers: public insert, service role all
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "newsletter_sub_public_insert" ON newsletter_subscribers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "newsletter_sub_service_all" ON newsletter_subscribers
  FOR ALL USING (auth.role() = 'service_role');

-- pillar_performance: authenticated read
ALTER TABLE pillar_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pillar_perf_authenticated_read" ON pillar_performance
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "pillar_perf_service_write" ON pillar_performance
  FOR ALL USING (auth.role() = 'service_role');

-- trend_signals: service role all
ALTER TABLE trend_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trend_signals_service_all" ON trend_signals
  FOR ALL USING (auth.role() = 'service_role');

-- raw_data_points: service role all
ALTER TABLE raw_data_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "raw_data_service_all" ON raw_data_points
  FOR ALL USING (auth.role() = 'service_role');

-- data_sources: service role all
ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "data_sources_service_all" ON data_sources
  FOR ALL USING (auth.role() = 'service_role');

-- distribution_log: service role all
ALTER TABLE distribution_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dist_log_service_all" ON distribution_log
  FOR ALL USING (auth.role() = 'service_role');

-- citation_events: service role all
ALTER TABLE citation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "citation_events_service_all" ON citation_events
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- SEED DATA: 6 data sources
-- ============================================================

INSERT INTO data_sources (source_name, fetch_url, config) VALUES
('bls_jolt', 'https://api.bls.gov/publicAPI/v2/timeseries/data/',
  '{"series":["JTS000000000000000JOR","JTS000000000000000HIR","JTS000000000000000TSR"],
    "description":"Job openings, hires, separations rates"}'),
('fred_labor', 'https://fred.stlouisfed.org/graph/fredgraph.csv',
  '{"series":["UNRATE","LNS14000024","LNS14000036","JTSJOL"],
    "description":"Unemployment overall + by age group + job openings level"}'),
('eurostat_unemployment', 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/une_rt_m',
  '{"params":"geo=EU27_2020&sex=T&age=Y15-74&s_adj=SA&unit=PC_ACT&sinceTimePeriod=2023-01",
    "description":"EU monthly unemployment rate"}'),
('ilo_global', 'https://rplumber.ilo.org/data/indicator/',
  '{"indicator":"UNE_TUNE_SEX_AGE_NB_A",
    "description":"ILO global unemployment by age"}'),
('reddit_sentiment', 'https://www.reddit.com/r/jobs/hot.json',
  '{"subreddits":["jobs","cscareerquestions","recruitinghell","ExperiencedDevs"],
    "limit":25, "description":"Job seeker community sentiment"}'),
('hn_jobs', 'https://hacker-news.firebaseio.com/v0/',
  '{"description":"Hacker News Who Is Hiring and job-related posts"}')
ON CONFLICT (source_name) DO NOTHING;
