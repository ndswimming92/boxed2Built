/*
  # Send the daily sales email on a schedule

  send-sales-digest emails each active subscriber the sales published since
  their last email, and does nothing when there are none.

  ## Why hourly

  Cron runs in UTC, and 8 AM Central is 13:00 UTC in summer and 14:00 in winter.
  The job ticks every hour and the function only sends when the hour in Central
  time is 8, so the send time survives the clock change without editing this.
  Running it again within the hour sends nothing: each subscriber's
  `last_digest_at` has already moved past what is new.

  ## Authorization

  The request carries the SERVICE ROLE key, read from Vault at run time, the
  same as 20260923160100_schedule_customer_job_reminders. If the
  `service_role_key` secret is missing the function answers 401, which shows up
  in `cron.job_run_details`:

      select vault.create_secret('<service-role-key>', 'service_role_key');

  ## Verifying

      select * from cron.job where jobname = 'send-sales-digest';
      select * from cron.job_run_details
        where jobid = (select jobid from cron.job where jobname = 'send-sales-digest')
        order by start_time desc limit 10;

  ## Rollback

      select cron.unschedule('send-sales-digest');
*/

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-sales-digest') THEN
    PERFORM cron.unschedule('send-sales-digest');
  END IF;
END $$;

SELECT cron.schedule(
  'send-sales-digest',
  '0 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://nlqzjzxkqteihffptkah.supabase.co/functions/v1/send-sales-digest',
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
