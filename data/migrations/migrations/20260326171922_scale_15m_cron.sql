-- Scale up processing frequency to handle 50k+ jobs daily and clear backlog

UPDATE cron.job 
SET schedule = '*/15 * * * *'
WHERE jobname = 'discovery-orchestrator-pulse';

UPDATE cron.job 
SET schedule = '*/5 * * * *'
WHERE jobname = 'parser-worker-pulse';

UPDATE cron.job 
SET schedule = '*/5 * * * *'
WHERE jobname = 'feature-worker-pulse';
