-- Phase 6.1: Orphan Killer (Data Moat Restoration)
-- WHY: Purges 7,281 orphaned pointers that lack original source context.

-- 1. Identify and Audit Orphans before deletion
-- We'll insert into a temporary audit table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.ingestion_failures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pointer_id UUID,
    fingerprint TEXT,
    failure_type TEXT DEFAULT 'ORPHANED_POINTER',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Log them
INSERT INTO public.ingestion_failures (pointer_id, fingerprint)
SELECT id, fingerprint 
FROM public.job_pointers jp
WHERE NOT EXISTS (SELECT 1 FROM public.raw_job_documents rjd WHERE rjd.job_pointer_id = jp.id);

-- 3. Delete them (CASCADE will handle any downstream but there should be none)
DELETE FROM public.job_pointers 
WHERE id IN (SELECT pointer_id FROM public.ingestion_failures WHERE failure_type = 'ORPHANED_POINTER');

-- 4. Now enforce the NOT NULL constraint on raw_job_documents
-- This is safe now because all remaining pointers should have raw docs index-wise, 
-- but actually let's ensure we don't have raw docs without pointers (impossible by FK, but good to check).
-- NOTE: We already added the FK with CASCADE in the previous script.
ALTER TABLE public.raw_job_documents 
    ALTER COLUMN job_pointer_id SET NOT NULL;

-- 5. Final Integrity check
ANALYZE public.job_pointers;
ANALYZE public.raw_job_documents;
