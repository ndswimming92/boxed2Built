/*
  # Let an admin delete a cancelled scheduled email

  A cancelled reminder/follow-up is computed live from its job, so there is no
  row to delete. These columns record "hide this cancelled email from the
  Scheduled Emails page" without touching the job. Cancelled welcome-series
  steps are real queue rows and are simply deleted.
*/

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_reminder_dismissed_at timestamptz;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS follow_up_dismissed_at timestamptz;
