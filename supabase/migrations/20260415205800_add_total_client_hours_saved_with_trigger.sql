/*
  # Add Total Client Hours Saved to Business Info

  ## Summary
  Adds a `total_client_hours_saved` column to `business_info` that is automatically
  kept in sync with the sum of `hours_worked` from all active, completed jobs.

  ## New Columns
  - `business_info.total_client_hours_saved` (numeric 12,2) — running total of hours
    worked across all completed, active jobs for the business. Defaults to 0.

  ## New Functions
  - `refresh_business_total_client_hours_saved(p_business_id uuid)` — recalculates and
    stores the correct total for a given business. Called by the trigger and for backfill.

  ## New Triggers
  - `trg_sync_hours_saved_on_jobs` — fires AFTER INSERT, UPDATE, or DELETE on `jobs`
    and calls the refresh function so the stored total is always current.

  ## Notes
  1. Uses IF NOT EXISTS so the migration is safe to run multiple times.
  2. A one-time backfill UPDATE is included to seed existing data immediately.
  3. Only counts rows where is_active = true, date_completed IS NOT NULL, and
     hours_worked IS NOT NULL.
*/

ALTER TABLE public.business_info
ADD COLUMN IF NOT EXISTS total_client_hours_saved numeric(12,2) NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.refresh_business_total_client_hours_saved(p_business_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_business_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.business_info bi
  SET total_client_hours_saved = COALESCE((
    SELECT SUM(j.hours_worked)
    FROM public.jobs j
    WHERE j.business_id = bi.id
      AND j.is_active = true
      AND j.date_completed IS NOT NULL
      AND j.hours_worked IS NOT NULL
  ), 0)
  WHERE bi.id = p_business_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_fn_sync_hours_saved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_business_id := OLD.business_id;
  ELSE
    v_business_id := NEW.business_id;
  END IF;

  PERFORM public.refresh_business_total_client_hours_saved(v_business_id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_hours_saved_on_jobs ON public.jobs;

CREATE TRIGGER trg_sync_hours_saved_on_jobs
AFTER INSERT OR UPDATE OR DELETE ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.trg_fn_sync_hours_saved();

UPDATE public.business_info bi
SET total_client_hours_saved = COALESCE((
  SELECT SUM(j.hours_worked)
  FROM public.jobs j
  WHERE j.business_id = bi.id
    AND j.is_active = true
    AND j.date_completed IS NOT NULL
    AND j.hours_worked IS NOT NULL
), 0);
