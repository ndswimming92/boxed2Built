/*
  # Record when a job actually finished

  ## Problem
  `scheduled_end_time` is the planned end of a job. It feeds the customer
  reminder ("Expected to take"), calendar invites and booking availability, so
  the Finished Job button cannot overwrite it with the real finish time.

  ## Changes
  - New nullable `jobs.actual_end_time`: the local time the job really ended on
    its completion date. Written by Finished Job, editable in the job form.
    Nothing else reads it, so no email, calendar or availability behaviour
    changes.

  ## Security
  No security changes - a plain nullable column covered by the existing jobs
  row policies.
*/

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS actual_end_time time;

COMMENT ON COLUMN jobs.actual_end_time IS 'Local time the job actually finished on date_completed. Separate from scheduled_end_time, which is the planned end used in customer emails.';
