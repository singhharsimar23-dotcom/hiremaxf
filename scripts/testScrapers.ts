
import { LeverAdapter } from './core/ingestion-engine/adapters/lever';
import { GreenhouseAdapter } from './core/ingestion-engine/adapters/greenhouse';

async function test() {
  console.log("🔍 Testing Lever (Stripe)...");
  const lever = new LeverAdapter();
  const stripeJobs = await lever.fetchBatch({}, "stripe", 0, 10);
  console.log(`✅ Lever: Found ${stripeJobs.length} jobs`);

  console.log("🔍 Testing Greenhouse (OpenAI)...");
  const greenhouse = new GreenhouseAdapter();
  const openaiJobs = await greenhouse.fetchBatch({}, "openai", 0, 10);
  console.log(`✅ Greenhouse: Found ${openaiJobs.length} jobs`);
}

test().catch(e => console.error("❌ Test Failed:", e));
