-- Homepage metric verification checks
-- Run against the production Supabase database.

-- 1) Is stored homepage metric correct?
SELECT id, name, total_client_hours_saved
FROM public.business_info
WHERE is_active = true
ORDER BY updated_at DESC;

-- 2) How many active rows exist?
SELECT COUNT(*) AS active_business_info_rows
FROM public.business_info
WHERE is_active = true;

-- 3) What does admin-equivalent metric compute?
SELECT
  j.business_id,
  COALESCE(SUM(j.hours_worked), 0) AS admin_equivalent_hours
FROM public.jobs j
WHERE j.is_active = true
  AND j.date_completed IS NOT NULL
  AND j.hours_worked IS NOT NULL
GROUP BY j.business_id;
