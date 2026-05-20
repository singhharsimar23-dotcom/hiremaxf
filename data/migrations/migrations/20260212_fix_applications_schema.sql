-- Fix Schema Mismatches for Execution Engine
-- Author: Antigravity
-- Reason: execution-engine requires 'match_score' to store analysis results.

DO $$ 
BEGIN 
    -- 1. Add 'match_score' if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'applications' AND column_name = 'match_score') THEN 
        ALTER TABLE public.applications ADD COLUMN match_score FLOAT DEFAULT 0.0; 
    END IF;

    -- 2. Ensure 'job_pointer_id' exists (It should, but safety first)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'applications' AND column_name = 'job_pointer_id') THEN 
        ALTER TABLE public.applications ADD COLUMN job_pointer_id UUID REFERENCES public.job_pointers(id);
    END IF;

    -- 3. Add 'source_url' (Missing column causing 400 error)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'applications' AND column_name = 'source_url') THEN 
        ALTER TABLE public.applications ADD COLUMN source_url TEXT;
    END IF;

    -- 4. Add 'analysis_refs' for linking detailed breakdowns if needed later
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'applications' AND column_name = 'analysis_refs') THEN 
        ALTER TABLE public.applications ADD COLUMN analysis_refs JSONB DEFAULT '{}';
    END IF;
END $$;
