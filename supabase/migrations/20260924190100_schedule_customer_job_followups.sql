/*
  # Send the post-job follow-up on a schedule

  send-followup-email decides, per job, whether the customer is due a
  follow-up — once its scheduled end time passes. Nothing calls it on a
  schedule until this job exists; until now it only ever ran when an admin
  clicked "Send Follow-Up" by hand.

  ## Why hourly

  decideFollowup's send window is open-ended (`now >= sendAt`), so the tick
  only has to be frequent enough that a job's end time is never more than an
  hour late getting its follow-up. It also covers the case an exact-minute
  trigger cannot: a job whose end time is edited to earlier than it already
  is, or a sweep that was briefly down, still catches up on the next tick
  rather than waiting for anything to happen again.

  ## Why the function's own query, not a wide window here

  This job posts an empty body — the same as the reminder cron. The sweep
  inside send-followup-email is the one that bounds *which* jobs it looks at
  to a short trailing window (a few days), which is what actually protects
  against mailing every customer this business has ever served the moment
  these columns go from NULL to meaningful. See that function and
  20260924190000_add_customer_job_followups.sql for why that bound has to
  exist before this job is safe to run.

  ## Authorization

  The request carries the SERVICE ROLE key, read from Vault at run time —
  the same pattern as 20260923160100_schedule_customer_job_reminders, and
  required because the function is guarded by `authorizeAdminOrService`,
  which the anon key does not satisfy. That secret is already required by
  the reminder job, so on this project it is already set.

  ## Verifying

      select * from cron.job where jobname = 'send-customer-job-followups';
      select * from cron.job_run_details
        where jobid = (select jobid from cron.job where jobname = 'send-customer-job-followups')
        order by start_time desc limit 10;

  ## Rollback

      select cron.unschedule('send-customer-job-followups');
*/

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-customer-job-followups') THEN
    PERFORM cron.unschedule('send-customer-job-followups');
  END IF;
END $$;

SELECT cron.schedule(
  'send-customer-job-followups',
  '0 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://nlqzjzxkqteihffptkah.supabase.co/functions/v1/send-followup-email',
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
