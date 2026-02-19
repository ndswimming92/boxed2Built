/*
  # Fix Client Revenue to Use Completed Jobs

  ## Summary
  Changes the `update_client_metrics` function so that `total_revenue` is
  calculated from `final_price` on completed jobs instead of from paid invoices.
  Also adds a trigger on the `jobs` table so metrics stay automatically in sync
  whenever a job's status or price changes, and backfills all existing clients.

  ## Changes
  1. `update_client_metrics` function - revenue source changed from paid invoices
     to SUM(final_price) on jobs WHERE job_status = 'completed'
  2. New trigger `jobs_update_client_metrics_trigger` on jobs table
  3. Backfill: calls update_client_metrics for every existing client
*/

-- 1. Replace update_client_metrics with completed-jobs revenue
CREATE OR REPLACE FUNCTION public.update_client_metrics(client_id_input uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
v_total_revenue decimal(10,2);
v_job_count integer;
v_first_contact timestamptz;
v_last_contact timestamptz;
v_last_job timestamptz;
v_status client_status;
v_tier client_value_tier;
v_all_revenue decimal[];
v_vip_threshold decimal(10,2);
v_high_value_threshold decimal(10,2);
v_client_email text;
BEGIN
SELECT email INTO v_client_email FROM clients WHERE id = client_id_input;

-- Revenue = sum of final_price on completed jobs
SELECT COALESCE(SUM(COALESCE(final_price, 0)), 0)
INTO v_total_revenue
FROM jobs
WHERE client_id = client_id_input
AND job_status = 'completed';

-- Count completed jobs
SELECT COUNT(*)
INTO v_job_count
FROM jobs
WHERE client_id = client_id_input
AND job_status = 'completed';

-- First contact date
SELECT LEAST(
  COALESCE((SELECT MIN(created_at) FROM form_inquiries WHERE client_email = v_client_email AND client_email IS NOT NULL), 'infinity'::timestamptz),
  COALESCE((SELECT MIN(created_at) FROM jobs WHERE client_id = client_id_input), 'infinity'::timestamptz)
)
INTO v_first_contact
WHERE 'infinity'::timestamptz NOT IN (
  COALESCE((SELECT MIN(created_at) FROM form_inquiries WHERE client_email = v_client_email AND client_email IS NOT NULL), 'infinity'::timestamptz),
  COALESCE((SELECT MIN(created_at) FROM jobs WHERE client_id = client_id_input), 'infinity'::timestamptz)
);

-- Last contact date
SELECT GREATEST(
  COALESCE((SELECT MAX(created_at) FROM form_inquiries WHERE client_email = v_client_email AND client_email IS NOT NULL), '-infinity'::timestamptz),
  COALESCE((SELECT MAX(updated_at) FROM jobs WHERE client_id = client_id_input), '-infinity'::timestamptz),
  COALESCE((SELECT MAX(updated_at) FROM invoices WHERE client_id = client_id_input), '-infinity'::timestamptz)
)
INTO v_last_contact
WHERE '-infinity'::timestamptz NOT IN (
  COALESCE((SELECT MAX(created_at) FROM form_inquiries WHERE client_email = v_client_email AND client_email IS NOT NULL), '-infinity'::timestamptz),
  COALESCE((SELECT MAX(updated_at) FROM jobs WHERE client_id = client_id_input), '-infinity'::timestamptz),
  COALESCE((SELECT MAX(updated_at) FROM invoices WHERE client_id = client_id_input), '-infinity'::timestamptz)
);

-- Last job completion date
SELECT MAX(date_completed)
INTO v_last_job
FROM jobs
WHERE client_id = client_id_input
AND job_status = 'completed';

-- Client status
IF v_job_count >= 2 THEN
  v_status := 'repeat';
ELSIF v_job_count >= 1 THEN
  IF v_last_contact < (now() - interval '90 days') THEN
    v_status := 'dormant';
  ELSE
    v_status := 'active';
  END IF;
ELSIF v_last_contact < (now() - interval '90 days') THEN
  v_status := 'dormant';
ELSE
  v_status := 'lead';
END IF;

-- Value tier
SELECT array_agg(total_revenue ORDER BY total_revenue DESC)
INTO v_all_revenue
FROM clients
WHERE organization_id = (SELECT organization_id FROM clients WHERE id = client_id_input)
AND total_revenue > 0;

IF v_all_revenue IS NOT NULL AND array_length(v_all_revenue, 1) > 0 THEN
  v_vip_threshold := v_all_revenue[GREATEST(1, CEIL(array_length(v_all_revenue, 1) * 0.1)::integer)];
  v_high_value_threshold := v_all_revenue[GREATEST(1, CEIL(array_length(v_all_revenue, 1) * 0.3)::integer)];

  IF v_total_revenue >= v_vip_threshold THEN
    v_tier := 'vip';
  ELSIF v_total_revenue >= v_high_value_threshold THEN
    v_tier := 'high_value';
  ELSE
    v_tier := 'standard';
  END IF;
ELSE
  v_tier := 'standard';
END IF;

-- Update client record
UPDATE clients
SET
  total_revenue = v_total_revenue,
  job_count = v_job_count,
  average_job_value = CASE
    WHEN v_job_count > 0 THEN v_total_revenue / v_job_count
    ELSE 0
  END,
  first_contact_date = COALESCE(first_contact_date, v_first_contact),
  last_contact_date = v_last_contact,
  last_job_date = v_last_job,
  client_status = v_status,
  client_value_tier = v_tier,
  updated_at = now()
WHERE id = client_id_input;
END;
$$;

-- 2. Trigger function for auto-updating client metrics when jobs change
CREATE OR REPLACE FUNCTION public.trigger_update_client_metrics_from_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.client_id IS NOT NULL THEN
      PERFORM update_client_metrics(OLD.client_id);
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.client_id IS NOT NULL THEN
      PERFORM update_client_metrics(NEW.client_id);
    END IF;
  ELSE
    IF OLD.client_id IS NOT NULL THEN
      PERFORM update_client_metrics(OLD.client_id);
    END IF;
    IF NEW.client_id IS NOT NULL AND NEW.client_id IS DISTINCT FROM OLD.client_id THEN
      PERFORM update_client_metrics(NEW.client_id);
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 3. Attach trigger to jobs table
DROP TRIGGER IF EXISTS jobs_update_client_metrics_trigger ON jobs;
CREATE TRIGGER jobs_update_client_metrics_trigger
AFTER INSERT OR UPDATE OF job_status, final_price, client_id OR DELETE
ON jobs
FOR EACH ROW
EXECUTE FUNCTION trigger_update_client_metrics_from_job();

-- 4. Backfill all existing clients
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM clients LOOP
    PERFORM update_client_metrics(r.id);
  END LOOP;
END;
$$;
