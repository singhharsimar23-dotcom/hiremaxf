-- jobs_for_you_v2_migration.sql

-- 1. Create discovery_sessions_v2 table
CREATE TABLE IF NOT EXISTS public.discovery_sessions_v2 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    resume_id UUID,
    target_role TEXT,
    seniority_level TEXT,
    geo_filter TEXT,
    filters JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for discovery_sessions_v2
ALTER TABLE public.discovery_sessions_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own discovery sessions v2" 
    ON public.discovery_sessions_v2 
    FOR ALL 
    USING (auth.uid() = user_id);

-- 2. Extend job_pointers table
ALTER TABLE public.job_pointers
    ADD COLUMN IF NOT EXISTS salary_low INTEGER,
    ADD COLUMN IF NOT EXISTS salary_high INTEGER,
    -- salary_currency already exists
    ADD COLUMN IF NOT EXISTS company_size TEXT,
    ADD COLUMN IF NOT EXISTS company_growth_rate NUMERIC,
    
    ADD COLUMN IF NOT EXISTS required_skills TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS preferred_skills TEXT[] DEFAULT '{}',
    
    ADD COLUMN IF NOT EXISTS years_required INTEGER,
    ADD COLUMN IF NOT EXISTS tech_stack TEXT[] DEFAULT '{}',
    
    ADD COLUMN IF NOT EXISTS hiring_urgency_score INTEGER,
    ADD COLUMN IF NOT EXISTS competition_score INTEGER,
    ADD COLUMN IF NOT EXISTS referral_likelihood_score INTEGER,
    
    ADD COLUMN IF NOT EXISTS visa_support BOOLEAN,
    ADD COLUMN IF NOT EXISTS security_clearance_required BOOLEAN,
    
    ADD COLUMN IF NOT EXISTS application_deadline TIMESTAMPTZ,
    
    ADD COLUMN IF NOT EXISTS ats_keywords TEXT[] DEFAULT '{}',
    
    ADD COLUMN IF NOT EXISTS enrichment_status TEXT DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS enrichment_attempts INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_enriched_at TIMESTAMPTZ;

-- 3. Create Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_job_pointers_salary_low ON public.job_pointers(salary_low);
CREATE INDEX IF NOT EXISTS idx_job_pointers_competition_score ON public.job_pointers(competition_score);
CREATE INDEX IF NOT EXISTS idx_job_pointers_hiring_urgency_score ON public.job_pointers(hiring_urgency_score);
CREATE INDEX IF NOT EXISTS idx_job_pointers_enrichment_status ON public.job_pointers(enrichment_status);
CREATE INDEX IF NOT EXISTS idx_job_pointers_required_skills_gin ON public.job_pointers USING GIN(required_skills);
CREATE INDEX IF NOT EXISTS idx_job_pointers_tech_stack_gin ON public.job_pointers USING GIN(tech_stack);

-- Optional trigger to auto-update updated_at for discovery_sessions_v2
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_discovery_sessions_v2_updated_at
BEFORE UPDATE ON public.discovery_sessions_v2
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

