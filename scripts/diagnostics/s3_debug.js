
const { S3Client, ListObjectsV2Command, GetObjectCommand } = require("@aws-sdk/client-s3");

// Test configuration - mimicking the exact .env values (with trailing spaces)
const config = {
    endpoint: "https://s3.us-east-005.backblazeb2.com ", // Space!
    region: "us-east-005",
    credentials: {
        accessKeyId: "0053f243b98f53c0000000002 ", // Space!
        secretAccessKey: "K005G3z3EBsBcnEOIEZVHu8yMXffRB0 " // Space!
    },
    forcePathStyle: true,
};

async function testS3() {
    console.log("--- S3 CONFIG DEBUG ---");
    console.log(`Endpoint: [${config.endpoint}]`);
    console.log(`Key: [${config.credentials.accessKeyId}]`);

    try {
        const client = new S3Client(config);
        console.log("Listing objects in 'hiremax' bucket...");
        const listCmd = new ListObjectsV2Command({ Bucket: "hiremax", MaxKeys: 5 });
        const listRes = await client.send(listCmd);
        
        if (!listRes.Contents || listRes.Contents.length === 0) {
            console.log("Bucket is empty or no access.");
            return;
        }

        const firstKey = listRes.Contents[0].Key;
        console.log(`Found file: ${firstKey}. Reading content...`);

        const getCmd = new GetObjectCommand({ Bucket: "hiremax", Key: firstKey });
        const getRes = await client.send(getCmd);
        const text = await getRes.Body.transformToString();
        console.log("--- SUCCESS: First 200 characters ---");
        console.log(text.substring(0, 200));

    } catch (err) {
        console.error("--- FAILURE ---");
        console.error("Error Code:", err.name || err.code);
        console.error("Message:", err.message);
        
        if (err.message.includes("ENOTFOUND")) {
            console.log("ROOT CAUSE: Invalid endpoint (likely trailing space or DNS).");
        } else if (err.name === "SignatureDoesNotMatch") {
            console.log("ROOT CAUSE: Invalid credentials (likely trailing space in Key/Secret).");
        }
    }
}

testS3();
