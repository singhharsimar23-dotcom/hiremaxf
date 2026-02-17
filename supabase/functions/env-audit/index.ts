import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req: Request) => {
    const vars = [
        'USAJOBS_API_KEY',
        'ADZUNA_APP_ID',
        'ADZUNA_APP_KEY',
        'REED_API_KEY',
        'REMOTIVE_API_KEY', // If applicable
        'ARBEITNOW_API_KEY' // If applicable
    ];

    const audit = vars.map(key => {
        const val = Deno.env.get(key);
        return {
            key,
            exists: !!val,
            non_empty: !!val && val.length > 0,
            masked: val ? `${val.substring(0, 4)}...` : null
        };
    });

    return new Response(JSON.stringify({ audit }), {
        headers: { 'Content-Type': 'application/json' }
    });
});
