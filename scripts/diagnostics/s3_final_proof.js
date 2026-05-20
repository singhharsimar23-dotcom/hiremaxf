
const { S3Client, ListObjectsV2Command, GetObjectCommand } = require("@aws-sdk/client-s3");
const fs = require('fs');

// Minimal .env loader
const envText = fs.readFileSync('.env.local', 'utf8');
envText.split('\n').forEach(line => {
    if (line.includes('=')) {
        const [k, v] = line.split('=');
        process.env[k.trim()] = v.trim();
    }
});

async function runTest() {
    console.log("--- S3 PROOF OF ACCESS ---");
    const config = {
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION || 'auto',
        credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
        },
        forcePathStyle: true,
    };

    try {
        const client = new S3Client(config);
        const listCmd = new ListObjectsV2Command({ Bucket: process.env.S3_BUCKET, MaxKeys: 1 });
        const listRes = await client.send(listCmd);
        
        if (listRes.Contents && listRes.Contents.length > 0) {
            const firstKey = listRes.Contents[0].Key;
            console.log(`[PASS] Connected. Reading: ${firstKey}`);

            const getRes = await client.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: firstKey }));
            const text = await getRes.Body.transformToString();
            console.log("--- CONTENT (First 200 chars) ---");
            console.log(text.substring(0, 200));
            console.log("--- END ---");
        } else {
            console.log("[FAIL] Connected, but no files found in bucket.");
        }
    } catch (err) {
        console.error(`[FAIL] ${err.name}: ${err.message}`);
    }
}

runTest();
