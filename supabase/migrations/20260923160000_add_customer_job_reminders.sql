/*
  # Remember which customers have been reminded about their appointment

  send-job-schedule-email already mails a calendar invite when a job gets a
  date, but that email is internal — it goes to the business, never the
  customer, and it carries the leave-by drive time to prove it. Nothing has ever
  emailed the customer about a scheduled job.

  send-customer-job-reminders fills that gap: at 5pm local the day before, the
  customer gets the date, the arrival time, the address to confirm, a prep
  checklist, the quote, and a calendar attachment.

  ## Changes

  1. New columns on `jobs`
     - `customer_reminder_for` (date) — the `date_scheduled` the last customer
       reminder covered. NULL means the customer has never been reminded.
     - `customer_reminder_start_time` (time) — the `scheduled_start_time` that
       reminder announced, so moving a job from 11:30am to 2:00pm on the same
       day re-sends rather than leaving the customer with the old hour.
     - `customer_reminder_sent_at` (timestamptz) — when it actually went out.
     - `customer_reminder_ics_sequence` (integer) — bumped per send so the
       replacement invite supersedes the one already in the customer's calendar
       instead of adding a second entry.

  2. Index
     - `idx_jobs_customer_reminder_due` covers the hourly sweep, which looks at
       active jobs by `date_scheduled`. Partial on `is_active` and a non-null
       date because that is the only shape the sweep ever asks for.

  ## Notes

  - No backfill. These columns start NULL on every job, including ones already
    scheduled, which is deliberate: the sweep only looks a day ahead, so jobs
    already in the past are never candidates, and a job scheduled for tomorrow
    genuinely has not had a customer reminder yet.
  - The mirror of `schedule_notified_*` is intentional. The two emails have
    different audiences and different send moments, so they need separate
    markers — but they answer the same question, and reading one should teach
    you the other.
*/

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_reminder_for date;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_reminder_start_time time;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_reminder_sent_at timestamptz;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_reminder_ics_sequence integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN jobs.customer_reminder_for IS 'date_scheduled the last customer appointment reminder covered. NULL means the customer has never been reminded about this job.';
COMMENT ON COLUMN jobs.customer_reminder_start_time IS 'scheduled_start_time as of the last customer reminder. Compared alongside customer_reminder_for so a time-only reschedule re-sends.';
COMMENT ON COLUMN jobs.customer_reminder_sent_at IS 'When the last customer appointment reminder was accepted by Resend.';
COMMENT ON COLUMN jobs.customer_reminder_ics_sequence IS 'SEQUENCE of the customer calendar attachment. Incremented per send so a reschedule replaces the entry rather than duplicating it.';

CREATE INDEX IF NOT EXISTS idx_jobs_customer_reminder_due
  ON jobs (date_scheduled)
  WHERE is_active = true AND date_scheduled IS NOT NULL;
