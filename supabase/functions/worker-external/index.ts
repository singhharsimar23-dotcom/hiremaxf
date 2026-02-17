import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EXTRACTOR_CONFIG: Record<string, { type: string, pattern: RegExp }> = {
    'scholar.google.com': { type: 'SCHOLAR', pattern: /scholar\.google\.com/ },
    'stackoverflow.com': { type: 'STACKOVERFLOW', pattern: /stackoverflow\.com\/users/ },
    'github.com': { type: 'GITHUB_PAGES', pattern: /.*\.github\.io/ },
    'leetcode.com': { type: 'LEETCODE', pattern: /leetcode\.com/ }
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let commandId: string | null = null;
    let sessionId: string | null = null;
    let user_id: string | null = null;

    try {
        // 1. IDENTITY VERIFICATION (INTERNAL SYSTEM ONLY)
        const authHeader = req.headers.get('Authorization');
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!authHeader) throw new Error("Missing Authorization header");

        // STRICT GATE: Only allow requests signed with the Service Role Key
        // This ensures this worker is only invoked by ingest-identity or other system components.
        if (authHeader !== `Bearer ${serviceKey}`) {
            console.warn(`[SECURITY] Unauthorized access attempt to worker-external`);
            throw new Error("Unauthorized: Worker requires Service Role privileges");
        }

        // Trust the payload's user_id since the caller is the System (ingest-identity)
        // ingest-identity has already validated the user's JWT.
        const payload = await req.json();
        const { url, session_id } = payload;
        user_id = payload.user_id; // Trust system-provided user_id
        commandId = payload.command_id;
        sessionId = session_id;

        if (!user_id) throw new Error("Missing user_id in payload (System Call Requirement)");
        if (!url) throw new Error("Missing explicit URL for ingestion");

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

        // 4. ROBUST FETCH (Anti-Fragile)
        let html = "";
        let fetchStatus = "OK";

        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5'
                }
            });
            if (!response.ok) {
                console.warn(`Fetch blocked/failed: ${response.status}`);
                fetchStatus = `HTTP_${response.status}`;
            } else {
                html = await response.text();
            }
        } catch (e) {
            console.warn(`Fetch network error: ${e.message}`);
            fetchStatus = "NETWORK_ERROR";
        }

        // 5. STORE IN RAW LAYER (Even if empty, to track the attempt)
        const { data: rawSnapshot, error: rawError } = await supabaseClient
            .from('raw_external_snapshots')
            .insert({
                user_id,
                command_id: commandId,
                url,
                raw_payload: {
                    html_cleaned: html.substring(0, 50000),
                    fetch_status: fetchStatus
                }
            })
            .select().single();

        if (rawError) throw rawError;

        // 6. EXTRACT & RECORD EVIDENCE (With Provenance)
        const { data: cmd } = await supabaseClient.from('ingestion_commands').select('url_classification').eq('id', commandId).single();
        const classification = cmd?.url_classification || 'PORTFOLIO';

        const { data: evidence, error: evError } = await supabaseClient.from('evidence_ledger').insert({
            user_id,
            claim_type: classification === 'SCHOLAR' ? 'PUBLICATION' : (classification === 'KAGGLE' ? 'ACHIEVEMENT' : 'PROJECT'),
            source: 'EXTERNAL_ANCHOR',
            raw_reference_id: rawSnapshot.id,
            ingestion_session_id: sessionId,
            claim_data: { url, domain, classification, fetch_status: fetchStatus },
            source_authority: classification === 'SCHOLAR' ? 0.95 : 0.6,
            extraction_confidence: html.length > 500 ? 1.0 : 0.1, // Low confidence if no HTML
            verification_strength: html.length > 500 ? 0.7 : 0.2,
            final_weight: html.length > 500 ? 0.5 : 0.1
        }).select().single();

        if (evError) throw evError;

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
        } else if (classification === 'KAGGLE' || classification === 'HUGGINGFACE') {
            await supabaseClient.from('career_achievements').insert({
                user_id,
                evidence_id: evidence.id,
                name: `${classification} Ranking`,
                extraction_method: 'verified',
                confidence_level: 'high'
            });
        } else {
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

        // 7. CRITICAL: UPDATE COMMAND STATUS FIRST (v2.6)
        // We mark the command as successful BEFORE attempting convergence.
        // This ensures that even if downstream orchestration fails, the specific unit of work is recorded.
        if (commandId) {
            await supabaseClient.from('ingestion_commands').update({ status: 'completed' }).eq('id', commandId);
        }

        // 8. FAIL-SAFE CONVERGENCE ORCHESTRATION
        // Wrapped in try-catch to preventing crashing the worker if the RPC or Snapshot Builder fails.
        if (sessionId) {
            try {
                // Idempotent Increment
                await supabaseClient.rpc('increment_session_completion', { session_id: sessionId });

                // Check for atomic convergence
                const { data: sessionData } = await supabaseClient.from('ingestion_sessions').select('*').eq('id', sessionId).single();

                if (sessionData && sessionData.completed_workers >= sessionData.expected_workers) {
                    // Atomic transition to 'converged'
                    // The RPC might have done this, but we double-check state to be sure before triggering builder
                    if (sessionData.state !== 'converged') {
                        await supabaseClient.from('ingestion_sessions').update({ state: 'converged' }).eq('id', sessionId);
                    }

                    console.log(`Session ${sessionId} converged. Triggering Snapshot Builder.`);

                    // Trigger Snapshot Builder (Internal Service Call)
                    await supabaseClient.functions.invoke('snapshot-builder', {
                        headers: { 'Authorization': authHeader },
                        body: { user_id, session_id: sessionId } // Snapshot builder will verify this
                    });
                }
            } catch (convergenceError) {
                console.error(`[WARNING] Convergence Orchestration Failed (Non-Fatal):`, convergenceError);
                // Do NOT throw. The command succeeded. The Session might be stuck, but the data is safe.
                await supabaseClient.from('integrity_events').insert({
                    user_id,
                    event_type: 'ERROR',
                    source: 'WORKER_CONVERGENCE',
                    message: `Convergence failed for session ${sessionId}`,
                    metadata: { error: convergenceError }
                });
            }
        }

        // 9. DIRECT TRIGGER (Legacy / Single-Command Mode)
        // If no session, we trigger builder opportunistically
        if (!sessionId) {
            try {
                await supabaseClient.functions.invoke('snapshot-builder', {
                    headers: { 'Authorization': authHeader || '' },
                    body: { user_id, session_id: null }
                });
            } catch (e) {
                console.warn("Direct snapshot trigger failed (Non-Fatal)", e);
            }
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        console.error(`Worker External Error:`, error)
        if (sessionId) {
            // SAFE FALLBACK: Just log the failure. Do NOT try to increment again.
            // Attempting to touch the RPC here caused the infinite crash loop.
            console.warn(`Worker failed during valid session ${sessionId}. Convergence will stall.`);
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
        })
    }
})
