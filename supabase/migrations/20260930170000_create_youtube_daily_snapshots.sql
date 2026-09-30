/*
  # Daily YouTube snapshots

  YouTube only exposes the channel's subscriber and view totals as a single
  current number, so growth over time has to be recorded by us. One row per
  day: running totals as of that day, plus the previous full day's activity.

  ## Access

  RLS is enabled with NO policies on purpose: only the service role (the
  snapshot-youtube-stats and get-youtube-metrics edge functions) reads or
  writes this table. Nothing in the browser queries it directly.

  ## Schedule

  snapshot-youtube-stats runs daily at 08:00 UTC, after YouTube has finalized
  the previous day. It authorizes with the service role key from Vault, the same
  pattern as 20260923160100_schedule_customer_job_reminders (the `service_role_key`
  secret must exist).

  ## Verifying

      select * from cron.job where jobname = 'snapshot-youtube-stats';
      select * from public.youtube_daily_snapshots order by snapshot_date desc limit 5;

  ## Rollback

      select cron.unschedule('snapshot-youtube-stats');
      drop table public.youtube_daily_snapshots;
*/

CREATE TABLE IF NOT EXISTS public.youtube_daily_snapshots (
  snapshot_date date PRIMARY KEY,
  subscribers_total bigint,
  total_views bigint NOT NULL DEFAULT 0,
  video_count integer NOT NULL DEFAULT 0,
  views bigint,
  watch_minutes numeric,
  subscribers_net integer,
  likes bigint,
  comments bigint,
  shares bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.youtube_daily_snapshots ENABLE ROW LEVEL SECURITY;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'snapshot-youtube-stats') THEN
    PERFORM cron.unschedule('snapshot-youtube-stats');
  END IF;
END $$;

SELECT cron.schedule(
  'snapshot-youtube-stats',
  '0 8 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://nlqzjzxkqteihffptkah.supabase.co/functions/v1/snapshot-youtube-stats',
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
