import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { PersistenceEngine } from '../../core/ingestion-engine/core/persistence.js';
import { IntelligenceEngine } from '../../core/ingestion-engine/core/intelligence.js';

// Load ENV
function loadEnv() {
  const env: Record<string, string> = {};
  for (const file of ['.env', '.env.local']) {
    const p = join(resolve(process.cwd()), file);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf-8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 0) continue;
      env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
  return env as any;
}

async function proveIt() {
  console.log('\n======================================================');
  console.log('   CIRCUIT BREAKER PROOF OF EXECUTION (PHASE 3)');
  console.log('======================================================\n');
  
  const env = loadEnv();
  
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing DB credentials.");
    process.exit(1);
  }

  // Generate a distinct test payload
  const jobId = `PROOF-TEST-${Date.now()}`;
  const mockJob = {
    title: 'Senior Fallback Engineer',
    company: 'HireMax Infra',
    location: 'Remote',
    source: 'system:verification',
    source_job_id: jobId,
    apply_url: `https://hiremax.com/proof/${jobId}`
  };

  console.log(`[1] Initiating Upsert for Mock Job: ${jobId}`);
  
  // Create identity
  const identity = await PersistenceEngine.generateIdentity(mockJob as any);
  console.log(`[2] Identity generated. Fingerprint: ${identity.fingerprint}`);

  console.log(`[3] Handing off to PersistenceEngine.upsert() ...`);
  console.log(`    (Watch for the GATEWAY_FAILED console.warn below)\n`);

  const originalConsoleWarn = console.warn;
  let warnTriggered = false;
  console.warn = (...args) => {
    if (args[0] && args[0].includes('GATEWAY_FAILED')) {
      warnTriggered = true;
      originalConsoleWarn('🔥 [CAUGHT WARNING NATIVELY]:', ...args);
    } else {
      originalConsoleWarn(...args);
    }
  };

  const traceId = crypto.randomUUID();
  const result = await PersistenceEngine.upsert(
    env as any, 
    mockJob as any, 
    identity, 
    { total: 99 }, 
    traceId
  );

  console.log(`\n[4] PersistenceEngine.upsert() return object:`);
  console.log(JSON.stringify(result, null, 2));

  console.log(`\n======================================================`);
  if (warnTriggered && result.wasInserted && !result.error) {
    console.log('✅ PROOF SECURED.');
    console.log('   - writeViaGateway() was attempted (and failed with 503)');
    console.log('   - catch block elegantly absorbed the error');
    console.log('   - writeDirectToSupabase() took over and returned success');
  } else if (!warnTriggered) {
    console.log('❌ Gateway did NOT fail. The 503 is fixed?');
  } else {
    console.log('❌ Fallback failed. Review the output.');
  }
  console.log('======================================================\n');
}

proveIt();
