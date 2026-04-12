/*
  # Add public-safe all-time client hours metric on business_info

  ## Summary
  - Adds `business_info.total_client_hours_saved` to support public-page display.
  - Keeps the metric synchronized from `jobs` using a DB trigger for consistency.
  - Backfills existing businesses from current completed jobs data.

  ## Metric definition
  total_client_hours_saved = SUM(jobs.hours_worked)
  for jobs where:
    - jobs.business_id = business_info.id
    - jobs.is_active = true
    - jobs.job_status = 'completed'
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
      AND j.job_status = 'completed'
      AND j.hours_worked IS NOT NULL
  ), 0)
  WHERE bi.id = p_business_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_refresh_business_total_client_hours_saved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.refresh_business_total_client_hours_saved(NEW.business_id);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.business_id IS DISTINCT FROM NEW.business_id THEN
      PERFORM public.refresh_business_total_client_hours_saved(OLD.business_id);
      PERFORM public.refresh_business_total_client_hours_saved(NEW.business_id);
    ELSE
      PERFORM public.refresh_business_total_client_hours_saved(NEW.business_id);
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_business_total_client_hours_saved(OLD.business_id);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS refresh_business_total_client_hours_saved_on_jobs ON public.jobs;

CREATE TRIGGER refresh_business_total_client_hours_saved_on_jobs
AFTER INSERT OR UPDATE OR DELETE ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.trigger_refresh_business_total_client_hours_saved();

-- Backfill existing rows.
UPDATE public.business_info bi
SET total_client_hours_saved = COALESCE(hours_agg.total_hours, 0)
FROM (
  SELECT
    j.business_id,
    SUM(j.hours_worked) AS total_hours
  FROM public.jobs j
  WHERE j.is_active = true
    AND j.job_status = 'completed'
    AND j.hours_worked IS NOT NULL
  GROUP BY j.business_id
) AS hours_agg
WHERE bi.id = hours_agg.business_id;

UPDATE public.business_info
SET total_client_hours_saved = 0
WHERE total_client_hours_saved IS NULL;
