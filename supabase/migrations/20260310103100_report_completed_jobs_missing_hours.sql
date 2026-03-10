/*
  # One-time report for completed jobs missing hours_worked

  Run this query to identify legacy records that need manual backfill.
*/

SELECT
  id,
  business_id,
  client_name,
  job_type,
  job_status,
  date_completed,
  hours_worked,
  final_price,
  updated_at
FROM public.jobs
WHERE (job_status = 'completed' OR date_completed IS NOT NULL)
  AND hours_worked IS NULL
ORDER BY COALESCE(date_completed, DATE(updated_at)) DESC, updated_at DESC;
