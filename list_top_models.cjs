
const https = require('https');
const fs = require('fs');
const path = require('path');

function main() {
    const envPath = path.join(__dirname, '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const anonKeyMatch = envContent.match(/VITE_GEMINI_API_KEY=(.*)/);
    const geminiKey = anonKeyMatch[1].trim().replace(/['";]/g, '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`;

    https.get(url, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
            try {
                const data = JSON.parse(body);
                if (data.models) {
                    console.log("First 10 Models:");
                    data.models.slice(0, 10).forEach(m => console.log(`- ${m.name}`));
                } else {
                    console.log("Error:", body);
                }
            } catch (e) {
                console.log("Parse Error");
            }
        });
    });
}

main();
