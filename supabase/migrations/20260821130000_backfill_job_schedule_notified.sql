/*
# Backfill schedule notification markers for pre-existing jobs

Jobs that were already scheduled before calendar invites existed have a null
`schedule_notified_for`, which reads as "never notified". Editing one of those
rows for any unrelated reason would then send a calendar invite for a job that
already happened.

Marking past-dated jobs as already-notified suppresses that. The cutoff is
`< CURRENT_DATE` rather than every row, so a job scheduled for today or later
still gets its invite the first time it is touched.

Existing jobs are not left out of the calendar entirely: the subscribable feed
covers 180 days back, so they show up there regardless of this marker.

Idempotent — only fills rows where the marker is still null.
*/

UPDATE jobs
SET schedule_notified_for = date_scheduled
WHERE date_scheduled IS NOT NULL
  AND date_scheduled < CURRENT_DATE
  AND schedule_notified_for IS NULL;
