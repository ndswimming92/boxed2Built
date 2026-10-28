/*
  # Auto-create a job and an estimate when an inquiry is submitted

  ## Overview
  Every new quote request (`form_inquiries` row) now gets a job and a draft
  estimate invoice created for it automatically, filled in from the inquiry,
  so none of it has to be keyed in by hand. The Convert to Job and Create
  Invoice buttons in the admin portal still work for anything the automation
  skipped or got wrong.

  ## What is created
  - `jobs`: job_status 'quoted', date_quoted today, quoted_price from the
    inquiry's estimated_price (the coupon is already netted out of it),
    description/notes/city/client type/referral source copied across. The
    customer's preferred date, time slot and estimated time go in the job
    notes only; the job is NOT scheduled and nothing is put on the calendar.
  - `invoices` + one `invoice_line_items` row: a draft 'estimate' with no due
    date, the business's default payment terms, tax rate and notes template.
    Drafts send nothing; the customer is not emailed.
  - `form_inquiries`: status 'converted_to_job' and converted_job_id set.

  ## Skipped
  - 'General Question' (Quick Contact) inquiries: not a quote request.
  - Test inquiries (is_test).
  - Inquiries that already carry a converted_job_id.

  ## Safety
  - AFTER INSERT, SECURITY DEFINER (anonymous visitors submit the form).
  - Any failure is caught and logged as a warning; the inquiry itself always
    saves. The job/invoice work is rolled back as a unit if it fails midway.
  - The invoice number is allocated inline instead of calling
    generate_next_invoice_number(), whose caller check would reject a
    signed-in portal customer submitting the form.
*/

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
BEGIN
  IF NEW.furniture_type = 'General Question'
     OR COALESCE(NEW.is_test, false)
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
      COALESCE(NULLIF(NEW.notes, ''), NEW.furniture_type || ' assembly - ' || v_pieces_label),
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
      referral_source, client_type, notes
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
      ), '')
    )
    RETURNING id INTO v_job_id;

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

    INSERT INTO invoices (
      organization_id, business_id, inquiry_id, job_id,
      invoice_number, invoice_type,
      client_name, client_email, client_phone,
      customer_id, client_id,
      invoice_date, due_date, payment_terms,
      tax_rate, notes, status, is_active
    ) VALUES (
      NEW.organization_id, NEW.business_id, NEW.id, v_job_id,
      v_number, 'estimate',
      NEW.client_name, NEW.client_email, NEW.client_phone,
      v_customer_id, NEW.client_id,
      CURRENT_DATE, NULL, COALESCE(v_settings.default_payment_terms, 'Net 30'),
      COALESCE(v_settings.default_tax_rate, 0), v_settings.invoice_notes_template, 'draft', true
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

DROP TRIGGER IF EXISTS trg_auto_create_job_and_estimate_from_inquiry ON form_inquiries;
CREATE TRIGGER trg_auto_create_job_and_estimate_from_inquiry
  AFTER INSERT ON form_inquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_job_and_estimate_from_inquiry();
