-- Create governor_state table for system-wide restriction logic
CREATE TABLE IF NOT EXISTS public.governor_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    current_mode TEXT NOT NULL CHECK (current_mode IN ('NORMAL', 'SAFE', 'READ_ONLY', 'DEGRADED')),
    last_updated_at TIMESTAMPTZ DEFAULT now(),
    reason TEXT
);

-- Seed initial state
INSERT INTO public.governor_state (current_mode, reason)
SELECT 'NORMAL', 'Initial system state'
WHERE NOT EXISTS (SELECT 1 FROM public.governor_state);

-- RLS
ALTER TABLE public.governor_state ENABLE ROW LEVEL SECURITY;
IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'governor_state' AND policyname = 'Service role can do everything'
) THEN
    CREATE POLICY "Service role can do everything" ON public.governor_state FOR ALL TO service_role USING (true);
END IF;

IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'governor_state' AND policyname = 'Authenticated users can read governor state'
) THEN
    CREATE POLICY "Authenticated users can read governor state" ON public.governor_state FOR SELECT TO authenticated USING (true);
END IF;
