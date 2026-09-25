/*
  # Let an admin cancel or resume a specific scheduled email

  The admin console is getting one place to see every scheduled customer
  email — day-before job reminders, post-job follow-ups, and the portal
  welcome series — with the ability to cancel or resume any one of them
  (see ScheduledEmailsPage). Two of those three already have nowhere to
  record "don't send this one": a reminder or follow-up only stops going
  out if the job itself is cancelled or archived, which throws away the
  job along with the email. This adds a narrower switch.

  ## Changes

  1. New columns on `jobs`
     - `customer_reminder_cancelled_at` (timestamptz) — set to silence just
       the day-before reminder for this job. NULL (the default) means it
       is not cancelled. Mirrors `follow_up_cancelled_at` the way every
       other pair of reminder/follow-up columns on this table already does.
     - `follow_up_cancelled_at` (timestamptz) — same, for the post-job
       follow-up.

     Both are read by decideReminder/decideFollowup
     (supabase/functions/_shared/customerReminder.ts,
     .../customerFollowup.ts) as a guard that even `force` cannot cross —
     cancelling is a deliberate override of the customer's inbox, so only
     clearing the column (resuming) brings the email back, never a
     "send it now" click.

  2. `portal_welcome_email_queue.status` gains 'cancelled' alongside the
     existing pending/sent/failed/skipped, so the same page can pause a
     queued welcome-series step and put it back to 'pending' later without
     losing its place (scheduled_for is left untouched, so a resumed step
     is picked up on the very next hourly sweep if its time already
     passed, exactly like any other 'pending' row would be).
*/

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_reminder_cancelled_at timestamptz;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS follow_up_cancelled_at timestamptz;

COMMENT ON COLUMN jobs.customer_reminder_cancelled_at IS
  'Set from the admin Scheduled Emails page to silence this job''s day-before reminder without touching the job itself. NULL means it will send normally. Cleared to resume it.';
COMMENT ON COLUMN jobs.follow_up_cancelled_at IS
  'Set from the admin Scheduled Emails page to silence this job''s post-job follow-up without touching the job itself. NULL means it will send normally. Cleared to resume it.';

ALTER TABLE public.portal_welcome_email_queue DROP CONSTRAINT IF EXISTS portal_welcome_email_queue_status_check;
ALTER TABLE public.portal_welcome_email_queue ADD CONSTRAINT portal_welcome_email_queue_status_check
  CHECK (status IN ('pending', 'sent', 'failed', 'skipped', 'cancelled'));
