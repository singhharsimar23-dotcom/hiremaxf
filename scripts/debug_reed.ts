
async function testReed() {
    const payload = {
        company_id: "00000000-0000-0000-0000-000000000000",
        name: "Test Reed",
        ats_provider: "REED",
        ats_identifier: "Software Engineer:London"
    };

    const url = "https://ssuknybhzcuusjardsve.supabase.co/functions/v1/ats-engine";
    const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzdWtueWJoemN1dXNqYXJkc3ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNDY1MTIsImV4cCI6MjA4NDcyMjUxMn0.9XaUxtMi3btKZIA_sXQCNJI20-iwruxXISr2J1Kmr-g";

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify(payload)
    });

    console.log(`Status: ${res.status}`);
    console.log(`Response:`, await res.text());
}
testReed();
