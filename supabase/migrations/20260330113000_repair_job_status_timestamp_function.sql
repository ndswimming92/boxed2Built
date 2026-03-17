/*
  # Repair job status timestamp trigger function

  Some environments still have an older definition of
  `public.update_job_status_timestamp()` that writes to a non-existent
  `status_updated_at` column. This migration reapplies the correct function
  body so status changes update `status_changed_at`.
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
