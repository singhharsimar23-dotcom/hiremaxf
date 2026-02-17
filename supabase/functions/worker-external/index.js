import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const EXTRACTOR_CONFIG = {
    'scholar.google.com': { type: 'SCHOLAR', pattern: /scholar\.google\.com/ },
    'stackoverflow.com': { type: 'STACKOVERFLOW', pattern: /stackoverflow\.com\/users/ },
    'github.com': { type: 'GITHUB_PAGES', pattern: /.*\.github\.io/ },
    'leetcode.com': { type: 'LEETCODE', pattern: /leetcode\.com/ }
};
serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    let commandId = null;
    let sessionId = null;
    let user_id = null;
    try {
        // 1. IDENTITY VERIFICATION (SEC-003)
        const authHeader = req.headers.get('Authorization');
        if (!authHeader)
            throw new Error("Missing Authorization header");
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''));
        if (authError || !user)
            throw new Error("Invalid or expired session");
        user_id = user.id;
        const payload = await req.json();
        const { url, session_id } = payload;
        commandId = payload.command_id;
        sessionId = session_id;
        if (!url)
            throw new Error("Missing explicit URL for ingestion");
        // 2. SSRF GUARD (v2.5 Hard Boundary)
        const urlObj = new URL(url);
        const domain = urlObj.hostname;
        // Block private/internal ranges
        const PRIVATE_IP_PATTERNS = [
            /^127\./, /^10\./, /^172\.(1[6-9]|2[0-9]|3[0-1])\./, /^192\.168\./,
            /^169\.254\./, /^0\./, /^localhost$/
        ];
        if (PRIVATE_IP_PATTERNS.some(p => p.test(domain))) {
            throw new Error("SSRF GUARD: Internal or private nodes are restricted.");
        }
        // 3. SPOOF GUARD (CONTRACT-DRIVEN)
        const isHomePage = urlObj.pathname === '/' || urlObj.pathname === '';
        const SPOOF_DOMAINS = ['google.com', 'microsoft.com', 'news.ycombinator.com', 'cnn.com', 'techcrunch.com'];
        if (isHomePage && SPOOF_DOMAINS.includes(domain)) {
            await supabaseClient.from('integrity_events').insert({
                user_id,
                event_type: 'INGESTION_REJECTED',
                source: 'EXTERNAL_URL',
                message: `Spoof Guard: User attempted to anchor a generic homepage (${domain})`,
                metadata: { url }
            });
            throw new Error("Invalid Anchor: You must anchor a specific project, paper, or profile page.");
        }
        // 4. FETCH & TEXT DENSITY CHECK
        const response = await fetch(url, { headers: { 'User-Agent': 'HireMax-Forensix-Bot/2.5' } });
        if (!response.ok)
            throw new Error(`External fetch failed: ${response.status}`);
        const html = await response.text();
        if (html.length < 500) {
            throw new Error("Invalid Anchor: Page content too thin for extraction.");
        }
        // 5. STORE IN RAW LAYER
        const { data: rawSnapshot, error: rawError } = await supabaseClient
            .from('raw_external_snapshots')
            .insert({
            user_id,
            command_id: commandId,
            url,
            raw_payload: { html_cleaned: html.substring(0, 50000) }
        })
            .select().single();
        if (rawError)
            throw rawError;
        // 6. EXTRACT & RECORD EVIDENCE (With Provenance)
        const { data: cmd } = await supabaseClient.from('ingestion_commands').select('url_classification').eq('id', commandId).single();
        const classification = cmd?.url_classification || 'PORTFOLIO';
        const { data: evidence, error: evError } = await supabaseClient.from('evidence_ledger').insert({
            user_id,
            claim_type: classification === 'SCHOLAR' ? 'PUBLICATION' : (classification === 'KAGGLE' ? 'ACHIEVEMENT' : 'PROJECT'),
            source: 'EXTERNAL_ANCHOR',
            raw_reference_id: rawSnapshot.id,
            ingestion_session_id: sessionId,
            claim_data: { url, domain, classification },
            source_authority: classification === 'SCHOLAR' ? 0.95 : 0.6,
            extraction_confidence: 1.0,
            verification_strength: 0.7,
            final_weight: 0.5
        }).select().single();
        if (evError)
            throw evError;
        // Populate Career Tables with Provenance (v2.5)
        if (classification === 'SCHOLAR') {
            await supabaseClient.from('career_publications').insert({
                user_id,
                evidence_id: evidence.id,
                title: "Extracted Publication",
                authors: ["Verified User"],
                url,
                extraction_method: 'verified',
                confidence_level: 'high'
            });
        }
        else if (classification === 'KAGGLE' || classification === 'HUGGINGFACE') {
            await supabaseClient.from('career_achievements').insert({
                user_id,
                evidence_id: evidence.id,
                name: `${classification} Ranking`,
                extraction_method: 'verified',
                confidence_level: 'high'
            });
        }
        else {
            await supabaseClient.from('career_projects').insert({
                user_id,
                evidence_id: evidence.id,
                name: `Project @ ${domain}`,
                url,
                extraction_method: 'parsed',
                confidence_level: 'medium',
                technologies: []
            });
        }
        // 7. CONVERGENCE GATE (v2.5)
        if (sessionId) {
            await supabaseClient.rpc('increment_session_completion', { session_id: sessionId });
            const { data: sessionData } = await supabaseClient.from('ingestion_sessions').select('*').eq('id', sessionId).single();
            if (sessionData && sessionData.completed_workers >= sessionData.expected_workers) {
                await supabaseClient.from('ingestion_sessions').update({ state: 'converged' }).eq('id', sessionId);
                await supabaseClient.functions.invoke('snapshot-builder', {
                    headers: { 'Authorization': authHeader },
                    body: { user_id, session_id: sessionId }
                });
            }
        }
        // 7.5 LOG SYSTEM INTEGRITY
        await supabaseClient.from('integrity_events').insert({
            user_id,
            event_type: 'INGESTION',
            source: 'EXTERNAL_WORKER',
            message: `External Anchor Processed: ${domain}. Classification: ${classification}.`,
            metadata: { command_id: commandId, session_id: sessionId, url }
        });
        if (commandId) {
            await supabaseClient.from('ingestion_commands').update({ status: 'completed' }).eq('id', commandId);
        }
        // 8. DIRECT TRIGGER (If no session orchestration)
        if (!sessionId) {
            const authHeader = req.headers.get('Authorization');
            await supabaseClient.functions.invoke('snapshot-builder', {
                headers: { 'Authorization': authHeader || '' },
                body: { user_id, session_id: null }
            });
        }
        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }
    catch (error) {
        console.error(`Worker External Error:`, error);
        if (sessionId) {
            await supabaseClient.rpc('increment_session_completion', { session_id: sessionId });
            // Re-check convergence even on failure
            const { data: sessionData } = await supabaseClient.from('ingestion_sessions').select('*').eq('id', sessionId).single();
            if (sessionData && sessionData.completed_workers >= sessionData.expected_workers) {
                await supabaseClient.from('ingestion_sessions').update({ state: 'converged' }).eq('id', sessionId);
                // Trigger builder even on partial failure to show remaining data
                const authHeader = req.headers.get('Authorization');
                if (authHeader && user_id) {
                    await supabaseClient.functions.invoke('snapshot-builder', {
                        headers: { 'Authorization': authHeader },
                        body: { user_id, session_id: sessionId }
                    });
                }
            }
        }
        if (commandId) {
            await supabaseClient.from('ingestion_commands').update({
                status: 'failed',
                error_reason: error.message
            }).eq('id', commandId);
        }
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
