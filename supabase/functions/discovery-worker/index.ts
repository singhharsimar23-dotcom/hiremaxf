import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { StorageManager } from "../_shared/storage-manager.ts"
import { GreenhouseConnector, LeverConnector } from "../_shared/connectors.ts"
import { LocationNormalizer } from "../_shared/location-normalizer.ts"
import { Guardrails } from "../_shared/guardrails.ts"
import { DiscoveryEvent } from "../_shared/types.ts"

const corsHeaders = Guardrails.getCorsHeaders();

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        Guardrails.checkEnv();
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }

    const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    if (Deno.env.get('ENGINE_GLOBAL_DISABLE') === 'true') {
        return new Response(JSON.stringify({ error: "SYSTEM_DISABLED" }), { status: 503, headers: corsHeaders });
    }

    const storage = new StorageManager(supabaseClient);
    const startTime = Date.now();

    try {
        if (req.headers.get('x-internal-scheduler') !== 'true') {
            throw new Error("FORBIDDEN: Internal Scheduler Only");
        }

        const body = await req.json();
        const { company_id } = body;
        if (!company_id) throw new Error("Missing company_id");

        const { data: governor, error: gError } = await supabaseClient.from('governor_state').select('current_mode').single();
        if (gError || !governor) throw new Error("GOVERNOR_READ_FAILED");

        if (governor.current_mode === 'READ_ONLY' || governor.current_mode === 'SAFE') {
            await logEvent(supabaseClient, company_id, governor.current_mode, false, false, 0, `GOVERNOR_INHIBIT_${governor.current_mode}`, startTime);
            return new Response(JSON.stringify({ success: false, reason: `SYSTEM_GOVERNOR_${governor.current_mode}` }), { headers: corsHeaders, status: 200 });
        }

        const { data: company, error: cError } = await supabaseClient.from('companies').select('*').eq('id', company_id).single();
        if (cError || !company) throw new Error("COMPANY_NOT_FOUND");

        let discoveredJobs: any[] = [];
        if (company.greenhouse_token) {
            discoveredJobs = await GreenhouseConnector.fetch(company_id, company.greenhouse_token);
        } else if (company.lever_token) {
            discoveredJobs = await LeverConnector.fetch(company_id, company.lever_token);
        }

        let createdCount = 0;
        for (const job of discoveredJobs) {
            const normalizedLoc = LocationNormalizer.normalize(job.location_type);
            if (LocationNormalizer.isAccepted(normalizedLoc)) {
                job.location_type = normalizedLoc;
                await storage.upsertJobPointer(job);
                createdCount++;
            }
        }

        const discoveryDay = new Date().toISOString().split('T')[0];
        const isTrueSuccess = createdCount > 0;

        const eventData: DiscoveryEvent = {
            company_id,
            governor_mode: governor.current_mode,
            attempted: true,
            success: isTrueSuccess,
            pointers_created: createdCount,
            failure_reason: isTrueSuccess ? null : 'ZERO_POINTERS_DISCOVERED',
            discovery_day: discoveryDay,
            latency_ms: Date.now() - startTime
        };

        const { error: dbRateError } = await supabaseClient.from('discovery_events').insert(eventData);

        if (dbRateError && dbRateError.code === '23505') {
            return new Response(JSON.stringify({ status: 'SKIPPED', reason: 'RATE_LIMIT_24H' }), { headers: corsHeaders, status: 200 });
        }

        return new Response(JSON.stringify({ success: isTrueSuccess, jobs_discovered: createdCount }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: isTrueSuccess ? 200 : 422,
        });

    } catch (error: any) {
        return Guardrails.handleError(supabaseClient, error, "DISCOVERY_WORKER", { company_id: (req as any).company_id });
    }
})

async function logEvent(supabase: any, companyId: string | null, mode: string, attempted: boolean, success: boolean, count: number, reason: string | null, startTime: number) {
    const discoveryDay = new Date().toISOString().split('T')[0];
    await supabase.from('discovery_events').insert({
        company_id: companyId,
        governor_mode: mode,
        attempted,
        success,
        pointers_created: count,
        failure_reason: reason,
        discovery_day: discoveryDay,
        latency_ms: Date.now() - startTime
    });
}
