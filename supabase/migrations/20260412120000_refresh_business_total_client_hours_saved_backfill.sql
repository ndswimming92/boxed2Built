-- 1) Update refresh function to match Admin logic
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

-- 2) Backfill all businesses now
UPDATE public.business_info bi
SET total_client_hours_saved = COALESCE(hours_agg.total_hours, 0)
FROM (
  SELECT
    j.business_id,
    SUM(j.hours_worked) AS total_hours
  FROM public.jobs j
  WHERE j.is_active = true
    AND j.date_completed IS NOT NULL
    AND j.hours_worked IS NOT NULL
  GROUP BY j.business_id
) AS hours_agg
WHERE bi.id = hours_agg.business_id;

-- 3) Ensure rows with no completed jobs are zero
UPDATE public.business_info
SET total_client_hours_saved = 0
WHERE total_client_hours_saved IS NULL;
