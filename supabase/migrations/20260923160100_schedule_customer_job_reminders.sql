/*
  # Send the customer appointment reminder on a schedule

  send-customer-job-reminders decides, per job, whether the customer is due an
  email — 5pm local the day before the job. Nothing calls it until this job
  exists.

  ## Why hourly

  The function aims at a single wall-clock moment (5pm the day before), so the
  tick only has to be fine enough to land on it. An hourly job at minute 0 hits
  17:00 exactly in the business timezone.

  Hourly also covers the case the timing rule cannot: a job booked *after* 5pm
  the day before, or one rescheduled that evening, has a send time already in
  the past, and `decideReminder` returns send=true on the very next tick rather
  than waiting a day that no longer exists. A job that has already started is
  never mailed, so a late sweep cannot send a reminder about work in progress.

  ## Authorization

  The request carries the SERVICE ROLE key, read from Vault at run time — the
  same pattern as 20260921120300_schedule_portal_welcome_emails, and required
  because the function is guarded by `authorizeAdminOrService`, which the anon
  key does not satisfy.

  ## One-time setup before this job can work

  The `service_role_key` secret has to exist. It is already required by the
  portal welcome job, so on this project it is almost certainly set. If it is
  not, run once in the SQL editor with the project's service role key:

      select vault.create_secret('<service-role-key>', 'service_role_key');

  Until then the job runs and the function answers 401, which shows up in
  `cron.job_run_details` rather than failing silently.

  ## Verifying

      select * from cron.job where jobname = 'send-customer-job-reminders';
      select * from cron.job_run_details
        where jobid = (select jobid from cron.job where jobname = 'send-customer-job-reminders')
        order by start_time desc limit 10;

  ## Rollback

      select cron.unschedule('send-customer-job-reminders');
*/

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-customer-job-reminders') THEN
    PERFORM cron.unschedule('send-customer-job-reminders');
  END IF;
END $$;

SELECT cron.schedule(
  'send-customer-job-reminders',
  '0 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://nlqzjzxkqteihffptkah.supabase.co/functions/v1/send-customer-job-reminders',
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
