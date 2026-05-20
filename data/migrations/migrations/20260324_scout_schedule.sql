-- 20260324_scout_schedule.sql
-- Schedule the Google Jobs Scout to run every 6 hours

-- Note: Ensure pg_cron is enabled in your Supabase project.
-- You will need to replace <PROJECT_REFERENCE_ID> and <SERVICE_ROLE_KEY> with actual values.

SELECT cron.schedule(
    'google-linkedin-scout-6hr',
    '0 */6 * * *', -- Every 6 hours
    $$
    SELECT net.http_post(
        url := 'https://<PROJECT_REFERENCE_ID>.supabase.co/functions/v1/google-linkedin-scout',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
        ),
        body := '{}'::jsonb
    )
    $$
);

-- Verification:
-- SELECT * FROM cron.job;
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
