
const SUPABASE_URL = "https://ssuknybhzcuusjardsve.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzdWtueWJoemN1dXNqYXJkc3ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNDY1MTIsImV4cCI6MjA4NDcyMjUxMn0.9XaUxtMi3btKZIA_sXQCNJI20-iwruxXISr2J1Kmr-g";

const API_KEYS = {
    jooble: "5cd1b848-8b99-405c-8e46-7dfa531f8a33",
    findwork: "84e53bdf57254e450315be866f97392fcc65ab96",
    careerjet: "50094acbfc88d5440ae01cace307c075",
    adzuna_id: "810bfb38",
    adzuna_key: "3106d8c7666d393bf940de6d17201e17",
    reed: "0131ec23-7b64-4583-b114-656f314a5f88",
    usajobs: "OpbCxE8kVUXE11KUj3wnMDMpq1LPDpsURJ0HBBeidb4="
};

const KEYWORDS = [
    "Software Engineer", "Frontend Developer", "Backend Developer", "Full Stack",
    "AI Engineer", "Data Scientist", "DevOps", "Cybersecurity", "Embedded",
    "Mobile Developer", "QA Engineer", "Site Reliability", "Cloud Architect",
    "Solutions Architect", "Product Manager", "Engineering Manager",
    "Data Engineer", "Machine Learning", "System Administrator", "Network Engineer",
    "Security Architect", "Technical Lead", "Software Architect", "Technical Support"
];

const LOCATIONS = [
    "Remote", "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
    "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas",
    "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
    "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey",
    "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon",
    "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas",
    "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"
];

async function trigger(provider: string, identifier: string) {
    const url = `${SUPABASE_URL}/functions/v1/ats-engine-ultimate`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
                ats_provider: provider,
                ats_identifier: identifier,
                api_keys: API_KEYS
            })
        });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`HTTP ${res.status}: ${err}`);
        }
        const data = await res.json();
        console.log(`   ✅ [${provider}] ${identifier}: ${data.count || 0} jobs`);
    } catch (e) {
        console.error(`   ❌ Failed [${provider}] ${identifier}: ${e.message}`);
    }
}

const CONCURRENCY_LIMIT = 5;

async function runBulkSweep() {
    console.log("🚀 Starting Aggressive Parallel Ingestion (20k Target)...");

    const tasks: { provider: string, identifier: string }[] = [];

    // 1. JOOBLE 50-State Sweep
    console.log("📡 Preparing JOOBLE Tasks...");
    const joobleKeywords = KEYWORDS.slice(0, 10);
    const joobleLocations = LOCATIONS.slice(0, 50);

    for (const k of joobleKeywords) {
        for (const l of joobleLocations) {
            tasks.push({ provider: 'JOOBLE', identifier: `${k}:${l}` });
        }
    }

    // 2. CAREERJET Refresh
    console.log("📡 Preparing CAREERJET Tasks...");
    for (const k of KEYWORDS.slice(0, 10)) {
        tasks.push({ provider: 'CAREERJET', identifier: `${k}:us` });
    }

    // 3. FINDWORK
    tasks.push({ provider: 'FINDWORK', identifier: 'all' });

    // 4. Executing in Parallel Batches
    console.log(`⚡ Processing ${tasks.length} tasks with concurrency ${CONCURRENCY_LIMIT}...`);
    for (let i = 0; i < tasks.length; i += CONCURRENCY_LIMIT) {
        const batch = tasks.slice(i, i + CONCURRENCY_LIMIT);
        await Promise.all(batch.map(t => trigger(t.provider, t.identifier)));
        console.log(`   📉 Progress: ${i + batch.length}/${tasks.length}`);
    }

    console.log("\n🏁 Aggressive Parallel Ingestion Complete.");
}

runBulkSweep();
