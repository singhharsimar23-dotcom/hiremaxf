import { normalizeJob } from './infra/shared-core/job-normalizer.ts';
import { generateFingerprint } from './infra/shared-core/fingerprint.ts';

async function runProof() {
    const slug = 'stripe';
    const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;
    
    console.log(`[PROOF] Fetching raw data from ${url}...`);
    const res = await fetch(url);
    const data = await res.json();
    const rawJob = data.jobs[0];

    console.log('[PROOF] Raw API Payload (Snippet):');
    console.log(JSON.stringify({
        id: rawJob.id,
        title: rawJob.title,
        location: rawJob.location,
        absolute_url: rawJob.absolute_url
    }, null, 2));

    // Simulation of infra-parser/index.ts logic (lines 67-98)
    const norm = normalizeJob({
        title: rawJob.title || rawJob.text,
        company: 'STRIPE', 
        location: rawJob.location?.name || rawJob.categories?.location || "Remote",
        url: rawJob.absolute_url || rawJob.hostedUrl,
        description: rawJob.content || rawJob.descriptionPlain || rawJob.description
    });

    const fingerprint = await generateFingerprint(
        norm.company,
        norm.title,
        norm.location_raw,
        rawJob.id.toString(),
        norm.url || ""
    );

    const finalRecord = {
        fingerprint,
        company_name: norm.company,
        title: norm.title,
        role_category: norm.role_category,
        seniority_band: norm.seniority_band,
        location_name: norm.location_raw,
        source_url: norm.url,
        source_type: 'GREENHOUSE',
        ats_provider: 'greenhouse',
        external_id: rawJob.id.toString(),
        quality_score: norm.quality_score,
        last_verified_at: new Date().toISOString()
    };

    console.log('\n[PROOF] Transformed Ingestion Record:');
    console.log(JSON.stringify(finalRecord, null, 2));
}

runProof().catch(console.error);
