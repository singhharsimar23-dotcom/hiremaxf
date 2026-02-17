import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { Guardrails } from "./shared/guardrails.ts"
import { JobPointer } from "./shared/types.ts"
import { GitHubWatcher } from "./github-api.ts"

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
        const { targets = ["openai/openai-python", "stripe/stripe-node", "vercel/next.js", "supabase/supabase", "anthropic-ai/anthropic-sdk-python"], debug = false } = await req.json().catch(() => ({}));

        console.log(`[GITHUB-WATCHER] Scanning targets: ${targets.join(", ")}`);

        // 2. Scan Repos
        const jobs = await GitHubWatcher.scan(targets, debug);
        console.log(`[GITHUB-WATCHER] Found ${jobs.length} intent signals.`);

        if (debug) {
            return new Response(JSON.stringify({
                success: true,
                debug_mode: true,
                jobs
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 3. Upsert Signals
        if (jobs.length > 0) {
            const { error } = await supabaseClient
                .from('job_pointers')
                .upsert(jobs, {
                    onConflict: 'fingerprint',
                    ignoreDuplicates: false
                });

            if (error) throw error;
        }

        return new Response(JSON.stringify({
            success: true,
            job_count: jobs.length,
            scanned_repos: targets
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        return Guardrails.handleError(supabaseClient, error, "GITHUB_WATCHER", { payload: "Scan Request" });
    }
})
