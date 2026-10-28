/*
  # Admin test inquiries

  ## Overview
  The admin portal can now submit a test inquiry as if a customer had used the
  main form. A test inquiry (`form_inquiries.is_test`) already existed; this
  migration carries the flag through everything a real inquiry creates so a test
  can be followed end to end without touching a single metric.

  ## Changes
  - `jobs.is_test` and `invoices.is_test` (boolean, default false).
  - `auto_create_client_from_inquiry`: a client created by a test inquiry is
    flagged `is_test`, so the Clients list and its metrics skip it. An existing
    real client with the same email is left alone.
  - `auto_create_job_and_estimate_from_inquiry`: test inquiries now get a job and
    a draft estimate too, both flagged `is_test`. The estimate is numbered
    TEST-xxxxxx and does not consume a number from `invoice_settings`, so real
    invoice numbering never skips.
  - `refresh_business_total_client_hours_saved` and `update_client_metrics`
    ignore test jobs. The first feeds a public figure on the website.
  - `delete_test_inquiries(p_business_id)`: admin-only clean-up that removes every
    test inquiry with the job, estimate, saved request and client it created.

  ## Safety
  - Existing rows default to `is_test = false`; nothing changes for real data.
  - Trigger functions keep their existing privileges (CREATE OR REPLACE).
*/

ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- Client created from an inquiry is a test client when the inquiry is a test.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auto_create_client_from_inquiry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_note_text text;
  v_source text;
  v_existed boolean := false;
BEGIN
  v_source := COALESCE(NEW.source, 'contact_form');

  IF COALESCE(NEW.is_test, false) THEN
    SELECT EXISTS (
      SELECT 1 FROM clients
      WHERE organization_id = NEW.organization_id
        AND lower(email) = lower(NEW.client_email)
    ) INTO v_existed;
  END IF;

  v_client_id := upsert_client_by_email(
    NEW.organization_id,
    NEW.client_email,
    NEW.client_name,
    NEW.client_phone,
    NULL,
    v_source
  );

  IF v_client_id IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.client_id := v_client_id;

  UPDATE clients
  SET
    last_contact_date  = now(),
    first_contact_date = COALESCE(first_contact_date, now()),
    is_test = CASE WHEN COALESCE(NEW.is_test, false) AND NOT v_existed THEN true ELSE is_test END
  WHERE id = v_client_id;

  IF NEW.furniture_type = 'General Question' THEN
    v_note_text := 'General inquiry via Quick Contact';
    IF NEW.notes IS NOT NULL AND NEW.notes != '' THEN
      v_note_text := v_note_text || ': ' || LEFT(NEW.notes, 500);
    END IF;
  ELSE
    v_note_text := 'Form inquiry - ' || NEW.furniture_type
      || ', ' || NEW.pieces || ' piece' || CASE WHEN NEW.pieces != 1 THEN 's' ELSE '' END;
    IF NEW.preferred_date IS NOT NULL THEN
      v_note_text := v_note_text || ', preferred date: ' || NEW.preferred_date::text;
    END IF;
    IF NEW.notes IS NOT NULL AND NEW.notes != '' THEN
      v_note_text := v_note_text || '. Notes: ' || LEFT(NEW.notes, 400);
    END IF;
  END IF;

  INSERT INTO client_notes (organization_id, client_id, note, created_by)
  VALUES (NEW.organization_id, v_client_id, v_note_text, NULL);

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Job + draft estimate for every quote request, test ones included (flagged).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_create_job_and_estimate_from_inquiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_price numeric;
  v_job_id uuid;
  v_invoice_id uuid;
  v_customer_id uuid;
  v_settings invoice_settings%ROWTYPE;
  v_number text;
  v_pieces_label text;
  v_description text;
  v_coupon_line text;
  v_is_test boolean := COALESCE(NEW.is_test, false);
