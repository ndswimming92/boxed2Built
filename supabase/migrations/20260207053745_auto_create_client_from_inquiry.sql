/*
  # Auto-Create Clients from Form Inquiries

  ## Overview
  Automatically creates or links a client record whenever a new form inquiry
  is submitted. This ensures every inquiry is associated with a client profile
  for unified relationship tracking.

  ## 1. Schema Changes
    - `form_inquiries`
      - `client_id` (uuid, nullable) - Foreign key to `clients(id)`, set
        automatically by the trigger on insert

  ## 2. New Trigger Function
    - `auto_create_client_from_inquiry()` - BEFORE INSERT trigger on
      `form_inquiries` that:
        - Calls `upsert_client_by_email` to find or create a client
        - Sets `NEW.client_id` to the returned client ID
        - Updates the client's `last_contact_date`
        - Sets `first_contact_date` only if previously NULL
        - Creates a `client_note` summarising the inquiry context

  ## 3. Backfill
    - Processes all existing `form_inquiries` rows to link them to clients
    - Creates summary notes for each backfilled inquiry

  ## 4. Security
    - Trigger function is SECURITY DEFINER (bypasses RLS to write clients
      and notes during anonymous form submissions)
    - No new RLS policies needed; existing policies on `clients` and
      `client_notes` remain unchanged

  ## 5. Important Notes
    - The trigger runs for both anonymous and authenticated inserts
    - Duplicate emails are handled by `upsert_client_by_email` (finds existing)
    - Quick Contact inquiries (furniture_type = 'General Question') get a
      distinct note format
*/

-- 1. Add client_id column to form_inquiries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'form_inquiries' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE form_inquiries ADD COLUMN client_id uuid REFERENCES clients(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Create index for efficient joins
CREATE INDEX IF NOT EXISTS idx_form_inquiries_client_id ON form_inquiries(client_id);

-- 3. Create trigger function
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
  -- Determine the source label for the client record
  v_source := COALESCE(NEW.source, 'contact_form');

  -- Use existing upsert function to find or create the client
  v_client_id := upsert_client_by_email(
    NEW.organization_id,
    NEW.client_email,
    NEW.client_name,
    NEW.client_phone,
    NULL,
    v_source
  );

  -- Link the inquiry to the client
  NEW.client_id := v_client_id;

  -- Update client contact dates
  UPDATE clients
  SET
    last_contact_date = now(),
    first_contact_date = COALESCE(first_contact_date, now())
  WHERE id = v_client_id;

  -- Build a summary note
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

  -- Insert the client note (bypass RLS via SECURITY DEFINER)
  INSERT INTO client_notes (organization_id, client_id, note, created_by)
  VALUES (NEW.organization_id, v_client_id, v_note_text, NULL);

  RETURN NEW;
END;
$$;

-- 4. Attach the trigger
DROP TRIGGER IF EXISTS trg_auto_create_client_from_inquiry ON form_inquiries;
CREATE TRIGGER trg_auto_create_client_from_inquiry
  BEFORE INSERT ON form_inquiries
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_client_from_inquiry();

-- 5. Backfill existing inquiries
DO $$
DECLARE
  r RECORD;
  v_client_id uuid;
  v_note_text text;
BEGIN
  FOR r IN
    SELECT id, organization_id, client_name, client_email, client_phone,
           furniture_type, pieces, preferred_date, notes, source, submission_date
    FROM form_inquiries
    WHERE client_id IS NULL
      AND client_email IS NOT NULL
      AND organization_id IS NOT NULL
    ORDER BY submission_date ASC
  LOOP
    -- Find or create client
    v_client_id := upsert_client_by_email(
      r.organization_id,
      r.client_email,
      r.client_name,
      r.client_phone,
      NULL,
      COALESCE(r.source, 'contact_form')
    );

    -- Link the inquiry
    UPDATE form_inquiries SET client_id = v_client_id WHERE id = r.id;

    -- Update client contact dates
    UPDATE clients
    SET
      last_contact_date = GREATEST(COALESCE(last_contact_date, r.submission_date), r.submission_date),
      first_contact_date = LEAST(COALESCE(first_contact_date, r.submission_date), r.submission_date)
    WHERE id = v_client_id;

    -- Build summary note
    IF r.furniture_type = 'General Question' THEN
      v_note_text := 'General inquiry via Quick Contact';
      IF r.notes IS NOT NULL AND r.notes != '' THEN
        v_note_text := v_note_text || ': ' || LEFT(r.notes, 500);
      END IF;
    ELSE
      v_note_text := 'Form inquiry - ' || r.furniture_type
        || ', ' || r.pieces || ' piece' || CASE WHEN r.pieces != 1 THEN 's' ELSE '' END;

      IF r.preferred_date IS NOT NULL THEN
        v_note_text := v_note_text || ', preferred date: ' || r.preferred_date::text;
      END IF;

      IF r.notes IS NOT NULL AND r.notes != '' THEN
        v_note_text := v_note_text || '. Notes: ' || LEFT(r.notes, 400);
      END IF;
    END IF;

    -- Insert backfill note
    INSERT INTO client_notes (organization_id, client_id, note, created_by)
    VALUES (r.organization_id, v_client_id, v_note_text, NULL);
  END LOOP;
END $$;
