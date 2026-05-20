
const { S3Client, ListObjectsV2Command, GetObjectCommand } = require("@aws-sdk/client-s3");
const fs = require('fs');

// Read directly from .env to prove current state
const envText = fs.readFileSync('.env.local', 'utf8');
const envLines = envText.split('\n');
const parsed = {};
for (const line of envLines) {
    if (line.includes('=')) {
        const [k, v] = line.split('=');
        parsed[k] = v; // Keep spaces to demonstrate fix
    }
}

async function testS3(useFix = false) {
    console.log(`\nTesting S3 (Use Fix: ${useFix})...`);
    
    const ep = useFix ? parsed.S3_ENDPOINT.trim() : parsed.S3_ENDPOINT;
    const ak = useFix ? parsed.S3_ACCESS_KEY_ID.trim() : parsed.S3_ACCESS_KEY_ID;
    const sk = useFix ? parsed.S3_SECRET_ACCESS_KEY.trim() : parsed.S3_SECRET_ACCESS_KEY;
    
    const config = {
        endpoint: ep,
        region: "us-east-005",
        credentials: {
            accessKeyId: ak,
            secretAccessKey: sk
        },
        forcePathStyle: true,
    };

    try {
        const client = new S3Client(config);
        const listCmd = new ListObjectsV2Command({ Bucket: "hiremax", MaxKeys: 1 });
        const listRes = await client.send(listCmd);
        
        if (listRes.Contents && listRes.Contents.length > 0) {
            const firstKey = listRes.Contents[0].Key;
            console.log(`SUCCESS: Connected. Found object: ${firstKey}`);

            const getRes = await client.send(new GetObjectCommand({ Bucket: "hiremax", Key: firstKey }));
            const text = await getRes.Body.transformToString();
            console.log("--- START OF FILE (200 Chars) ---");
            console.log(text.substring(0, 200));
            console.log("--- END ---");
        } else {
            console.log("Connected, but bucket appears empty.");
        }
    } catch (err) {
        console.error("FAILURE:", err.name, "-", err.message);
    }
}

async function runAll() {
    await testS3(false); // Should fail
    await testS3(true);  // Should succeed
}

runAll();
