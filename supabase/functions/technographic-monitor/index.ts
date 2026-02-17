
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { Guardrails } from "./shared/guardrails.ts"
import { JobPointer } from "./shared/types.ts"
import { CrtShService } from "./crt-sh.ts"


const corsHeaders = Guardrails.getCorsHeaders()

serve(async (req: Request) => {
    // strict CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    try {
        // 1. Parse Request
        const { domains = ["openai.com", "anthropic.com", "stripe.com", "vercel.com", "supabase.com", "figma.com"], debug = false } = await req.json().catch(() => ({}));

        console.log(`[TECHNOGRAPHIC-MONITOR] Scanning domains: ${domains.join(", ")}`);

        // 2. Scan Domains
        const pointers = await CrtShService.checkDomains(domains, debug);

        console.log(`[TECHNOGRAPHIC-MONITOR] Found ${pointers.length} career subdomains.`);

        if (debug) {
            return new Response(JSON.stringify({
                success: true,
                debug_mode: true,
                pointers
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 3. Upsert Signals
        if (pointers.length > 0) {
            const { error } = await supabaseClient
                .from('job_pointers')
                .upsert(pointers, {
                    onConflict: 'fingerprint',
                    ignoreDuplicates: false
                });

            if (error) throw error;
        }

        return new Response(JSON.stringify({
            success: true,
            job_count: pointers.length,
            scanned_domains: domains
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        return Guardrails.handleError(supabaseClient, error, "TECHNOGRAPHIC_MONITOR", { payload: "Scan Request" });
    }
})
