-- Launch security: lock down admin scoring tables (client writes blocked)
ALTER TABLE public.scoring_weights_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoring_weight_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scoring_defs_select_authenticated" ON public.scoring_weights_definitions;
CREATE POLICY "scoring_defs_select_authenticated"
  ON public.scoring_weights_definitions
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "scoring_sets_select_authenticated" ON public.scoring_weight_sets;
CREATE POLICY "scoring_sets_select_authenticated"
  ON public.scoring_weight_sets
  FOR SELECT TO authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE policies for authenticated → only service_role can mutate
