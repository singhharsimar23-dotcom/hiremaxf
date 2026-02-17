-- 20260213_fix_ingestion_rls.sql
-- URGENT FIX: Enable RLS and add policies for Ingestion & ML Tables which were defaulting to "Deny All"

-- 1. INGESTION COMMANDS
ALTER TABLE public.ingestion_commands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create their own commands"
ON public.ingestion_commands FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own commands"
ON public.ingestion_commands FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own commands"
ON public.ingestion_commands FOR UPDATE
USING (auth.uid() = user_id);

-- 2. RAW SNAPSHOTS (All variants)
ALTER TABLE public.raw_external_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert raw external snapshots"
ON public.raw_external_snapshots FOR INSERT
WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view raw external snapshots"
ON public.raw_external_snapshots FOR SELECT
USING (auth.uid() = user_id);

ALTER TABLE public.raw_linkedin_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert raw linkedin snapshots"
ON public.raw_linkedin_snapshots FOR INSERT
WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view raw linkedin snapshots"
ON public.raw_linkedin_snapshots FOR SELECT
USING (auth.uid() = user_id);

ALTER TABLE public.raw_github_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert raw github snapshots"
ON public.raw_github_snapshots FOR INSERT
WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view raw github snapshots"
ON public.raw_github_snapshots FOR SELECT
USING (auth.uid() = user_id);

-- 3. EVIDENCE LEDGER
ALTER TABLE public.evidence_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert evidence"
ON public.evidence_ledger FOR INSERT
WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view evidence"
ON public.evidence_ledger FOR SELECT
USING (auth.uid() = user_id);

-- 4. INTEGRITY EVENTS
ALTER TABLE public.integrity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert integrity events"
ON public.integrity_events FOR INSERT
WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view integrity events"
ON public.integrity_events FOR SELECT
USING (auth.uid() = user_id);

-- 5. PROFILE SNAPSHOTS
ALTER TABLE public.profile_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own snapshots"
ON public.profile_snapshots FOR SELECT
USING (auth.uid() = user_id);

-- 6. ML TABLES (Autonomous Intelligence)
ALTER TABLE public.ml_skill_graph ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own skill graph"
ON public.ml_skill_graph FOR SELECT
USING (auth.uid() = candidate_id);
-- Allow system/functions to update via SECURITY DEFINER, or if client needs direct write:
CREATE POLICY "Users can update their own skill graph"
ON public.ml_skill_graph FOR UPDATE
USING (auth.uid() = candidate_id);

ALTER TABLE public.ml_credibility_vector ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own credibility"
ON public.ml_credibility_vector FOR SELECT
USING (auth.uid() = candidate_id);

ALTER TABLE public.ml_talent_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own talent state"
ON public.ml_talent_state FOR SELECT
USING (auth.uid() = candidate_id);

-- 7. SIMULATION RESULTS
ALTER TABLE public.ml_simulation_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own simulation results"
ON public.ml_simulation_results FOR SELECT
USING (auth.uid() = candidate_id);
