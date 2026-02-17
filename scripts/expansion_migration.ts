
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ssuknybhzcuusjardsve.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzdWtueWJoemN1dXNqYXJkc3ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNDY1MTIsImV4cCI6MjA4NDcyMjUxMn0.9XaUxtMi3btKZIA_sXQCNJI20-iwruxXISr2J1Kmr-g";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

const VERIFIED_TARGETS = [
    { name: "Monzo Bank", domain: "monzo.com" },
    { name: "Starling Bank", domain: "starlingbank.com" },
    { name: "Deliveroo", domain: "deliveroo.co.uk" },
    { name: "Revolut", domain: "revolut.com" },
    { name: "Checkout.com", domain: "checkout.com" },
    { name: "Bloom & Wild", domain: "bloomandwild.com" },
    { name: "Gymshark", domain: "gymshark.com" },
    { name: "OakNorth Bank", domain: "oaknorth.co.uk" },
    { name: "Tide", domain: "tide.co" },
    { name: "Birdie", domain: "birdie.care" },
    { name: "Zopa", domain: "zopa.com" },
    { name: "Graphcore", domain: "graphcore.ai" },
    { name: "TrueLayer", domain: "truelayer.com" },
    { name: "Robin AI", domain: "robinai.com" },
    { name: "Peppy Health", domain: "peppy.health" },
    { name: "Lottie", domain: "lottie.org" },
    { name: "Sano Genetics", domain: "sanogenetics.com" },
    { name: "Hyperexponential", domain: "hyperexponential.com" },
    { name: "Cohere", domain: "cohere.ai" },
    { name: "Neo Financial", domain: "neofinancial.com" },
    { name: "Hopper", domain: "hopper.com" },
    { name: "Clio", domain: "clio.com" },
    { name: "AlayaCare", domain: "alayacare.com" },
    { name: "Float", domain: "floatcard.com" },
    { name: "Wealthsimple", domain: "wealthsimple.com" },
    { name: "Mistral AI", domain: "mistral.ai" },
    { name: "Neko Health", domain: "nekohealth.com" },
    { name: "Enpal", domain: "enpal.de" },
    { name: "Plan A", domain: "plana.earth" },
    { name: "Northvolt", domain: "northvolt.com" },
    { name: "Atlar", domain: "atlar.com" },
    { name: "Picnic", domain: "picnic.app" },
    { name: "Celonis", domain: "celonis.com" },
    { name: "Back Market", domain: "backmarket.com" },
    { name: "Doctolib", domain: "doctolib.fr" },
    { name: "Klarna", domain: "klarna.com" },
    { name: "Bolt", domain: "bolt.eu" },
    { name: "Wolt", domain: "wolt.com" },
    { name: "BlaBlaCar", domain: "blablacar.com" },
    { name: "DeepL", domain: "deepl.com" },
    { name: "Adyen", domain: "adyen.com" },
    { name: "Spotify", domain: "spotify.com" }
];

async function run() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log("🧹 Cleaning up synthetic spoof entries...");
    // 1. First, clear ingestion_queue of these companies
    const spoofPattern = '% AI, % Labs, % Tech, % Systems, % Data, % Cloud, % Security, % Networks, % Robotics, % Bio';
    const patterns = spoofPattern.split(', ').map(p => p.trim());

    for (const pattern of patterns) {
        // Get IDs
        const { data: companies } = await supabase
            .from('company_registry_expanded')
            .select('id')
            .like('company_name', pattern);

        if (companies && companies.length > 0) {
            const ids = companies.map(c => c.id);
            console.log(`   Removing queue/registry entries for pattern ${pattern} (${ids.length} companies)`);

            await supabase.from('ingestion_queue').delete().in('company_id', ids);
            await supabase.from('company_registry_expanded').delete().in('id', ids);
        }
    }

    console.log("🚀 Inserting verified international targets...");
    const toInsert = VERIFIED_TARGETS.map(t => ({
        company_name: t.name,
        domain: t.domain,
        careers_url: `https://${t.domain}/careers` // Default best guess
    }));

    const { error: insError } = await supabase
        .from('company_registry_expanded')
        .upsert(toInsert, { onConflict: 'domain' });

    if (insError) console.error("Error inserting targets:", insError);
    else console.log(`✅ Successfully added ${VERIFIED_TARGETS.length} verified companies.`);

    console.log("🏁 Migration finished.");
}

run();