BEGIN
  IF NEW.furniture_type = 'General Question'
     OR NEW.converted_job_id IS NOT NULL
     OR NEW.business_id IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_price := NULLIF(regexp_replace(COALESCE(NEW.estimated_price, ''), '[^0-9.]', '', 'g'), '')::numeric;
    v_pieces_label := NEW.pieces || CASE WHEN NEW.pieces = 1 THEN ' piece' ELSE ' pieces' END;

    v_coupon_line := CASE
      WHEN NEW.coupon_code IS NOT NULL AND NEW.coupon_discount_type IS NOT NULL THEN
        'Coupon ' || NEW.coupon_code || ' applied ('
        || CASE WHEN NEW.coupon_discount_type = 'percentage'
             THEN trim(trailing '.' FROM trim(trailing '0' FROM NEW.coupon_discount_value::numeric(10,2)::text)) || '% off'
             ELSE '$' || NEW.coupon_discount_value::numeric(10,2)::text || ' off' END
        || ').'
      ELSE NULL
    END;

    v_description := concat_ws(E'\n\n',
      CASE WHEN v_is_test THEN '[TEST] ' ELSE '' END
        || COALESCE(NULLIF(NEW.notes, ''), NEW.furniture_type || ' assembly - ' || v_pieces_label),
      v_coupon_line
    );

    SELECT id INTO v_customer_id
    FROM customers
    WHERE organization_id = NEW.organization_id
      AND lower(email) = lower(NEW.client_email)
    ORDER BY created_at ASC
    LIMIT 1;

    INSERT INTO jobs (
      business_id, organization_id, client_id, customer_id,
      client_name, client_email, client_phone,
      job_type, job_description, location_city,
      date_quoted, quoted_price, job_status,
      referral_source, client_type, notes, is_test
    ) VALUES (
      NEW.business_id, NEW.organization_id, NEW.client_id, v_customer_id,
      NEW.client_name, NEW.client_email, NEW.client_phone,
      NEW.furniture_type, v_description, NEW.user_city,
      CURRENT_DATE, v_price, 'quoted',
      COALESCE(NEW.source, 'contact_form'), COALESCE(NEW.client_type, 'residential'),
      NULLIF(concat_ws(E'\n',
        NULLIF(NEW.notes, ''),
        CASE WHEN NEW.preferred_date IS NOT NULL OR NEW.preferred_time_slot IS NOT NULL THEN
          'Customer prefers: ' || concat_ws(', ', NEW.preferred_date::text, NEW.preferred_time_slot)
        END,
        CASE WHEN NEW.estimated_time IS NOT NULL THEN 'Estimated time: ' || NEW.estimated_time END
      ), ''),
      v_is_test
    )
    RETURNING id INTO v_job_id;

    IF v_is_test THEN
      -- Never draws from invoice_settings, so real numbers stay consecutive.
      v_number := 'TEST-' || upper(substr(replace(NEW.id::text, '-', ''), 1, 6));
      SELECT * INTO v_settings FROM invoice_settings WHERE business_id = NEW.business_id;
    ELSE
      -- Same allocation as generate_next_invoice_number(), minus its caller check.
      SELECT * INTO v_settings FROM invoice_settings WHERE business_id = NEW.business_id FOR UPDATE;
      IF NOT FOUND THEN
        INSERT INTO invoice_settings (business_id, invoice_prefix, next_invoice_number)
        VALUES (NEW.business_id, 'B2B', 2)
        RETURNING * INTO v_settings;
        v_settings.next_invoice_number := 1;
      ELSE
        UPDATE invoice_settings
        SET next_invoice_number = next_invoice_number + 1, updated_at = now()
        WHERE business_id = NEW.business_id;
      END IF;
      v_number := v_settings.invoice_prefix || '-' || LPAD(v_settings.next_invoice_number::text, 3, '0');
    END IF;

    INSERT INTO invoices (
      organization_id, business_id, inquiry_id, job_id,
      invoice_number, invoice_type,
      client_name, client_email, client_phone,
      customer_id, client_id,
      invoice_date, due_date, payment_terms,
      tax_rate, notes, status, is_active, is_test
    ) VALUES (
      NEW.organization_id, NEW.business_id, NEW.id, v_job_id,
      v_number, 'estimate',
      NEW.client_name, NEW.client_email, NEW.client_phone,
      v_customer_id, NEW.client_id,
      CURRENT_DATE, NULL, COALESCE(v_settings.default_payment_terms, 'Net 30'),
      COALESCE(v_settings.default_tax_rate, 0), v_settings.invoice_notes_template, 'draft', true, v_is_test
    )
    RETURNING id INTO v_invoice_id;

    INSERT INTO invoice_line_items (
      invoice_id, item_type, description, quantity, unit_price, is_taxable, display_order
    ) VALUES (
      v_invoice_id, 'labor',
      NEW.furniture_type || ' assembly - ' || v_pieces_label
        || CASE WHEN v_coupon_line IS NOT NULL THEN ' (' || trim(trailing '.' FROM v_coupon_line) || ')' ELSE '' END,
      1, COALESCE(v_price, 0), false, 0
    );

    UPDATE form_inquiries
    SET status = 'converted_to_job', converted_job_id = v_job_id
    WHERE id = NEW.id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auto job/estimate for inquiry % failed: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_create_job_and_estimate_from_inquiry() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public "hours saved" figure ignores test jobs.
