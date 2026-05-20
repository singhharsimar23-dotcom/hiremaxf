-- ─────────────────────────────────────────────────────────────
-- PIPELINE HARDENING: SWEEP 5 FINAL FIXES
-- ─────────────────────────────────────────────────────────────

-- 1. FIX: Missing Foreign Key for Embedding Worker
-- Why: job-embedding-worker fails on PostgREST join without this explicit constraint.
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'canonical_jobs_raw_document_id_fkey'
    ) THEN
        ALTER TABLE public.canonical_jobs
        ADD CONSTRAINT canonical_jobs_raw_document_id_fkey 
        FOREIGN KEY (raw_document_id) 
        REFERENCES public.raw_job_documents(id);
    END IF;
END $$;

-- 2. FIX: RLS for job_embeddings (Service Role access)
-- Why: Table was defaulting to deny all, potentially blocking worker writes.
ALTER TABLE public.job_embeddings ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_job_embeddings'
    ) THEN
        CREATE POLICY "service_role_all_job_embeddings" 
        ON public.job_embeddings 
        FOR ALL 
        TO service_role 
        USING (true) 
        WITH CHECK (true);
    END IF;
END $$;

-- 3. OPTIMIZATION: Cron Consolidation
-- Why: Prevent redundant, overlapping executions that spike CPU and hit Gemini quotas.

-- A) Unschedule redundant/no-op jobs
SELECT cron.unschedule('parser_worker_evens');
SELECT cron.unschedule('embedding_worker_odds');
SELECT cron.unschedule('parser-worker-pulse-b');
SELECT cron.unschedule('embedding-worker-pulse-b');

-- B) Standardize Parser Pulse
-- Note: 'parser-worker-pulse-a' is already on '* * * * *'. We'll keep it as the primary.
-- We ensure the command is clean.
UPDATE cron.job 
SET command = 'SELECT public.trigger_parser_worker();' 
WHERE jobname = 'parser-worker-pulse-a';

-- C) Standardize Embedding Pulse
-- Ensure 'embedding-worker-pulse-a' is the primary.
UPDATE cron.job 
SET command = 'SELECT public.trigger_embedding_worker();' 
WHERE jobname = 'embedding-worker-pulse-a';

-- D) High-Frequency Snapshot Refresh (Aligned with Janitor)
-- Stagger snapshot refresh to run at :30 seconds if possible, or just keep it 1min.
-- We'll keep it 1min but ensure it doesn't collide with the Janitor's main logic.
UPDATE cron.job 
SET schedule = '* * * * *' 
WHERE jobname = 'refresh-system-health-snapshot';

-- 4. FIX: Grant Permissions for Joins
-- Why: join raw_job_documents!canonical_jobs_raw_document_id_fkey requires service_role to have SELECT on both.
GRANT SELECT ON public.raw_job_documents TO service_role;
GRANT SELECT ON public.canonical_jobs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_embeddings TO service_role;

-- 5. FINAL: System Maintenance Signal
INSERT INTO public.pipeline_failures (stage, severity, worker_name, error_code, metadata)
VALUES ('MAINTENANCE', 'INFO', 'migration_v5', 'SCHEMA_HARDENED', '{"action": "applied_fk_and_cron_dedup"}');
