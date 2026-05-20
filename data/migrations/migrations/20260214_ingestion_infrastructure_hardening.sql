-- INGESTION INFRASTRUCTURE HARDENING MIGRATION
-- Objective: Enforce "RPC-Only" writes and remove Security Theater

BEGIN;

-- 1. REVOKE DIRECT PERMISSIONS (The "Hard" Gate)
-- Prevents any client-side code from writing to these tables, even if RLS allowed it.
REVOKE INSERT, UPDATE, DELETE ON public.ingestion_commands FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.evidence_ledger FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.integrity_events FROM authenticated;

-- Allow SELECT for user visibility (Dashboard/Profile) relies on this
GRANT SELECT ON public.ingestion_commands TO authenticated;
GRANT SELECT ON public.evidence_ledger TO authenticated;
GRANT SELECT ON public.integrity_events TO authenticated;

-- 2. RLS POLICY CLEANUP (Removing "Security Theater")
-- A. Ingestion Commands
DROP POLICY IF EXISTS "user_insert_own" ON "public"."ingestion_commands";
DROP POLICY IF EXISTS "user_update_own" ON "public"."ingestion_commands"; 
-- Keep "user_select_own" for visibility

-- B. Evidence Ledger
DROP POLICY IF EXISTS "user_insert_own_evidence" ON "public"."evidence_ledger";
DROP POLICY IF EXISTS "Service can insert evidence" ON "public"."evidence_ledger"; -- Service Role bypasses RLS, detailed policy not needed
-- Keep "Users can view own evidence"

-- C. Integrity Events
DROP POLICY IF EXISTS "user_insert_own_integrity" ON "public"."integrity_events";
DROP POLICY IF EXISTS "Service can insert events" ON "public"."integrity_events";
-- Keep "Users can view own events"

-- D. Profile Snapshots
DROP POLICY IF EXISTS "Service can update snapshots" ON "public"."profile_snapshots";
DROP POLICY IF EXISTS "Service can insert snapshots" ON "public"."profile_snapshots";

-- 3. ENSURE RPC SECURITY
-- Confirm RPC is Security Definer (runs as Owner/Service Role)
ALTER FUNCTION "public"."create_ingestion_command" SECURITY DEFINER;

COMMIT;
