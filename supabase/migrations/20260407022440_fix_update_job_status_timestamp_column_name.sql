/*
  # Fix update_job_status_timestamp trigger function

  ## Problem
  The live `update_job_status_timestamp()` trigger function references
  `NEW.status_updated_at`, a column that does not exist on the jobs table.
  This causes every job status update (mark as lost, cancel, etc.) to fail
  with: record "new" has no field "status_updated_at"

  ## Fix
  Replace the function body to:
  - Write to the correct column: `status_changed_at`
  - Only update it when job_status actually changes (avoids unnecessary writes)
*/

CREATE OR REPLACE FUNCTION public.update_job_status_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.job_status IS DISTINCT FROM OLD.job_status THEN
    NEW.status_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$;
