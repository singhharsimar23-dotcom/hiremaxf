-- ENFORCE SERVICE ROLE AUTHORITY
-- Objective: Zero-Ambiguity Permissions for Worker Updates

BEGIN;

-- 1. RE-VERIFY LOCKDOWN (The "Iron Gate")
REVOKE INSERT, UPDATE, DELETE ON public.ingestion_commands FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.evidence_ledger FROM authenticated;

-- 2. EXPLICIT GRANT TO SERVICE ROLE
-- While service_role usually bypasses RLS, we grant explicit table privileges
-- to ensure no "ACL" errors occur at the Postgres level.
GRANT ALL ON public.ingestion_commands TO service_role;
GRANT ALL ON public.evidence_ledger TO service_role;
GRANT ALL ON public.integrity_events TO service_role;
GRANT ALL ON public.raw_external_snapshots TO service_role;
GRANT ALL ON public.raw_linkedin_snapshots TO service_role;
GRANT ALL ON public.profile_snapshots TO service_role;

-- 3. ENSURE POSTGREST DOESN'T EXPOSE MUTATIONS TO ANON
REVOKE INSERT, UPDATE, DELETE ON public.ingestion_commands FROM anon;

COMMIT;
