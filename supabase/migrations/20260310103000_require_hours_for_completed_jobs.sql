/*
  # Require hours_worked for completed jobs

  Enforces data quality for all-time hourly metrics by requiring positive
  `hours_worked` when a job is completed via status or completion date.

  NOTE: Added as NOT VALID so existing legacy rows do not block deployment.
  New/updated rows are still enforced immediately.
*/

ALTER TABLE public.jobs
DROP CONSTRAINT IF EXISTS jobs_completed_hours_worked_required;

ALTER TABLE public.jobs
ADD CONSTRAINT jobs_completed_hours_worked_required
CHECK (
  NOT (job_status = 'completed' OR date_completed IS NOT NULL)
  OR (hours_worked IS NOT NULL AND hours_worked > 0)
) NOT VALID;
