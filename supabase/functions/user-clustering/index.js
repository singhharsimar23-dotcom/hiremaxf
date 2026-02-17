import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    try {
        console.log("[CLUSTERING] Starting real-world amortization cycle...");
        // 1. GOVERNOR GATE (Absolute Authority)
        const { data: governor } = await supabaseClient.from('governor_state').select('current_mode').single();
        if (governor.current_mode === 'READ_ONLY' || governor.current_mode === 'SAFE') {
            return new Response(JSON.stringify({ success: false, reason: `SYSTEM_GOVERNOR_${governor.current_mode}` }), { headers: corsHeaders, status: 200 });
        }
        // 2. FETCH LATEST PROFILE SNAPSHOTS
        const { data: snapshots, error: sError } = await supabaseClient
            .from('profile_snapshots')
            .select('user_id, snapshot_data')
            .order('created_at', { ascending: false });
        if (sError)
            throw sError;
        // 2. ANALYTIC CLUSTERING (By Intent)
        const userToCluster = {};
        const clusters = {};
        for (const snap of snapshots || []) {
            const data = snap.snapshot_data || {};
            const role = (data.target_role || 'GENERAL_TECH').toUpperCase().replace(/\s+/g, '_');
            const loc = (data.target_location || 'REMOTE').toUpperCase();
            // ARCHITECTURAL CONSTRAINT: US ONLY
            if (loc !== 'REMOTE' && !loc.includes('US') && !loc.includes('USA')) {
                console.log(`[CLUSTERING] Skipping non-US intent for user ${snap.user_id}`);
                continue;
            }
            const clusterKey = `${role}_${loc}`.toLowerCase();
            if (!clusters[clusterKey]) {
                clusters[clusterKey] = {
                    name: `${role} / ${loc}`,
                    members: []
                };
            }
            // Prevent duplicate membership in same cycle
            if (!userToCluster[snap.user_id]) {
                clusters[clusterKey].members.push(snap.user_id);
                userToCluster[snap.user_id] = clusterKey;
            }
        }
        // 3. ATOMIC PERSISTENCE
        let totalMembers = 0;
        for (const [key, details] of Object.entries(clusters)) {
            const { data: cluster, error: cError } = await supabaseClient
                .from('user_clusters')
                .upsert({ name: details.name }, { onConflict: 'name' })
                .select()
                .single();
            if (cError)
                throw cError;
            for (const userId of details.members) {
                await supabaseClient
                    .from('cluster_user_mapping')
                    .upsert({ cluster_id: cluster.id, user_id: userId }, { onConflict: 'cluster_id,user_id' });
                totalMembers++;
            }
        }
        console.log(`[CLUSTERING] Success: ${Object.keys(clusters).length} clusters for ${totalMembers} users.`);
        return new Response(JSON.stringify({
            success: true,
            clusters_count: Object.keys(clusters).length,
            users_clustered: totalMembers
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }
    catch (error) {
        console.error(`[CLUSTERING_ERROR]:`, error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
