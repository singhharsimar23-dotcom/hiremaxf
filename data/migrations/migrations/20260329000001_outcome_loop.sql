-- Phase 1: Storage Layer for Bayesian Outcome Learning (Outcome Loop)
-- Sets up the Resume Variants table and Real-Time "Tactical" webhooks.

-- 1. Create resume_variants
CREATE TABLE IF NOT EXISTS public.resume_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_pointer_id UUID NOT NULL REFERENCES public.job_pointers(id) ON DELETE CASCADE,
    pipeline_run_id UUID,
    
    -- Inputs
    original_jd_snapshot TEXT NOT NULL,
    base_evidence_snapshot JSONB NOT NULL,
    
    -- AI Generated Outputs
    generated_resume_content TEXT NOT NULL,
    formatting_style TEXT NOT NULL,    -- e.g., 'IMPACT_FIRST', 'SKILL_HEAVY', 'EXEC_SUMMARY'
    keyword_density_score FLOAT,
    
    -- Outcomes (Bayesian Input)
    application_id UUID, -- Setup FK later
    outcome TEXT DEFAULT 'PENDING' CHECK (outcome IN ('PENDING', 'INTERVIEW', 'DENIED', 'GHOSTED', 'OFFER', 'REJECTED')),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for learning
CREATE INDEX IF NOT EXISTS idx_resume_variants_outcome ON public.resume_variants(outcome);
CREATE INDEX IF NOT EXISTS idx_resume_variants_job ON public.resume_variants(job_pointer_id);
CREATE INDEX IF NOT EXISTS idx_resume_variants_user ON public.resume_variants(user_id);

-- Add support on Applications table
ALTER TABLE public.applications 
ADD COLUMN IF NOT EXISTS resume_variant_id UUID REFERENCES public.resume_variants(id) ON DELETE SET NULL;

-- 2. Tactical Webhook Trigger: Event-Driven Fast Layer
-- This pg_net trigger instantly notifies the bayesian-outcome-learner when an outcome changes to an INTERVIEW or OFFER.

CREATE OR REPLACE FUNCTION public.trigger_tactical_outcome_learning()
RETURNS TRIGGER AS $$
DECLARE
    v_target_url TEXT;
    v_secret TEXT;
    v_net_request_id BIGINT;
BEGIN
    -- Only trigger tactically if transitioning to a strong positive signal (Interview / Offer)
    IF NEW.status IN ('interviewing', 'offer', 'callback', 'phone_screen') 
       AND (OLD.status IS NULL OR OLD.status NOT IN ('interviewing', 'offer', 'callback', 'phone_screen')) THEN
       
       -- Get the internal dynamic secret (Blue Ocean Strategy)
       SELECT value->>'jwt_secret' INTO v_secret 
       FROM public.system_settings 
       WHERE key = 'edge_functions';
       
       -- Get Project API URL
       SELECT value->>'api_url' INTO v_target_url 
       FROM public.system_settings 
       WHERE key = 'host_config';

       IF v_secret IS NOT NULL AND v_target_url IS NOT NULL THEN
           -- Fire and forget async request to bayesian-outcome-learner (Tactical Mode)
           SELECT net.http_post(
               url := v_target_url || '/functions/v1/bayesian-outcome-learner',
               headers := ('{"Content-Type": "application/json", "Authorization": "Bearer ' || v_secret || '"}')::JSONB,
               body := jsonb_build_object(
                   'mode', 'TACTICAL',
                   'application_id', NEW.id,
                   'resume_variant_id', NEW.resume_variant_id,
                   'ats_provider', NEW.ats_provider,
                   'job_id', NEW.job_id,
                   'outcome', NEW.status
               )
           ) INTO v_net_request_id;
       END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind Trigger
DROP TRIGGER IF EXISTS tactical_outcome_webhook ON public.applications;
CREATE TRIGGER tactical_outcome_webhook
AFTER UPDATE OF status ON public.applications
FOR EACH ROW
EXECUTE FUNCTION public.trigger_tactical_outcome_learning();
