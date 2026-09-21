/*
  # Drain the portal welcome email queue on a schedule

  ## Why this exists
  `portal_welcome_email_queue` has been filled by
  `enqueue_portal_welcome_sequence_for_customer` since the onboarding-funnel
  migration, but nothing has ever read it — no edge function, no job, no
  script. Every welcome sequence ever queued is still sitting there unsent.
  20260921120100 makes self-registered customers queue too, which without this
  would only add to a pile nobody collects.

  ## Authorization
  The request carries the SERVICE ROLE key, read from Vault at run time.

  This differs deliberately from 20260727160000_add_scheduled_social_posting,
  which embeds the anon key in the migration. That job posts to a function
  guarded by `authorizeAdminOrService`, which accepts only the service role key
  or a JWT resolving to a platform admin — the anon key is neither. The guard
  landed three weeks after that schedule was written, so `run-scheduled-social-posts`
  has been answering its own cron with 401 ever since. Not fixed here: changing
  how social posting authenticates belongs with someone who can watch it post.

  ## One-time setup before this job can work
  The secret has to exist, and it cannot be created from a migration without
  committing the key to git. Run once, in the SQL editor, with the project's
  service role key:

      select vault.create_secret('<service-role-key>', 'service_role_key');

  Until then the job runs and the function answers 401, which shows up in
  `cron.job_run_details` rather than failing silently.

  ## Rollback
      select cron.unschedule('send-portal-welcome-emails');
*/

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-portal-welcome-emails') THEN
    PERFORM cron.unschedule('send-portal-welcome-emails');
  END IF;
END $$;

-- Hourly. The sequence is scheduled in days (now, +2, +5), so the queue never
-- needs finer granularity than this.
SELECT cron.schedule(
  'send-portal-welcome-emails',
  '0 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://nlqzjzxkqteihffptkah.supabase.co/functions/v1/send-portal-welcome-emails',
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