-- ---------------------------------------------------------------------------
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
      AND j.is_test = false
      AND j.date_completed IS NOT NULL
      AND j.hours_worked IS NOT NULL
  ), 0)
  WHERE bi.id = p_business_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Client metrics ignore test jobs (a real client's email may be used in a test).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_client_metrics(client_id_input uuid)
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
  SELECT email, last_followup_email_sent_at
  INTO v_client_email, v_followup_sent_at
  FROM clients
  WHERE id = client_id_input;

  -- Revenue from completed paid jobs (excludes free/pro-bono jobs)
  SELECT COALESCE(SUM(COALESCE(final_price, quoted_price, 0)), 0)
  INTO v_total_revenue
  FROM jobs
  WHERE client_id = client_id_input
    AND job_status = 'completed'
    AND is_free = false
    AND is_test = false;

  -- Count all completed jobs (including free)
  SELECT COUNT(*)
  INTO v_job_count
  FROM jobs
  WHERE client_id = client_id_input
    AND job_status = 'completed'
    AND is_test = false;

  v_first_contact := LEAST(
    COALESCE((SELECT MIN(created_at) FROM form_inquiries WHERE client_email = v_client_email AND v_client_email IS NOT NULL AND is_test = false), 'infinity'::timestamptz),
    COALESCE((SELECT MIN(created_at) FROM jobs WHERE client_id = client_id_input AND is_test = false), 'infinity'::timestamptz)
  );
  IF v_first_contact = 'infinity'::timestamptz THEN
    v_first_contact := NULL;
  END IF;

  v_last_contact := GREATEST(
    COALESCE((SELECT MAX(created_at) FROM form_inquiries WHERE client_email = v_client_email AND v_client_email IS NOT NULL AND is_test = false), '-infinity'::timestamptz),
    COALESCE((SELECT MAX(updated_at) FROM jobs WHERE client_id = client_id_input AND is_test = false), '-infinity'::timestamptz),
    COALESCE((SELECT MAX(updated_at) FROM invoices WHERE client_id = client_id_input AND is_test = false), '-infinity'::timestamptz),
    COALESCE(v_followup_sent_at, '-infinity'::timestamptz)
  );
  IF v_last_contact = '-infinity'::timestamptz THEN
    v_last_contact := NULL;
  END IF;

  SELECT MAX(date_completed)
  INTO v_last_job
  FROM jobs
  WHERE client_id = client_id_input
    AND job_status = 'completed'
    AND is_test = false;

  IF v_job_count >= 2 THEN
    v_status := 'repeat';
  ELSIF v_job_count >= 1 THEN
    IF v_last_contact < (now() - interval '90 days') THEN
      v_status := 'dormant';
    ELSE
      v_status := 'active';
    END IF;
  ELSIF v_last_contact IS NOT NULL AND v_last_contact < (now() - interval '90 days') THEN
    v_status := 'dormant';
  ELSE
    v_status := 'lead';
  END IF;

  SELECT array_agg(total_revenue ORDER BY total_revenue DESC)
  INTO v_all_revenue
  FROM clients
  WHERE organization_id = (SELECT organization_id FROM clients WHERE id = client_id_input)
    AND total_revenue > 0
    AND is_test = false;

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

-- ---------------------------------------------------------------------------
-- One-click clean-up of everything a test inquiry created.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_test_inquiries(p_business_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_deleted integer;
  v_emails text[];
BEGIN
  SELECT organization_id INTO v_org FROM business_info WHERE id = p_business_id;

  IF v_org IS NULL OR NOT public.is_organization_member(v_org) THEN
    RAISE EXCEPTION 'Not authorized to delete test inquiries';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT lower(client_email)), ARRAY[]::text[])
  INTO v_emails
  FROM form_inquiries
  WHERE business_id = p_business_id AND is_test = true;

  -- Line items go with their invoice (ON DELETE CASCADE).
  DELETE FROM invoices WHERE business_id = p_business_id AND is_test = true;
  DELETE FROM jobs WHERE business_id = p_business_id AND is_test = true;
  DELETE FROM saved_requests WHERE business_id = p_business_id AND is_test = true;

  DELETE FROM form_inquiries WHERE business_id = p_business_id AND is_test = true;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- Clients a test inquiry created, once nothing real points at them.
  DELETE FROM clients c
  WHERE c.organization_id = v_org
    AND c.is_test = true
    AND lower(c.email) = ANY (v_emails)
    AND NOT EXISTS (SELECT 1 FROM form_inquiries fi WHERE fi.client_id = c.id)
    AND NOT EXISTS (SELECT 1 FROM jobs j WHERE j.client_id = c.id)
    AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.client_id = c.id);

  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_test_inquiries(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_test_inquiries(uuid) TO authenticated;
