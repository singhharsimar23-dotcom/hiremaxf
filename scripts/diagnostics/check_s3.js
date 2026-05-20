const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');

async function checkS3() {
    const s3 = new S3Client({
        region: 'auto',
        endpoint: 'https://78477741be92d4719273c52e1966a33c.r2.cloudflarestorage.com',
        credentials: {
            accessKeyId: '9ae37b9273c52e1966a33c78477741be',
            secretAccessKey: '477741be9ae37b9273c52e1966a33c52e1966a33c78477741be9ae37b927'
        }
    });

    const bucket = 'hiremax';
    const key = 'raw/GREENHOUSE_STRIPE/7532733_REAL_RUN.json';

    try {
        const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        const body = await res.Body.transformToString();
        console.log('S3 CONTENT (SNIPPET):');
        console.log(body.substring(0, 500));
    } catch (e) {
        console.error(e.message);
    }
}
checkS3();
