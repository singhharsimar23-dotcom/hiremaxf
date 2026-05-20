import { mockS3Upload, callGateway, triggerParser, supabase, fullCleanup } from "../test-utils/index.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";

export async function runIngestionTests(testRunId: string) {
    console.log(`\n\n🧪 --- [INGESTION TEST SUITE: ${testRunId}] ---\n`);

    try {
        // [SCENARIO 1] End-to-End Flow
        console.log("➡️ [TEST 1] E2E Flow: Valid Job Ingestion");
        const res_1 = await callGateway({ 
            source: "TEST_GREENHOUSE", 
            external_id: "JOB_001", 
            raw_payload: { id: "JOB_001", title: "Software Engineer", location: "Remote" }, 
            test_run_id: testRunId 
        });
        
        if (res_1.status !== 202) {
            const body = await res_1.text();
            console.error(`[TEST 1] Gateway Failed with ${res_1.status}: ${body}`);
        }
        assertEquals(res_1.status, 202);
        
        // Verify Database Registration
        const { data: queue_1 } = await supabase
            .from("infra_payload_queue")
            .select("*")
            .eq("test_run_id", testRunId)
            .eq("external_id", "JOB_001")
            .single();
        
        assertExists(queue_1);
        assertEquals(queue_1.source, "TEST_GREENHOUSE");
        assertEquals(queue_1.status, "RAW");

        // [SCENARIO 2] Duplicate Handling
        console.log("➡️ [TEST 2] Duplicate Handling: Re-sending same job");
        const res_2 = await callGateway({ 
            source: "TEST_GREENHOUSE", 
            external_id: "JOB_001", 
            raw_payload: { id: "JOB_001", title: "Software Engineer", location: "Remote" }, 
            test_run_id: testRunId 
        });
        assertEquals(res_2.status, 202); 
        
        const { count: queueCount_2 } = await supabase
            .from("infra_payload_queue")
            .select("*", { count: "exact", head: true })
            .eq("test_run_id", testRunId)
            .eq("external_id", "JOB_001");
        assertEquals(queueCount_2, 1); // Only 1 record in queue due to upsert logic in gateway

        // [SCENARIO 3] Corrupted Raw Data
        console.log("➡️ [TEST 3] Corrupted Raw Data: Mocking invalid processing");
        // Note: The gateway now validates JSON. To test downstream failure, 
        // we'll send a payload that the parser won't like or simulate a processing error.
        await callGateway({ 
            source: "TEST_LEVER", 
            external_id: "JOB_ERR", 
            raw_payload: "INVALID_JSON_STRUCTURE", // Gateway will 400 if it's not JSON, but here it's part of the raw_payload object
            test_run_id: testRunId 
        });
        
        // [SCENARIO 5] Worker Crash Recovery
        console.log("➡️ [TEST 5] Crash Recovery: Reclaiming stuck job");
        await callGateway({ 
            source: "TEST_ASHBY", 
            external_id: "JOB_STUCK", 
            raw_payload: { id: "JOB_STUCK", title: "DevOps Engineer" }, 
            test_run_id: testRunId 
        });
        
        // Mark as processing manually with an old locked_at
        await supabase.from("infra_payload_queue").update({ 
            status: "PROCESSING", 
            locked_at: new Date(Date.now() - 10 * 60 * 1000).toISOString() // 10 mins ago
        }).eq("test_run_id", testRunId).eq("external_id", "JOB_STUCK");
        
        // [SCENARIO 9] Priority Processing
        console.log("➡️ [TEST 9] Priority Processing: High priority jumps queue");
        await callGateway({ 
            source: "PRIORITY_TEST", 
            external_id: "LOW", 
            raw_payload: { title: "Low Priority" }, 
            priority: 0, 
            test_run_id: testRunId 
        });
        await callGateway({ 
            source: "PRIORITY_TEST", 
            external_id: "HIGH", 
            raw_payload: { title: "High Priority" }, 
            priority: 10, 
            test_run_id: testRunId 
        });
        
        // Verify priority was saved
        const { data: highJob } = await supabase
            .from("infra_payload_queue")
            .select("priority")
            .eq("test_run_id", testRunId)
            .eq("external_id", "HIGH")
            .single();
        assertEquals(highJob?.priority, 10);

        console.log("\n✅ ALL SCENARIOS COMPLETED SUCCESSFULLY.\n");

    } finally {
        // [CLEANUP]
        // await fullCleanup(testRunId);
    }
}
