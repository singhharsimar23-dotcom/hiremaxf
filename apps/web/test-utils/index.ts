import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { S3Client, PutObjectCommand, DeleteObjectsCommand, ListObjectsV2Command } from "https://esm.sh/@aws-sdk/client-s3@3.341.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GATEWAY_URL = `${SUPABASE_URL}/functions/v1/infra-gateway`;
const PARSER_URL = `${SUPABASE_URL}/functions/v1/infra-parser`;

const S3_BUCKET = Deno.env.get("S3_BUCKET")!;
const s3Config = {
    endpoint: Deno.env.get("S3_ENDPOINT")!,
    region: Deno.env.get("S3_REGION")!,
    credentials: {
        accessKeyId: Deno.env.get("S3_ACCESS_KEY_ID")!,
        secretAccessKey: Deno.env.get("S3_SECRET_ACCESS_KEY")!,
    },
    forcePathStyle: true,
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const s3Client = new S3Client(s3Config);

/**
 * Uploads a mock payload to S3 to simulate a connector's behavior.
 */
export async function mockS3Upload(testRunId: string, source: string, externalId: string, data: any) {
    const key = `tests/${testRunId}/${source}_${externalId}.json`;
    await s3Client.send(new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: JSON.stringify(data),
        ContentType: "application/json"
    }));
    return `s3://${S3_BUCKET}/${key}`;
}

/**
 * Calls the Ingestion Gateway.
 */
export async function callGateway(payload: any) {
    const res = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });
    return res;
}

/**
 * Triggers the Parser Worker to process the queue.
 */
export async function triggerParser() {
    const res = await fetch(PARSER_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
    });
    return res;
}

/**
 * Cleans up all artifacts associated with a test run.
 */
export async function fullCleanup(testRunId: string) {
    console.log(`[CLEANUP] Purging data for test_run_id: ${testRunId}...`);

    // 1. Database Cleanup
    await supabase.from("infra_payload_queue").delete().eq("test_run_id", testRunId);
    await supabase.from("infra_payload_failed").delete().eq("test_run_id", testRunId);
    await supabase.from("job_pointers").delete().eq("test_run_id", testRunId);

    // 2. S3 Cleanup
    const prefix = `tests/${testRunId}/`;
    const list = await s3Client.send(new ListObjectsV2Command({
        Bucket: S3_BUCKET,
        Prefix: prefix
    }));

    if (list.Contents && list.Contents.length > 0) {
        const deleteParams = {
            Bucket: S3_BUCKET,
            Delete: { Objects: list.Contents.map(c => ({ Key: c.Key! })) }
        };
        await s3Client.send(new DeleteObjectsCommand(deleteParams));
    }
    
    console.log(`[CLEANUP] ✅ Done.`);
}
