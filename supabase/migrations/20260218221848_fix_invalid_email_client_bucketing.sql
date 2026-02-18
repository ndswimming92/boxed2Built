/*
  # Fix Invalid Email Client Bucketing

  ## Problem
  Jobs with placeholder email values like "NA" were all linked to a single
  client record during the initial migration, because `upsert_client_by_email`
  treated "NA" as a legitimate email and merged every no-email job together.

  ## Changes

  1. Unlink all jobs/invoices whose `client_email` is a known placeholder.
  2. Delete the bogus "na" email client record (if nothing remains linked to it).
  3. Harden `upsert_client_by_email` to reject placeholder emails upfront.
  4. Harden the inquiry trigger to silently skip when no valid client is returned.
  5. Recalculate metrics for all remaining clients.
*/

-- 1. Unlink jobs that have placeholder emails
UPDATE jobs
SET client_id = NULL
WHERE LOWER(TRIM(COALESCE(client_email, ''))) IN ('na', 'n/a', 'none', 'null', '-', '');

-- 2. Unlink invoices with placeholder emails
UPDATE invoices
SET client_id = NULL
WHERE LOWER(TRIM(COALESCE(client_email, ''))) IN ('na', 'n/a', 'none', 'null', '-', '');

-- 3. Delete clients whose only email is a placeholder AND have no remaining linked records
DELETE FROM clients
WHERE LOWER(TRIM(COALESCE(email, ''))) IN ('na', 'n/a', 'none', 'null', '-', '')
  AND NOT EXISTS (SELECT 1 FROM jobs          WHERE jobs.client_id          = clients.id)
  AND NOT EXISTS (SELECT 1 FROM invoices      WHERE invoices.client_id      = clients.id)
  AND NOT EXISTS (SELECT 1 FROM form_inquiries WHERE form_inquiries.client_id = clients.id);

-- 4. Harden upsert_client_by_email to reject placeholder emails
--    (must match existing parameter name p_source)
CREATE OR REPLACE FUNCTION public.upsert_client_by_email(
  p_organization_id uuid,
  p_email text,
  p_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_source text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_existing_name text;
  v_clean_email text;
BEGIN
  v_clean_email := LOWER(TRIM(COALESCE(p_email, '')));

  -- Reject placeholder / invalid email values
  IF v_clean_email = ''
     OR v_clean_email IN ('na', 'n/a', 'none', 'null', '-', 'test@test.com', 'test@example.com') THEN
    RETURN NULL;
  END IF;

  p_email := v_clean_email;

  SELECT id, name INTO v_client_id, v_existing_name
  FROM clients
  WHERE organization_id = p_organization_id
    AND LOWER(email) = p_email;

  IF v_client_id IS NOT NULL THEN
    UPDATE clients
    SET
      name       = COALESCE(p_name, v_existing_name),
      phone      = COALESCE(p_phone, phone),
      address    = COALESCE(p_address, address),
      source     = COALESCE(source, p_source),
      updated_at = now()
    WHERE id = v_client_id;

    RETURN v_client_id;
  ELSE
    INSERT INTO clients (
      organization_id,
      email,
      name,
      phone,
      address,
      source,
      preferences_token
    ) VALUES (
      p_organization_id,
      p_email,
      p_name,
      p_phone,
      p_address,
      p_source,
      generate_preferences_token()
    )
    RETURNING id INTO v_client_id;

    RETURN v_client_id;
  END IF;
END;
$$;

-- 5. Harden the inquiry trigger to skip when upsert returns NULL
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
BEGIN
  v_source := COALESCE(NEW.source, 'contact_form');

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
    first_contact_date = COALESCE(first_contact_date, now())
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

-- 6. Recalculate metrics for all remaining clients
DO $$
DECLARE v_id uuid;
BEGIN
  FOR v_id IN SELECT id FROM clients LOOP
    BEGIN
      PERFORM update_client_metrics(v_id);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;
