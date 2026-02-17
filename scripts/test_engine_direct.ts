
async function testEngine() {
    const payload = {
        company_id: "e0e5746a-d568-442f-8cdf-1cead10d57d6",
        name: "Monzo Bank",
        ats_provider: "GREENHOUSE",
        ats_identifier: "monzo"
    };

    const url = "https://ssuknybhzcuusjardsve.supabase.co/functions/v1/ats-engine";
    const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzdWtueWJoemN1dXNqYXJkc3ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNDY1MTIsImV4cCI6MjA4NDcyMjUxMn0.9XaUxtMi3btKZIA_sXQCNJI20-iwruxXISr2J1Kmr-g";

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            },
            body: JSON.stringify(payload)
        });

        console.log(`Status: ${res.status}`);
        const data = await res.json();
        console.log(`Response:`, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(`Error:`, e.message);
    }
}
testEngine();
