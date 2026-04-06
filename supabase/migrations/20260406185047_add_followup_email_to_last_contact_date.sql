/*
  # Include follow-up email timestamp in last_contact_date calculation

  ## Summary
  Updates the `update_client_metrics` function to factor in `last_followup_email_sent_at`
  when computing a client's `last_contact_date`. This ensures that when a thank-you
  follow-up email is sent to a client, it is reflected as the most recent contact signal
  and surfaces correctly in the sorted admin Clients table.

  ## Changes
  - **Modified function:** `update_client_metrics`
    - The `GREATEST()` calculation for `v_last_contact` now includes a fourth candidate:
      `last_followup_email_sent_at` from the `clients` row itself.
    - The NULL guard (`WHERE '-infinity' NOT IN (...)`) is replaced with a simpler
      `NULLIF(..., '-infinity')` approach for correctness and clarity.

  ## Important Notes
  1. No table schema changes — `last_followup_email_sent_at` already exists on the
     `clients` table (added in migration 20260406171709).
  2. The function is replaced in full (`CREATE OR REPLACE`) so no other migrations
     need to change.
  3. Existing `last_contact_date` values are NOT back-filled here; they will be updated
     the next time `update_client_metrics` is called for each client (e.g. on the next
     job save, invoice save, or manual refresh).
*/

CREATE OR REPLACE FUNCTION update_client_metrics(client_id_input uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  v_followup_sent_at timestamptz;
BEGIN
  -- Get client email and follow-up email timestamp for lookups
  SELECT email, last_followup_email_sent_at
  INTO v_client_email, v_followup_sent_at
  FROM clients
  WHERE id = client_id_input;

  -- Calculate total revenue from paid invoices
  SELECT COALESCE(SUM(total_amount), 0)
  INTO v_total_revenue
  FROM invoices
  WHERE client_id = client_id_input
    AND status = 'paid';

  -- Count completed jobs
  SELECT COUNT(*)
  INTO v_job_count
  FROM jobs
  WHERE client_id = client_id_input
    AND status = 'completed';

  -- Get first contact date (earliest inquiry or job)
  SELECT LEAST(
    COALESCE((SELECT MIN(created_at) FROM form_inquiries WHERE email = v_client_email AND email IS NOT NULL), 'infinity'::timestamptz),
    COALESCE((SELECT MIN(created_at) FROM jobs WHERE client_id = client_id_input), 'infinity'::timestamptz)
  )
  INTO v_first_contact
  WHERE 'infinity'::timestamptz NOT IN (
    COALESCE((SELECT MIN(created_at) FROM form_inquiries WHERE email = v_client_email AND email IS NOT NULL), 'infinity'::timestamptz),
    COALESCE((SELECT MIN(created_at) FROM jobs WHERE client_id = client_id_input), 'infinity'::timestamptz)
  );

  -- Get last contact date (latest activity, including follow-up emails)
  SELECT NULLIF(
    GREATEST(
      COALESCE((SELECT MAX(created_at) FROM form_inquiries WHERE email = v_client_email AND email IS NOT NULL), '-infinity'::timestamptz),
      COALESCE((SELECT MAX(updated_at) FROM jobs WHERE client_id = client_id_input), '-infinity'::timestamptz),
      COALESCE((SELECT MAX(updated_at) FROM invoices WHERE client_id = client_id_input), '-infinity'::timestamptz),
      COALESCE(v_followup_sent_at, '-infinity'::timestamptz)
    ),
    '-infinity'::timestamptz
  )
  INTO v_last_contact;

  -- Get last job completion date
  SELECT MAX(completion_date)
  INTO v_last_job
  FROM jobs
  WHERE client_id = client_id_input
    AND status = 'completed';

  -- Determine client status
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

  -- Determine value tier (VIP = top 10%, High-Value = top 30%)
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
