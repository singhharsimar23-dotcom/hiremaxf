
async function test() {
    const targets = [
        { name: "Monzo Bank", url: "https://monzo.com/careers" },
        { name: "OakNorth Bank", url: "https://www.oaknorth.co.uk/careers/" },
        { name: "Deliveroo", url: "https://deliveroo.co.uk/careers" },
        { name: "Revolut", url: "https://www.revolut.com/careers" }
    ];

    for (const t of targets) {
        console.log(`Checking ${t.name}: ${t.url}`);
        try {
            const res = await fetch(t.url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
            });
            console.log(`   Status: ${res.status}`);
            if (res.ok) {
                const html = await res.text();
                console.log(`   HTML Length: ${html.length}`);
                console.log(`   Contains 'greenhouse.io': ${html.includes('greenhouse.io')}`);
                console.log(`   Contains 'lever.co': ${html.includes('lever.co')}`);
                console.log(`   Contains 'ashbyhq.com': ${html.includes('ashbyhq.com')}`);
                console.log(`   Contains 'ashby_jobs': ${html.includes('ashby_jobs')}`);
                if (!html.includes('greenhouse.io') && !html.includes('lever.co') && !html.includes('ashbyhq.com')) {
                    console.log(`   Snippet: ${html.substring(0, 500)}`);
                }
            }
        } catch (e) {
            console.log(`   Error: ${e.message}`);
        }
    }
}
test();
