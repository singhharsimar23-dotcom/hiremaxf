
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { Guardrails } from "../_shared/guardrails.ts"
import { LocationNormalizer } from "../_shared/location-normalizer.ts"

const corsHeaders = Guardrails.getCorsHeaders();

serve(async (req: Request) => {
    // 1. MANDATORY CORS HANDLER
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: {
                ...corsHeaders,
                'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            }
        });
    }

    const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 2. ROBUST PATH EXTRACTION (Fixes the undefined subPath bug)
    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    const v1Index = pathSegments.indexOf('v1');
    const routerIndex = pathSegments.indexOf('hiring-engine');
    const subPath = `/${pathSegments.slice(Math.max(v1Index, routerIndex) + 1).join('/')}`;

    console.log(`[HIRING-ENGINE] Handling ${req.method} ${subPath}`);

    try {
        // --- GOVERNOR GATE ---
        const { data: governor } = await supabaseClient.from('governor_state').select('current_mode').single();
        const isReadOnly = governor?.current_mode === 'READ_ONLY';

        // --- ENDPOINT: POST /intent/resolve ---
        if (subPath === '/intent/resolve' && req.method === 'POST') {
            const body = await req.json();
            const { role_normalized, seniority, location_raw } = body;

            const normalizedLoc = LocationNormalizer.normalize(location_raw);
            const isAccepted = LocationNormalizer.isAccepted(normalizedLoc);

            const result = {
                role_normalized,
                seniority,
                location_raw,
                location_bucket: isAccepted ? normalizedLoc : 'US-OTHER',
                location_confidence: isAccepted ? (normalizedLoc === 'US-OTHER' ? 0.7 : 1.0) : 0.5,
                confidence_flag: isAccepted ? (normalizedLoc === 'US-OTHER' ? 'LOW_CONFIDENCE' : 'OK') : 'FALLBACK',
                timestamp: new Date().toISOString(),
                intent_id: crypto.randomUUID()
            };

            return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // --- ENDPOINT: GET /user-clustering/resolve ---
        if (subPath === '/user-clustering/resolve' && req.method === 'GET') {
            const bucket = url.searchParams.get('location_bucket');
            const VALID_BUCKETS = ['US-WEST', 'US-EAST', 'US-CENTRAL', 'US-REMOTE', 'US-OTHER'];

            if (bucket && !VALID_BUCKETS.includes(bucket)) {
                return new Response(JSON.stringify({ error: "Invalid location bucket" }), { status: 400, headers: corsHeaders });
            }

            const { data, error } = await supabaseClient.from('user_clusters')
                .select('*')
                .eq('status', 'ACTIVE')
                .eq('location_bucket', bucket || 'US-OTHER')
                .maybeSingle();

            if (error) throw error;

            const result = {
                cluster_id: data ? data.id.toString() : 'default',
                location_bucket: bucket || (data ? data.location_bucket : 'US-OTHER'),
                cluster_bucket: bucket || (data ? data.location_bucket : 'US-OTHER'), // Alias to match frontend interface
                status: data ? 'ACTIVE' : 'FALLBACK'
            };

            console.log(`[HIRING-ENGINE] Resolved Cluster: ${result.cluster_id} (${result.location_bucket})`);
            return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // --- ENDPOINT: GET /job-pointers/by-cluster ---
        if (subPath === '/job-pointers/by-cluster' && req.method === 'GET') {
            const role = url.searchParams.get('role');
            const clusterId = url.searchParams.get('cluster_id');
            const locationBucket = url.searchParams.get('location');

            let query = supabaseClient.from('job_pointers')
                .select('id, company_id, company_name, location_name, title, role_category, seniority_band, location_type, source_url, source_type, validation_status, quality_score');

            // 1. ROLE FILTER (Inclusive matching)
            if (role) {
                const firstWord = role.split(' ')[0].toLowerCase();
                query = query.or(`role_category.ilike.%${role}%,title.ilike.%${role}%,role_category.ilike.%${firstWord}%`);
            }

            // 2. GEOFENCE GUARD (Priority: Location String Matching)
            // We removed the strict cluster_id filter because the clustering process hasn't fully propagated to all job pointers yet.
            // We fallback to robust string matching on location fields to ensure we return results.
            if (locationBucket && locationBucket !== 'US-OTHER') {
                if (locationBucket === 'US-REMOTE') {
                    query = query.or('location_type.ilike.%remote%,location_name.ilike.%remote%,source_url.ilike.%remote%');
                } else {
                    // Include null locations to prevent "0 results" on sparse data
                    const usPatterns = 'location_name.ilike.%USA%,location_name.ilike.%United States%,location_name.ilike.%US%,location_type.ilike.%USA%,location_type.ilike.%United States%,location_type.ilike.%CA%,location_type.ilike.%NY%,location_type.ilike.%TX%,location_type.ilike.%West%,location_type.ilike.%East%,location_type.ilike.%Central%,location_name.is.null';
                    query = query.or(usPatterns);
                }
            } else if (clusterId && clusterId !== 'default' && clusterId !== 'undefined') {
                // Only use cluster_id as a fallback filter if no location bucket is provided (rare)
                // matching logic: cluster_ids contains filter
                query = query.filter('cluster_ids', 'cs', `{${clusterId}}`);
            }

            const { data: pointers, error: pError } = await query
                .order('quality_score', { ascending: false })
                .limit(40);

            if (pError) throw pError;

            // 4. DATA MAPPING
            const jobIds = (pointers || []).map((p: any) => p.company_id).filter(id => id);
            let companyMap: Record<string, string> = {};
            if (jobIds.length > 0) {
                const { data: companies } = await supabaseClient.from('companies').select('id, name').in('id', jobIds);
                companyMap = Object.fromEntries(companies?.map((c: any) => [c.id, c.name]) || []);
            }

            const result = (pointers || []).map((p: any) => {
                // Heuristic Location Labeling
                let displayLocation = p.location_name || p.location_type || 'US-REMOTE';
                if (!p.location_name) {
                    if (p.source_url?.toLowerCase().includes('remote')) displayLocation = 'Remote (Verified)';
                    else if (p.location_type === 'onsite') displayLocation = 'Onsite (Unknown Location)';
                }

                return {
                    job_id: p.id,
                    company: p.company_name || companyMap[p.company_id] || p.source_type || 'Unknown',
                    role: p.title || p.role_category,
                    location: displayLocation,
                    source: p.source_type,
                    source_url: p.source_url, // Return the actual URL
                    pointer_status: p.validation_status,
                    fingerprint: p.fingerprint
                };
            });

            return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({ error: "NOT_FOUND", subPath }), { status: 404, headers: corsHeaders });

    } catch (error: any) {
        return Guardrails.handleError(supabaseClient, error, "HIRING_ENGINE_V1");
    }
});
