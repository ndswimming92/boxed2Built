/*
  # Fix update_job_on_completion trigger function

  ## Problem
  The trigger function referenced `NEW.completion_date` which does not exist on
  the `job_completions` table (the actual column is `completed_at`), and was
  trying to set `completion_date` on `jobs` (the actual column is `date_completed`).

  ## Fix
  - Change `NEW.completion_date` → `NEW.completed_at`
  - Change `SET completion_date` → `SET date_completed`
*/

CREATE OR REPLACE FUNCTION update_job_on_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE jobs
    SET
      date_completed = NEW.completed_at,
      updated_at = now()
    WHERE id = NEW.job_id;
  END IF;

  RETURN NEW;
END;
$$;
