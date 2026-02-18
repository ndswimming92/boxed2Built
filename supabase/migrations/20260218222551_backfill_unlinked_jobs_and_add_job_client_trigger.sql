/*
  # Backfill Unlinked Jobs & Auto-Link Future Jobs to Clients

  ## Problem
  Jobs added after the initial client migration (or missed during it) have
  `client_id = NULL` even when they contain a valid email. These clients never
  appear in the Clients portal.

  ## Changes

  1. Backfill: create a client record (or match existing) for every job that
     has a real email but no client_id, then link the job.

  2. New trigger `auto_upsert_client_from_job` — fires on INSERT and UPDATE of
     the jobs table. Whenever a job is saved with a valid email, it will
     automatically create or find the matching client and set client_id.

  ## Safety
  - Uses the existing `upsert_client_by_email` function (which already rejects
    placeholder emails like "NA").
  - Only touches jobs where client_id IS NULL and email is valid.
  - Recalculates client metrics after backfill.
*/

-- 1. Trigger function: auto-link job to client on insert/update
CREATE OR REPLACE FUNCTION auto_upsert_client_from_job()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
BEGIN
  -- Only act when there is a real email and client_id is not yet set
  IF NEW.client_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_client_id := upsert_client_by_email(
    NEW.organization_id,
    NEW.client_email,
    NEW.client_name,
    NEW.client_phone,
    NEW.location_city,
    'job_creation'
  );

  IF v_client_id IS NOT NULL THEN
    NEW.client_id := v_client_id;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Attach trigger to jobs table
DROP TRIGGER IF EXISTS trigger_auto_upsert_client_from_job ON jobs;
CREATE TRIGGER trigger_auto_upsert_client_from_job
  BEFORE INSERT OR UPDATE OF client_email, client_name, client_phone
  ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION auto_upsert_client_from_job();

-- 3. Backfill: run upsert for every job that has a real email but no client_id
DO $$
DECLARE
  v_job record;
  v_org_id uuid;
  v_client_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM organizations ORDER BY created_at LIMIT 1;

  FOR v_job IN
    SELECT id, client_email, client_name, client_phone, location_city,
           COALESCE(organization_id, v_org_id) AS org_id
    FROM jobs
    WHERE client_id IS NULL
      AND client_email IS NOT NULL
      AND LOWER(TRIM(client_email)) NOT IN ('na', 'n/a', 'none', 'null', '-', '')
  LOOP
    BEGIN
      v_client_id := upsert_client_by_email(
        v_job.org_id,
        v_job.client_email,
        v_job.client_name,
        v_job.client_phone,
        v_job.location_city,
        'job_creation'
      );

      IF v_client_id IS NOT NULL THEN
        UPDATE jobs SET client_id = v_client_id WHERE id = v_job.id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not link job % to client: %', v_job.id, SQLERRM;
    END;
  END LOOP;
END $$;

-- 4. Recalculate metrics for all clients
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
