-- 20260324_google_scout_init.sql
-- Initialize Google Jobs Backdoor Scout Infrastructure

BEGIN;

-- 1. SCOUT CONFIGURATION TABLE
-- Manages rotating search queries (role + location)
CREATE TABLE IF NOT EXISTS public.job_scout_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_title TEXT NOT NULL,
    geo_location TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_scanned_at TIMESTAMPTZ,
    scan_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(role_title, geo_location)
);

-- Index for rotation (least recently scanned first)
CREATE INDEX IF NOT EXISTS idx_scout_rotation ON public.job_scout_configs(last_scanned_at NULLS FIRST) WHERE is_active = true;

-- 2. SEED INITIAL TECH QUERIES (US All Hubs)
INSERT INTO public.job_scout_configs (role_title, geo_location)
VALUES 
    ('Software Engineer', 'San Francisco, CA'),
    ('Frontend Developer', 'New York, NY'),
    ('Backend Engineer', 'Seattle, WA'),
    ('Fullstack Engineer', 'Austin, TX'),
    ('DevOps Engineer', 'Remote'),
    ('Machine Learning Engineer', 'Palo Alto, CA'),
    ('Product Manager', 'Boston, MA'),
    ('UI/UX Designer', 'Los Angeles, CA'),
    ('Data Scientist', 'Chicago, IL'),
    ('Security Engineer', 'Washington, DC'),
    ('Staff Engineer', 'San Jose, CA'),
    ('Android Developer', 'Mountain View, CA'),
    ('iOS Developer', 'Cupertino, CA'),
    ('Engineering Manager', 'Denver, CO'),
    ('Solutions Architect', 'Atlanta, GA')
ON CONFLICT DO NOTHING;

-- 3. SOURCE RELIABILITY SEED
INSERT INTO public.source_reliability (source_type, status, reliability_score, is_active)
VALUES ('LINKEDIN_VIA_GOOGLE', 'HEALTHY', 1.0, true)
ON CONFLICT (source_type) DO UPDATE SET is_active = true;

COMMIT;
