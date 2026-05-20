-- Enable RLS
ALTER TABLE public.job_pointers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_pre_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_cursors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cursors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_dlq ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archival_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to avoid conflicts
DROP POLICY IF EXISTS "allow_select" ON public.job_pointers;
DROP POLICY IF EXISTS "allow_select" ON public.job_content;
DROP POLICY IF EXISTS "allow_select" ON public.role_patterns;
DROP POLICY IF EXISTS "allow_select" ON public.company_signals;
DROP POLICY IF EXISTS "allow_select" ON public.company_pre_signals;
DROP POLICY IF EXISTS "allow_select" ON public.application_outcomes;
DROP POLICY IF EXISTS "allow_select" ON public.company_registry;
DROP POLICY IF EXISTS "allow_select" ON public.company_cursors;
DROP POLICY IF EXISTS "allow_select" ON public.cursors;
DROP POLICY IF EXISTS "allow_select" ON public.ingestion_dlq;
DROP POLICY IF EXISTS "allow_select" ON public.source_health;
DROP POLICY IF EXISTS "allow_select" ON public.ingestion_runs;
DROP POLICY IF EXISTS "allow_select" ON public.archival_log;

-- Add SELECT policies (authenticated and anon read access for data tables, user-specific for outcomes)
CREATE POLICY "allow_select" ON public.job_pointers FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "allow_select" ON public.job_content FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "allow_select" ON public.role_patterns FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "allow_select" ON public.company_signals FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "allow_select" ON public.company_pre_signals FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "allow_select" ON public.application_outcomes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "allow_select" ON public.company_registry FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "allow_select" ON public.company_cursors FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "allow_select" ON public.cursors FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "allow_select" ON public.ingestion_dlq FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "allow_select" ON public.source_health FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "allow_select" ON public.ingestion_runs FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "allow_select" ON public.archival_log FOR SELECT TO authenticated, anon USING (true);
