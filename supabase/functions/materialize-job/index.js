import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Guardrails } from "../_shared/guardrails.ts";
const corsHeaders = Guardrails.getCorsHeaders();
serve(async (req) => {
    if (req.method === 'OPTIONS')
        return new Response('ok', { headers: corsHeaders });
    try {
        Guardrails.checkEnv();
    }
    catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    if (Deno.env.get('ENGINE_GLOBAL_DISABLE') === 'true') {
        return new Response(JSON.stringify({ error: "SYSTEM_DISABLED" }), { status: 503, headers: corsHeaders });
    }
    let body = {};
    try {
        body = await req.json();
        const { job_id } = body;
        if (!job_id)
            throw new Error("Missing job_id");
        const { data: governor, error: gError } = await supabaseClient.from('governor_state').select('current_mode').single();
        if (gError || !governor)
            throw new Error("GOVERNOR_READ_FAILED");
        if (governor.current_mode === 'READ_ONLY' || governor.current_mode === 'SAFE') {
            throw new Error(`SYSTEM_GOVERNOR_BLOCK: Materialization forbidden in ${governor.current_mode} mode`);
        }
        const { data: pointer, error: pError } = await supabaseClient.from('job_pointers').select('*').eq('id', job_id).single();
        if (pError || !pointer)
            throw new Error(`POINTER_NOT_FOUND: ${job_id}`);
        // --- FETCH COMPANY INFO ---
        let company = null;
        if (pointer.company_id) {
            const { data: cData } = await supabaseClient.from('companies').select('*').eq('id', pointer.company_id).single();
            company = cData;
        }
        // --- MEGA SCRAPER / UNIVERSAL PATH ---
        // If it's a scraped job without linked company entity, OR if we don't have a specialized scraper for this source
        if (pointer.discovery_method === 'MEGA_SCRAPER' || !company || (pointer.source_type !== 'GREENHOUSE' && pointer.source_type !== 'LEVER')) {
            return new Response(JSON.stringify({
                success: true,
                full_description: pointer.full_text_search_vector || `EXTERNAL OPPORTUNITY CONFIRMED\n\nCompany: ${pointer.company_name || 'Unknown'}\nRole: ${pointer.title || 'Unknown'}\nSource: ${pointer.source_type}\n\n(Full deep-dive analysis will occur in Execution Phase)`,
                verified_source_url: pointer.source_url
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }
        if (!company)
            throw new Error("COMPANY_DATA_MISSING");
        let fullData = {};
        const url = pointer.source_url;
        let rawBody = "";
        if (pointer.source_type === 'GREENHOUSE') {
            const token = company.greenhouse_token;
            if (!token)
                throw new Error("PARTNER_TOKEN_MISSING: GREENHOUSE");
            const parts = url.split('/');
            const apiId = parts[parts.length - 1];
            const apiResp = await fetch(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs/${apiId}`);
            rawBody = await apiResp.text();
            fullData = JSON.parse(rawBody);
        }
        else if (pointer.source_type === 'LEVER') {
            const token = company.lever_token;
            if (!token)
                throw new Error("PARTNER_TOKEN_MISSING: LEVER");
            const parts = url.split('/');
            const apiId = parts[parts.length - 1];
            const apiResp = await fetch(`https://api.lever.co/v0/postings/${token}/${apiId}`);
            rawBody = await apiResp.text();
            fullData = JSON.parse(rawBody);
        }
        const title = (fullData.title || fullData.text || "").toLowerCase();
        const description = (fullData.content || fullData.description || "");
        const rejectedPatterns = ["talent pool", "general application", "future roles", "talent network"];
        if (rejectedPatterns.some((p) => title.includes(p)) || description.length < 200) {
            await supabaseClient.from('integrity_events').insert({
                event_type: 'SEMANTIC_REJECT',
                severity: 'WARNING',
                message: `Job ${job_id} rejected: ${title}`
            });
            return new Response(JSON.stringify({ success: false, reason: "SEMANTIC_REJECTION" }), { status: 422, headers: corsHeaders });
        }
        const closureIndicators = ["no longer accepting", "position has been filled", "applications closed"];
        if (closureIndicators.some((i) => rawBody.toLowerCase().includes(i))) {
            await supabaseClient.from('job_pointers').update({ validation_status: 'STALE', expires_at: new Date().toISOString() }).eq('id', job_id);
            await supabaseClient.from('integrity_events').insert({
                event_type: 'ZOMBIE_POINTER_EXPIRED',
                severity: 'INFO',
                message: `Expired zombie pointer ${job_id}`
            });
            return new Response(JSON.stringify({ success: false, reason: "JOB_CLOSED" }), { status: 410, headers: corsHeaders });
        }
        return new Response(JSON.stringify({
            success: true,
            full_description: description,
            verified_source_url: url
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }
    catch (error) {
        const job_id_fallback = body?.job_id;
        return Guardrails.handleError(supabaseClient, error, "MATERIALIZE_JOB", { job_id: job_id_fallback });
    }
});
