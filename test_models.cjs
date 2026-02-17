
const https = require('https');
const fs = require('fs');
const path = require('path');

async function testModel(modelName, apiKey) {
    return new Promise((resolve) => {
        const data = JSON.stringify({
            contents: [{ parts: [{ text: "Respond with the word 'READY'." }] }]
        });

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        const req = https.request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        }, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                resolve({ model: modelName, status: res.statusCode, body: body });
            });
        });

        req.on('error', (e) => resolve({ model: modelName, error: e.message }));
        req.write(data);
        req.end();
    });
}

async function main() {
    const envPath = path.join(__dirname, '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const geminiKeyMatch = envContent.match(/VITE_GEMINI_API_KEY=(.*)/);
    const geminiKey = geminiKeyMatch[1].trim().replace(/['";]/g, '');

    const modelsToTest = [
        'gemini-flash-latest',
        'gemini-pro-latest',
        'gemini-2.0-flash',
        'gemini-1.5-flash'
    ];

    console.log("Testing exact model strings...");
    for (const model of modelsToTest) {
        const result = await testModel(model, geminiKey);
        console.log(`Model: ${result.model} | Status: ${result.status}`);
        if (result.status !== 200) {
            console.log(`   Error: ${result.body.substring(0, 200)}`);
        } else {
            console.log(`   Success! Response: ${result.body.substring(0, 100)}`);
        }
    }
}

main();
