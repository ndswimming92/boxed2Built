/*
  # Fix job completion trigger for date_completed

  ## Problem
  The update_job_on_completion trigger function referenced NEW.completion_date,
  which is not a column on job_completions, causing inserts to fail.

  ## Changes
  Restore the trigger to use NEW.completed_at and update jobs.date_completed.
*/

CREATE OR REPLACE FUNCTION update_job_on_completion()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE jobs
  SET
    completion_id = NEW.id,
    has_signature = true,
    signed_off_at = NEW.completed_at,
    date_completed = DATE(NEW.completed_at),
    updated_at = now()
  WHERE id = NEW.job_id;

  RETURN NEW;
END;
$$;
