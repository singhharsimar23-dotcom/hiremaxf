-- AUXILIARY HARDENING MIGRATION
-- Objective: Close write access to non-core ingestion tables to enforce Edge-Only writes.

BEGIN;

-- 1. HARDEN: ml_application_friction
-- Only ingest-friction-telemetry (Service Role) should write here.
REVOKE INSERT, UPDATE, DELETE ON public.ml_application_friction FROM authenticated;
-- Allow SELECT for dashboards (if needed)
GRANT SELECT ON public.ml_application_friction TO authenticated;

-- 2. HARDEN: raw_integrations_data
-- Only ingest-multichannel (Service Role) should write here.
REVOKE INSERT, UPDATE, DELETE ON public.raw_integrations_data FROM authenticated;
-- Allow SELECT for user debugging/viewing
GRANT SELECT ON public.raw_integrations_data TO authenticated;

COMMIT;
