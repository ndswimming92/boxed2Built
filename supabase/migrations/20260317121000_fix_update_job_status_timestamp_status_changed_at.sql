/*
  # Fix update_job_status_timestamp using correct timestamp column

  ## Problem
  A previous migration changed `update_job_status_timestamp()` to write to
  `NEW.status_updated_at`, but `jobs` tracks lifecycle updates in
  `status_changed_at`.

  This caused runtime errors when updating jobs:
  `record "new" has no field "status_updated_at"`.

  ## Fix
  Restore the trigger behavior to update `status_changed_at` when `job_status`
  changes, while keeping an explicit immutable search_path.
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
