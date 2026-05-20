-- 20260213_multichannel_inference_update.sql
-- Function to retrieve structured embeddings and perform weighted scoring

CREATE OR REPLACE FUNCTION public.predict_match_score_structured(
    p_user_id UUID,
    p_company_name TEXT
) RETURNS JSONB AS $$
DECLARE
    u_struct VECTOR(64);
    u_coherence FLOAT;
    c_vec VECTOR(5); -- Company still uses 5-dim for this phase, or we can expand it
    -- Weights
    w JSONB;
    w_eng FLOAT; w_algo FLOAT; w_community FLOAT; 
    
    final_score FLOAT;
BEGIN
    SELECT value INTO w FROM public.ml_global_parameters WHERE key = 'channel_weights';
    w_eng := (w->>'w_eng')::FLOAT;
    w_algo := (w->>'w_algo')::FLOAT;
    -- etc...

    SELECT 
        embedding_structured, 
        channel_coherence_score 
    INTO u_struct, u_coherence
    FROM public.ml_candidate_embeddings 
    WHERE user_id = p_user_id;

    -- If no structured embedding, fallback to V2 logic (simple 5-dim)
    IF u_struct IS NULL THEN
        RETURN jsonb_build_object('score', public.predict_match_score_v2(p_user_id, p_company_name), 'mode', 'legacy');
    END IF;

    -- STRUCTURED SCORING LOGIC
    -- Here we would enact the full pairwise interaction between 64-dim user and Company requirements
    -- For MVP of this migration, we return the Coherence Score as a quality gate
    
    -- If Coherence is low, penalties apply
    -- Heuristic Score = Base * Coherence
    -- This requires the Company to also have a Structured Embedding to match against 
    -- (e.g. they need "Algo Skills" -> match against u_algo).
    
    RETURN jsonb_build_object(
        'score', 0.85 * u_coherence, 
        'mode', 'structured',
        'coherence', u_coherence
    );
END;
$$ LANGUAGE plpgsql STABLE;
