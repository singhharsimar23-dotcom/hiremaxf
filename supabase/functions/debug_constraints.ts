
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Checking ingestion_commands status...");
    const { data: cmdStatus, error: cmdError } = await supabase
        .from("ingestion_commands")
        .select("status")
        .limit(100);

    if (cmdError) {
        console.error("Error reading ingestion_commands:", cmdError);
    } else {
        const statuses = new Set(cmdStatus?.map((c) => c.status));
        console.log("Distinct statuses:", statuses);
    }

    console.log("Checking ingestion_sessions state...");
    const { data: sessState, error: sessError } = await supabase
        .from("ingestion_sessions")
        .select("state")
        .limit(100);

    if (sessError) {
        console.error("Error reading ingestion_sessions:", sessError);
    } else {
        const states = new Set(sessState?.map((s) => s.state));
        console.log("Distinct states:", states);
    }
}

check();
