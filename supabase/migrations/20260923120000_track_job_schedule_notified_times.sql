/*
  # Remember the time of day a job schedule email announced

  `schedule_notified_for` records the `date_scheduled` the last calendar email
  went out for, and send-job-schedule-email skips when that date has not moved.
  Now that a job carries `scheduled_start_time` / `scheduled_end_time` and the
  invite is a timed event, that guard is too coarse: moving a job from 11:30am
  to 2:00pm on the same day left the guard satisfied, so no new invite went out
  and the calendar entry kept the old hours.

  ## Changes

  1. New columns on `jobs`
     - `schedule_notified_start_time` (time) — the `scheduled_start_time` the
       last email announced. NULL means it announced an all-day job.
     - `schedule_notified_end_time` (time) — likewise for the end time.

  2. Backfill
     - Rows that already have `schedule_notified_for` set are assumed to have
       been announced with whatever times they currently hold, so an unrelated
       edit to an old job does not trigger a surprise "rescheduled" email on the
       first save after this ships.

  ## Notes

  - Both columns are nullable with no default: NULL on a never-notified job is
    indistinguishable from NULL on an all-day one, and the date column is what
    decides that case.
*/

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS schedule_notified_start_time time;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS schedule_notified_end_time time;

COMMENT ON COLUMN jobs.schedule_notified_start_time IS 'scheduled_start_time as of the last calendar email. Compared alongside schedule_notified_for so a time-only reschedule still sends.';
COMMENT ON COLUMN jobs.schedule_notified_end_time IS 'scheduled_end_time as of the last calendar email.';

UPDATE jobs
SET schedule_notified_start_time = scheduled_start_time,
    schedule_notified_end_time = scheduled_end_time
WHERE schedule_notified_for IS NOT NULL
  AND schedule_notified_start_time IS NULL
  AND schedule_notified_end_time IS NULL;
