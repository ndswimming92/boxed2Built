/*
  # Job addresses: the customer's address and where the work took place

  1. New columns on `jobs`
    - `client_address` (text) - the customer's address, mirrored from the linked client profile.
    - `service_address` (text) - where the work actually took place. NULL means "same as the
      client address", so a job that happens at the customer's address stays in sync with the
      profile instead of holding a stale copy.

  2. Address sync
    - `sync_job_addresses()` (BEFORE INSERT/UPDATE on jobs) trims blanks to NULL, carries the
      client profile address onto new or re-linked jobs, and collapses a service address that
      matches the client address back to NULL.
    - `push_job_address_to_client()` (AFTER INSERT/UPDATE on jobs) writes an address entered or
      corrected on a job back to the linked client profile.
    - `propagate_client_contact_changes()` now also pushes `clients.address` out to
      `jobs.client_address`, alongside the existing name/email/phone propagation. A job's own
      `service_address` is never touched, so where the work happened is preserved.
    - `auto_upsert_client_from_job()` now seeds a client's address from the job's client address
      instead of its city, so profiles no longer end up with a bare city name as their address.

  3. Backfill
    - Existing jobs linked to a client inherit that client's address.
*/

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS client_address text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS service_address text;

COMMENT ON COLUMN jobs.client_address IS
  'Customer address for this job, kept in sync with clients.address for the linked client.';
COMMENT ON COLUMN jobs.service_address IS
  'Where the work took place. NULL means it is the same as client_address.';

-- ---------------------------------------------------------------------------
-- Client profile address -> job
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_job_addresses()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_address text;
  v_pull_profile   boolean := false;
BEGIN
  NEW.client_address  := NULLIF(BTRIM(COALESCE(NEW.client_address, '')), '');
  NEW.service_address := NULLIF(BTRIM(COALESCE(NEW.service_address, '')), '');

  -- Carry the address over from the client profile when the job has none of its own.
  -- Limited to inserts and re-links so an address the user deliberately cleared on the
  -- job is never resurrected. TG_OP is checked in its own branch because OLD cannot be
  -- referenced during an INSERT.
  IF NEW.client_address IS NULL AND NEW.client_id IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      v_pull_profile := true;
    ELSIF NEW.client_id IS DISTINCT FROM OLD.client_id THEN
      v_pull_profile := true;
    END IF;
  END IF;

  IF v_pull_profile THEN
    SELECT NULLIF(BTRIM(COALESCE(address, '')), '')
    INTO v_client_address
    FROM clients
    WHERE id = NEW.client_id;

    NEW.client_address := v_client_address;
  END IF;

  -- "Worked at the customer's address" is stored as NULL rather than a copy, so the work
  -- location follows the client profile instead of going stale.
  IF NEW.service_address IS NOT NULL
     AND NEW.client_address IS NOT NULL
     AND LOWER(NEW.service_address) = LOWER(NEW.client_address) THEN
    NEW.service_address := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- Named to sort after trigger_auto_upsert_client_from_job: triggers of the same kind fire in
-- alphabetical order, so NEW.client_id has already been resolved by the time this runs.
DROP TRIGGER IF EXISTS trigger_sync_job_addresses ON jobs;
CREATE TRIGGER trigger_sync_job_addresses
  BEFORE INSERT OR UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION sync_job_addresses();

-- ---------------------------------------------------------------------------
-- Job -> client profile address
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.push_job_address_to_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.client_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- A new job without an address must not wipe the profile it was linked to.
    IF NEW.client_address IS NULL THEN
      RETURN NEW;
    END IF;
  ELSE
    -- Fires on UPDATE OF client_address even when the value is unchanged (and on re-links,
    -- where the BEFORE trigger may have filled it in), so compare before writing.
    IF NEW.client_address IS NOT DISTINCT FROM OLD.client_address THEN
      RETURN NEW;
    END IF;
  END IF;

  UPDATE clients
  SET address = NEW.client_address
  WHERE id = NEW.client_id
    AND address IS DISTINCT FROM NEW.client_address;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_push_job_address_to_client ON jobs;
CREATE TRIGGER trigger_push_job_address_to_client
  AFTER INSERT OR UPDATE OF client_address, client_id ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION push_job_address_to_client();

-- ---------------------------------------------------------------------------
-- Client contact propagation now covers the address as well
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.propagate_client_contact_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.name IS DISTINCT FROM NEW.name
     OR OLD.email IS DISTINCT FROM NEW.email
     OR OLD.phone IS DISTINCT FROM NEW.phone THEN

    UPDATE jobs
    SET
      client_name  = NEW.name,
      client_email = NEW.email,
      client_phone = NEW.phone
    WHERE client_id = NEW.id;

    UPDATE form_inquiries
    SET
      client_name  = NEW.name,
      client_email = COALESCE(NEW.email, client_email),
      client_phone = NEW.phone
    WHERE client_id = NEW.id;

    UPDATE invoices
    SET
      client_name  = NEW.name,
      client_email = NEW.email,
      client_phone = NEW.phone
    WHERE client_id = NEW.id;

  END IF;

  -- An address change follows the profile out to the client's jobs. Each job's own
  -- service address is left alone so where the work took place is preserved.
  IF OLD.address IS DISTINCT FROM NEW.address THEN
    UPDATE jobs
    SET client_address = NEW.address
    WHERE client_id = NEW.id
      AND client_address IS DISTINCT FROM NEW.address;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_client_contact_changes ON clients;
CREATE TRIGGER trg_propagate_client_contact_changes
  AFTER UPDATE ON clients
  FOR EACH ROW
  WHEN (
    OLD.name IS DISTINCT FROM NEW.name
    OR OLD.email IS DISTINCT FROM NEW.email
    OR OLD.phone IS DISTINCT FROM NEW.phone
    OR OLD.address IS DISTINCT FROM NEW.address
  )
  EXECUTE FUNCTION propagate_client_contact_changes();

-- ---------------------------------------------------------------------------
-- Auto-created clients get the job's address, not the job's city
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_upsert_client_from_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id   uuid;
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
      NULLIF(BTRIM(COALESCE(NEW.client_address, '')), ''),
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

-- ---------------------------------------------------------------------------
-- Backfill: existing jobs inherit their client's address
-- ---------------------------------------------------------------------------
UPDATE jobs j
SET client_address = NULLIF(BTRIM(c.address), '')
FROM clients c
WHERE j.client_id = c.id
  AND j.client_address IS NULL
  AND NULLIF(BTRIM(COALESCE(c.address, '')), '') IS NOT NULL;
