/*
  # Fix Phone-Only Client Linking (Comprehensive)

  ## Problem
  Jobs with only a phone number (email = "NA") are never linked to clients
  because `upsert_client_by_email` rejects invalid emails and returns NULL.
  This leaves Natalie (3 jobs), Tania S., Cathy Hammock, Cheryl R.,
  Samantha & Taylor Moore, and Tina Allen with no client record.

  ## Changes

  1. New function `upsert_client_by_phone` — finds or creates a client by
     normalised phone number when no valid email is present.

  2. New function `normalize_phone` — strips all non-digit characters so
     "(615) 218-9760", "615-218-9760", and "6152189760" all match.

  3. Updated trigger function `auto_upsert_client_from_job` — tries email
     first (existing path), then falls back to phone.

  4. Backfill — links all currently unlinked jobs that have a valid phone.
     Natalie's 3 jobs link to her existing client record via phone match.

  5. Recalculates metrics for all affected clients.
*/

-- 1. Phone normalisation helper
CREATE OR REPLACE FUNCTION normalize_phone(p_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
AS $$
  SELECT REGEXP_REPLACE(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
$$;

-- 2. Upsert client by phone
CREATE OR REPLACE FUNCTION upsert_client_by_phone(
  p_organization_id uuid,
  p_phone           text,
  p_name            text    DEFAULT NULL,
  p_source          text    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id    uuid;
  v_existing_name text;
  v_clean_phone  text;
BEGIN
  v_clean_phone := normalize_phone(p_phone);

  -- Reject empty / too-short phone strings
  IF length(v_clean_phone) < 7 THEN
    RETURN NULL;
  END IF;

  -- Try to find an existing client whose normalised phone matches
  SELECT id, name INTO v_client_id, v_existing_name
  FROM clients
  WHERE organization_id = p_organization_id
    AND normalize_phone(phone) = v_clean_phone
  LIMIT 1;

  IF v_client_id IS NOT NULL THEN
    -- Update name only if currently NULL
    UPDATE clients
    SET
      name       = COALESCE(name, p_name),
      source     = COALESCE(source, p_source),
      updated_at = now()
    WHERE id = v_client_id;
    RETURN v_client_id;
  ELSE
    -- Create new phone-only client
    INSERT INTO clients (
      organization_id,
      name,
      phone,
      source,
      preferences_token
    ) VALUES (
      p_organization_id,
      COALESCE(p_name, 'Unknown'),
      p_phone,
      p_source,
      generate_preferences_token()
    )
    RETURNING id INTO v_client_id;
    RETURN v_client_id;
  END IF;
END;
$$;

-- 3. Update the job trigger to fall back to phone
CREATE OR REPLACE FUNCTION auto_upsert_client_from_job()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id  uuid;
  v_clean_email text;
  v_clean_phone text;
BEGIN
  IF NEW.client_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_clean_email := LOWER(TRIM(COALESCE(NEW.client_email, '')));
  v_clean_phone := normalize_phone(NEW.client_phone);

  -- Try email first
  IF v_clean_email NOT IN ('', 'na', 'n/a', 'none', 'null', '-', 'test@test.com', 'test@example.com') THEN
    v_client_id := upsert_client_by_email(
      NEW.organization_id,
      NEW.client_email,
      NEW.client_name,
      NEW.client_phone,
      NEW.location_city,
      'job_creation'
    );
  END IF;

  -- Fall back to phone if email didn't produce a client
  IF v_client_id IS NULL AND length(v_clean_phone) >= 7 THEN
    v_client_id := upsert_client_by_phone(
      NEW.organization_id,
      NEW.client_phone,
      NEW.client_name,
      'job_creation'
    );
  END IF;

  IF v_client_id IS NOT NULL THEN
    NEW.client_id := v_client_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Re-attach trigger (already exists, function body updated above)
DROP TRIGGER IF EXISTS trigger_auto_upsert_client_from_job ON jobs;
CREATE TRIGGER trigger_auto_upsert_client_from_job
  BEFORE INSERT OR UPDATE OF client_email, client_name, client_phone
  ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION auto_upsert_client_from_job();

-- 4. Backfill all currently unlinked jobs that have a valid phone or email
DO $$
DECLARE
  v_job       record;
  v_org_id    uuid;
  v_client_id uuid;
  v_clean_email text;
  v_clean_phone text;
BEGIN
  SELECT id INTO v_org_id FROM organizations ORDER BY created_at LIMIT 1;

  FOR v_job IN
    SELECT id,
           client_email,
           client_name,
           client_phone,
           location_city,
           COALESCE(organization_id, v_org_id) AS org_id
    FROM jobs
    WHERE client_id IS NULL
      AND (
        (client_phone IS NOT NULL AND length(normalize_phone(client_phone)) >= 7)
        OR
        (client_email IS NOT NULL AND LOWER(TRIM(client_email)) NOT IN ('', 'na', 'n/a', 'none', 'null', '-'))
      )
  LOOP
    BEGIN
      v_client_id   := NULL;
      v_clean_email := LOWER(TRIM(COALESCE(v_job.client_email, '')));
      v_clean_phone := normalize_phone(v_job.client_phone);

      -- Try email first
      IF v_clean_email NOT IN ('', 'na', 'n/a', 'none', 'null', '-', 'test@test.com', 'test@example.com') THEN
        v_client_id := upsert_client_by_email(
          v_job.org_id,
          v_job.client_email,
          v_job.client_name,
          v_job.client_phone,
          v_job.location_city,
          'job_creation'
        );
      END IF;

      -- Fall back to phone
      IF v_client_id IS NULL AND length(v_clean_phone) >= 7 THEN
        v_client_id := upsert_client_by_phone(
          v_job.org_id,
          v_job.client_phone,
          v_job.client_name,
          'job_creation'
        );
      END IF;

      IF v_client_id IS NOT NULL THEN
        UPDATE jobs SET client_id = v_client_id WHERE id = v_job.id;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not link job % : %', v_job.id, SQLERRM;
    END;
  END LOOP;
END $$;

-- 5. Recalculate metrics for all clients
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
