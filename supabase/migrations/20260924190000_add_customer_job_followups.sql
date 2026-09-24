/*
  # Remember which jobs have been followed up on

  send-followup-email mails a thank-you (Google review ask, referral code) but
  only from a client's profile, by hand, with a 10-minute anti-double-click
  cooldown on `clients.last_followup_email_sent_at`. Nothing ties it to a
  specific job, so it cannot know when a job's work is actually done or
  whether *this* job has already gotten its follow-up.

  These columns give the follow-up the same per-job memory
  20260923160000_add_customer_job_reminders.sql gave the day-before reminder,
  so a sweep can fire it automatically once a job's scheduled end time
  passes, without re-mailing a job it already covered, and re-arming when the
  end time moves.

  ## Changes

  1. New columns on `jobs`
     - `follow_up_for_date` (date) — the `date_scheduled` the last follow-up
       covered. NULL means this job has never had one.
     - `follow_up_for_end_time` (time) — the `scheduled_end_time` that
       follow-up covered, so moving a job's end time later re-arms it even
       after an earlier send.
     - `follow_up_sent_at` (timestamptz) — when it actually went out.

  2. Index
     - `idx_jobs_followup_due` covers the hourly sweep, which looks at active
       jobs by `date_scheduled`. Partial on `is_active` and a non-null date,
       matching idx_jobs_customer_reminder_due.

  ## Notes

  - No backfill, and this one matters more than usual: every job that has
    ever been completed already has an end time in the past. Without a tight
    lookback window in the sweep's own query (not this migration — see
    send-followup-email), leaving these columns NULL on existing rows would
    make the very first sweep after this migration mail a "thanks for
    choosing us" email to every customer this business has ever served. The
    sweep is written to only ever consider jobs from the last few days; this
    migration only adds the columns it reads.
  - The mirror of `customer_reminder_*` is intentional. The two emails have
    different audiences and different send moments — one before the job,
    one after — so they need separate markers, but they answer the same
    question and reading one should teach you the other.
*/

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS follow_up_for_date date;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS follow_up_for_end_time time;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS follow_up_sent_at timestamptz;

COMMENT ON COLUMN jobs.follow_up_for_date IS 'date_scheduled the last post-job follow-up covered. NULL means this job has never had one.';
COMMENT ON COLUMN jobs.follow_up_for_end_time IS 'scheduled_end_time as of the last follow-up. Compared alongside follow_up_for_date so an end-time-only reschedule re-sends.';
COMMENT ON COLUMN jobs.follow_up_sent_at IS 'When the last post-job follow-up was accepted by Resend.';

CREATE INDEX IF NOT EXISTS idx_jobs_followup_due
  ON jobs (date_scheduled)
  WHERE is_active = true AND date_scheduled IS NOT NULL;
