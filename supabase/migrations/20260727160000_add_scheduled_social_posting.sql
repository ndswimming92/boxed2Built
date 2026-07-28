/*
  # Scheduled social posting

  1. Changes
    - `gallery_items.social_scheduled_at` (timestamptz, nullable) — when set,
      the item is queued to auto-post to Facebook/Instagram once this time
      passes. Cleared once the scheduled post has been attempted (success or
      failure), same as the existing "Post Now" flow's error columns.

  2. Scheduling
    - Enables `pg_cron` and `pg_net` (both already available on this
      project's Postgres, just not yet turned on).
    - A cron job runs every 5 minutes, calling the `run-scheduled-social-posts`
      edge function via `net.http_post`. That function does the actual work
      (finding due items, posting, clearing the schedule) — this job's only
      purpose is to invoke it on a timer.
    - The call is authenticated with this project's anon key, which is safe
      to store here: it's the same public key already shipped in the site's
      frontend bundle. The edge function itself doesn't require an
      authenticated user (it's a system job, not user-initiated) — it only
      processes gallery items an admin already scheduled via the normal,
      authenticated admin UI.
*/

ALTER TABLE gallery_items ADD COLUMN IF NOT EXISTS social_scheduled_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_gallery_items_social_scheduled_at
  ON gallery_items(social_scheduled_at) WHERE social_scheduled_at IS NOT NULL;

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
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5scXpqenhrcXRlaWhmZnB0a2FoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwODYwNTksImV4cCI6MjA3MTY2MjA1OX0.e0t7YtdMR9IjOTVK8YcVHN3eoeBZ7_zXyAzO8qr_2kw'
    ),
    body := jsonb_build_object('trigger', 'cron')
  ) AS request_id;
  $cron$
);
