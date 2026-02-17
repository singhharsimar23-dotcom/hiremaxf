
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
                    console.log("Checking model capabilities...");
                    data.models.forEach(m => {
                        if (m.supportedGenerationMethods.includes('generateContent')) {
                            console.log(`- ${m.name} [SUPPORTED]`);
                        } else {
                            console.log(`- ${m.name} [Methods: ${m.supportedGenerationMethods.join(', ')}]`);
                        }
                    });
                }
            } catch (e) {
                console.log("Parse error");
            }
        });
    });
}

main();
