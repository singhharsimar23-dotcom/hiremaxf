import postgres from "https://deno.land/x/postgresjs/mod.js";

const dbUrl = Deno.env.get("SUPABASE_DB_URL") || "postgresql://postgres.ssuknybhzcuusjardsve:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres";
const sql = postgres(dbUrl, { ssl: 'require' });

try {
    const m1 = await Deno.readTextFile("./supabase/migrations/20260309000003_candidate_intelligence_upgrade.sql");
    console.log("Applying Migration 1...");
    await sql.unsafe(m1);
    console.log("Migration 1 applied successfully.");

    const m2 = await Deno.readTextFile("./supabase/migrations/20260309000004_match_jobs_v3.sql");
    console.log("Applying Migration 2...");
    await sql.unsafe(m2);
    console.log("Migration 2 applied successfully.");

} catch (err) {
    console.error("Migration failed:");
    console.error(err);
    Deno.exit(1);
} finally {
    await sql.end();
}
