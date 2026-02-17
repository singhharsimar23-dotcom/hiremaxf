
import * as fs from 'fs';

const targets = [
    { name: "Salesforce", url: "https://salesforce.wd1.myworkdayjobs.com/External_Career_Site" },
    { name: "Puma", url: "https://puma.wd3.myworkdayjobs.com/PUMA_Careers" },
    { name: "Nvidia", url: "https://nvidia.wd1.myworkdayjobs.com/NVIDIAExternalCareerSite" }
];

async function test() {
    for (const t of targets) {
        try {
            const u = new URL(t.url);
            let tenant = u.hostname.split('.')[0];

            // 1. Fetch Main Page to find Tenant Config
            console.log(`Fetching Main Page: ${t.url}`);
            const mainRes = await fetch(t.url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.5",
                    "Accept-Encoding": "gzip, deflate, br",
                    "Connection": "keep-alive",
                    "Upgrade-Insecure-Requests": "1",
                    "Sec-Fetch-Dest": "document",
                    "Sec-Fetch-Mode": "navigate",
                    "Sec-Fetch-Site": "none",
                    "Sec-Fetch-User": "?1",
                    "Cache-Control": "max-age=0"
                }
            });
            const html = await mainRes.text();

            if (t.name === 'Salesforce') {
                try {
                    fs.writeFileSync('debug_workday.html', html);
                    console.log(`Saved debug_workday.html (${html.length} bytes)`);
                } catch (e) {
                    console.error('Failed to write file', e);
                }
            }

            // Look for common patterns
            const clientTenantMatch = html.match(/"clientTenant":"(.*?)"/);
            const tenantMatch = html.match(/"tenant":"(.*?)"/);
            const siteMatch = html.match(/"siteId":"(.*?)"/) || html.match(/"site":"(.*?)"/);

            // Hardcode found values for Nvidia
            const foundTenant = 'nvidia';
            const foundSite = 'NVIDIAExternalCareerSite';
            const hostname = 'nvidia.wd1.myworkdayjobs.com';

            console.log(`   Using Tenant: ${foundTenant}`);
            console.log(`   Using Site: ${foundSite}`);

            if (foundTenant && foundSite) {
                const configUrl = `https://${hostname}/wday/cxs/${foundTenant}/${foundSite}`;
                // Skip config check
                const jobsUrl = `${configUrl}/jobs`;
                console.log(`Testing Jobs API: ${jobsUrl}`);

                const payloads = [
                    { "limit": 20, "offset": 0, "searchText": "" },
                    { "appliedFacets": {}, "limit": 20, "offset": 0, "searchText": "" },
                    { "limit": 20 }
                ];

                for (const p of payloads) {
                    console.log(`   Testing payload: ${JSON.stringify(p)}`);
                    const jobsRes = await fetch(jobsUrl, {
                        method: 'POST',
                        headers: {
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                            "Accept": "application/json",
                            "Content-Type": "application/json",
                            "Accept-Language": "en-US,en;q=0.5",
                            "Accept-Encoding": "gzip, deflate, br",
                            "Connection": "keep-alive",
                            "Origin": `https://${u.hostname}`,
                            "Referer": `${configUrl}`,
                            "Sec-Fetch-Dest": "empty",
                            "Sec-Fetch-Mode": "cors",
                            "Sec-Fetch-Site": "same-origin"
                        },
                        body: JSON.stringify(p)
                    });

                    if (jobsRes.ok) {
                        const data = await jobsRes.json();
                        console.log(`   ✅ Success! Found ${data.total} jobs.`);
                        break;
                    } else {
                        console.log(`   ❌ Failed: ${jobsRes.status}`);
                        try {
                            const txt = await jobsRes.text();
                            console.log(`      Body: ${txt.substring(0, 300)}`);
                        } catch (e) { }
                    }
                }
            } else {
                console.log("   ❌ Could not determine tenant/site.");
            }

        } catch (e) {
            console.error(`   Error for ${t.name}:`, e);
        }
    }
}

test();
