
const https = require('https');
const fs = require('fs');
const path = require('path');

function main() {
    try {
        const envPath = path.join(__dirname, '.env.local');
        const envContent = fs.readFileSync(envPath, 'utf8');
        const anonKeyMatch = envContent.match(/VITE_GEMINI_API_KEY=(.*)/);

        if (!anonKeyMatch) {
            console.error("Could not find VITE_GEMINI_API_KEY in .env.local");
            return;
        }

        const geminiKey = anonKeyMatch[1].trim().replace(/['";]/g, '');
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`;

        console.log("Fetching models from:", url.replace(geminiKey, 'REDACTED'));

        https.get(url, (res) => {
            console.log(`Status: ${res.statusCode}`);
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    console.log("Models:", JSON.stringify(data, null, 2));
                } catch (e) {
                    console.log("Raw Body:", body);
                }
            });
        }).on('error', (e) => {
            console.error(e);
        });

    } catch (error) {
        console.error("Error:", error);
    }
}

main();
