
const https = require('https');
const fs = require('fs');
const path = require('path');

function main() {
    const envPath = path.join(__dirname, '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');

    const anonKeyMatch = envContent.match(/VITE_GEMINI_API_KEY=(.*)/);
    const geminiKey = anonKeyMatch[1].trim().replace(/['";]/g, '');

    const url = 'https://ssuknybhzcuusjardsve.supabase.co/functions/v1/generate-diagnostic';

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${geminiKey}`
        }
    };

    const body = JSON.stringify({
        user_id: "00000000-0000-0000-0000-000000000000",
        targetRole: "ML Intern",
        roleTrack: "AI_PRODUCTION",
        resumeText: "Experience with PyTorch, TensorFlow, and large language models."
    });

    console.log(`Invoking: ${url}`);
    const req = https.request(url, options, (res) => {
        console.log(`Status: ${res.statusCode}`);
        let responseBody = '';
        res.on('data', (chunk) => responseBody += chunk);
        res.on('end', () => {
            console.log('Body:', responseBody);
            try {
                const parsed = JSON.parse(responseBody);
                console.log('Parsed:', JSON.stringify(parsed, null, 2));
            } catch (e) { }
        });
    });

    req.on('error', (e) => console.error('Request Error:', e));
    req.write(body);
    req.end();
}

main();
