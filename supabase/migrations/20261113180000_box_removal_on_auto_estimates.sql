/*
  # Box removal and cleanup on automatically created estimates

  ## Overview
  The admin invoice form starts every new invoice with a "Box Removal &
  Cleanup" labor line (1 x $30, not taxable). The draft estimate that
  `auto_create_job_and_estimate_from_inquiry` builds for each new inquiry
  skipped the form and so never got it. It now does, as a second line after
  the assembly line.

  ## Changes
  - `auto_create_job_and_estimate_from_inquiry`: one extra `invoice_line_items`
    row per estimate. Nothing else in the function changes.

  ## Notes
  - The estimate now totals $30 more than the inquiry's estimated price. The
    job's quoted_price is left as the inquiry's price.
  - Estimates created before this migration are not touched.
  - Privileges are unchanged (CREATE OR REPLACE keeps them).
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

    -- A test never belongs to a portal customer, so a real customer whose email
    -- is used in a test cannot see it in their portal.
    IF NOT v_is_test THEN
      SELECT id INTO v_customer_id
      FROM customers
      WHERE organization_id = NEW.organization_id
        AND lower(email) = lower(NEW.client_email)
      ORDER BY created_at ASC
      LIMIT 1;
    END IF;

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

    -- Same line the admin invoice form starts every new invoice with
    -- (BOX_REMOVAL_LINE_ITEM in src/services/invoiceService.ts).
    INSERT INTO invoice_line_items (
      invoice_id, item_type, description, quantity, unit_price, is_taxable, display_order
    ) VALUES (
      v_invoice_id, 'labor', 'Box Removal & Cleanup', 1, 30, false, 1
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
