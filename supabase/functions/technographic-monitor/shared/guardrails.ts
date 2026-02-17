import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

export class Guardrails {
    /**
     * Verifies that mandatory Supabase environment variables are set.
     * Blows up early if secrets are missing.
     */
    static checkEnv() {
        const url = Deno.env.get('SUPABASE_URL');
        const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (!url || !key) {
            throw new Error("CRITICAL_ENV_MISSING: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not defined.");
        }
    }

    /**
     * Standardized error response and telemetry logging.
     */
    static async handleError(supabase: SupabaseClient, error: Error, context: string, payload: any = {}) {
        const requestId = crypto.randomUUID();
        console.error(`[${context}] [${requestId}]:`, error.message);

        try {
            await supabase.from('integrity_events').insert({
                event_type: 'RUNTIME_ERROR',
                severity: 'ERROR',
                message: `[${context}] ${error.message}`,
                payload: { ...payload, request_id: requestId, stack: error.stack }
            });
        } catch (logLimitError) {
            console.error("FAILED_TO_LOG_INTEGRITY_EVENT", logLimitError);
        }

        return new Response(JSON.stringify({
            success: false,
            error: error.message,
            request_id: requestId,
            code: (error as any).code || 'INTERNAL_ERROR'
        }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }

    static getCorsHeaders() {
        return {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-scheduler',
        };
    }
}
