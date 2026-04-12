/*
  # Fix update_job_on_completion field assignments

  ## Why
  Job completion writes were intermittently failing with type/timeout errors.
  The trigger function was assigning `completed_at` (timestamptz) directly into
  `jobs.date_completed` (date) and no longer linking `jobs.completion_id`.

  ## Fix
  - Cast completion timestamp to date when writing `jobs.date_completed`
  - Restore `jobs.completion_id` linkage
  - Keep updates idempotent with `IS DISTINCT FROM` checks
*/

CREATE OR REPLACE FUNCTION public.update_job_on_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.jobs
    SET
      completion_id = NEW.id,
      date_completed = DATE(NEW.completed_at),
      updated_at = now()
    WHERE id = NEW.job_id
      AND (
        completion_id IS DISTINCT FROM NEW.id
        OR date_completed IS DISTINCT FROM DATE(NEW.completed_at)
      );
  END IF;

  RETURN NEW;
END;
$$;
