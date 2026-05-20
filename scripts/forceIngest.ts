
const SECRET = "hiremax_internal_trusted_core_2024";
const URL = "https://hiremax-ingestion.singh-harsimar23.workers.dev";

async function trigger() {
  console.log("🚀 Triggering ingestion flow...");
  const resp = await fetch(URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SECRET}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ group: "alpha" })
  });
  const data = await resp.json();
  console.log("✅ Worker Response:", JSON.stringify(data, null, 2));
}

trigger().catch(console.error);
