
async function testScrape() {
    const url = 'https://www.claralimportfolio.com/aboutme';
    try {
        console.log(`Testing fetch for: ${url}`);
        const resp = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        console.log(`Status: ${resp.status}`);
        const text = await resp.text();
        console.log(`Content length: ${text.length}`);
        console.log(`Snippet: ${text.substring(0, 100)}`);
    } catch (e) {
        console.error(`Fetch failed: ${e.message}`);
    }
}

testScrape();
