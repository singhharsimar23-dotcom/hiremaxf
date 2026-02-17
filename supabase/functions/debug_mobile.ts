import { RemoteOKService } from "./mobile-gateway/remoteok.ts";

try {
    console.log("Fetching RemoteOK jobs...");
    const jobs = await RemoteOKService.fetchJobs("software");
    console.log(`Found ${jobs.length} jobs.`);
    if (jobs.length > 0) {
        console.log("First job:", jobs[0]);
    } else {
        // Fetch raw to see why
        const res = await fetch("https://remoteok.com/api");
        const data = await res.json();
        console.log("Raw API first item:", data[0]);
        console.log("Raw API second item:", data[1]);
    }
} catch (error) {
    console.error("Error:", error);
}
