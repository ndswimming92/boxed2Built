/*
  # Backfill Job Completion Dates

  ## Purpose
  Update existing jobs that have completions but missing `date_completed` values.
  This ensures all completed jobs appear correctly in analytics.

  ## Changes
  - Set `date_completed` for jobs with completions but no completion date
  - Uses the `completed_at` timestamp from the job_completions table

  ## Security
  No security changes - only updating existing data
*/

-- Backfill date_completed for jobs with completions
UPDATE jobs
SET date_completed = DATE(jc.completed_at)
FROM job_completions jc
WHERE jobs.completion_id = jc.id
  AND jobs.date_completed IS NULL;