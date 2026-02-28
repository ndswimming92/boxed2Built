/*
  # Fix update_job_status_timestamp trigger function

  ## Problem
  The trigger referenced `NEW.status` and `OLD.status` but the actual column
  on the `jobs` table is `job_status`. This caused a "record new has no field
  status" error whenever a job was saved/updated.

  ## Fix
  Replace `NEW.status` / `OLD.status` with `NEW.job_status` / `OLD.job_status`.
*/

CREATE OR REPLACE FUNCTION update_job_status_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.job_status IS DISTINCT FROM OLD.job_status THEN
    NEW.status_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$;
