/*
  # Fix the scheduled social posts cron job's credentials

  `run-scheduled-social-posts` now requires the service role key (or a signed-in
  platform admin) via `authorizeAdminOrService`. The cron job created in
  20260727160000_add_scheduled_social_posting.sql still sends the public anon key,
  so every run since the function was locked down answers 401 and no scheduled
  gallery post is ever published.

  This reschedules the job to send the service role key from Vault at run time,
  the same way send-sales-digest does (20261020120100_schedule_sales_digest.sql).
  It also removes the anon key from the stored cron command.

  Prerequisite (already in place for the sales digest):

      select vault.create_secret('<service-role-key>', 'service_role_key');

  Verify after applying:

      select * from net._http_response order by created desc limit 5;
      -- expect {"processed":0} with status 200, not {"error":"Unauthorized"}

  Rollback: re-run the schedule in 20260727160000_add_scheduled_social_posting.sql.
*/

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'run-scheduled-social-posts') THEN
    PERFORM cron.unschedule('run-scheduled-social-posts');
  END IF;
END $$;

SELECT cron.schedule(
  'run-scheduled-social-posts',
  '*/5 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://nlqzjzxkqteihffptkah.supabase.co/functions/v1/run-scheduled-social-posts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1
      )
    ),
    body := jsonb_build_object('trigger', 'cron')
  ) AS request_id;
  $cron$
);
