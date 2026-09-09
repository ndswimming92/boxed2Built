/*
  # Record who referred whom

  ## Overview
  `add_referral_credit_on_inquiry_insert` has always paid the referrer their $25
  when a referral code is used, but it never wrote the other half: the new
  client's `referred_by_client_id` stayed null. The column and its foreign key
  have existed since `20260310201908_add_referral_system.sql`, so the referral
  graph the admin UI reads has simply been empty.

  ## 1. Changes
    - `add_referral_credit_on_inquiry_insert` now also sets
      `referred_by_client_id` on the client the inquiry belongs to.
    - A self-referral - somebody entering their own code - is no longer treated
      as a referral at all. It previously paid out, which made a client's own
      code a way to mint $25 per inquiry, and recording it would have written a
      row pointing at itself.
    - Backfills the graph from inquiries already on file.

  ## 2. Why this works here
  `trg_auto_create_client_from_inquiry` is a BEFORE INSERT trigger that sets
  `NEW.client_id` (see `20260207053745_auto_create_client_from_inquiry.sql`).
  By the time this AFTER INSERT trigger runs, the inquiry's client already
  exists and its id is on the row, so no second lookup is needed.

  ## 3. Notes
    - First referral wins: the update only touches rows where
      `referred_by_client_id` is still null, so a repeat customer's later
      inquiry cannot rewrite who introduced them.
    - Credit behaviour is otherwise unchanged, including the existing skip for
      test submissions and for codes that match no client.
    - No schema change: column, index and foreign key all already exist.
*/

CREATE OR REPLACE FUNCTION add_referral_credit_on_inquiry_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_client_id uuid;
  v_referral_code text;
  v_credit_amount numeric(10,2) := 25.00;
BEGIN
  IF COALESCE(NEW.is_test, false) THEN
    RETURN NEW;
  END IF;

  v_referral_code := upper(trim(COALESCE(NEW.referral_code_used, '')));

  IF v_referral_code = '' THEN
    RETURN NEW;
  END IF;

  SELECT c.id
  INTO v_referrer_client_id
  FROM clients c
  WHERE upper(c.referral_code) = v_referral_code
  LIMIT 1;

  IF v_referrer_client_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Entering your own code is not a referral. Paying it out made a client's
  -- own code worth $25 an inquiry, and recording it would point a client at
  -- themselves.
  IF NEW.client_id IS NOT NULL AND NEW.client_id = v_referrer_client_id THEN
    RETURN NEW;
  END IF;

  UPDATE clients
  SET
    referral_credit_balance = round((COALESCE(referral_credit_balance, 0) + v_credit_amount)::numeric, 2),
    updated_at = now()
  WHERE id = v_referrer_client_id;

  -- The other half of the referral: who introduced this client. First referral
  -- wins, so a later inquiry cannot rewrite it.
  IF NEW.client_id IS NOT NULL THEN
    UPDATE clients
    SET
      referred_by_client_id = v_referrer_client_id,
      updated_at = now()
    WHERE id = NEW.client_id
      AND referred_by_client_id IS NULL
      AND id <> v_referrer_client_id;
  END IF;

  RETURN NEW;
END;
$$;

-- The trigger itself is unchanged; recreated so this migration stands alone.
DROP TRIGGER IF EXISTS trg_add_referral_credit_on_inquiry_insert ON form_inquiries;
CREATE TRIGGER trg_add_referral_credit_on_inquiry_insert
  AFTER INSERT ON form_inquiries
  FOR EACH ROW
  EXECUTE FUNCTION add_referral_credit_on_inquiry_insert();

-- ---------------------------------------------------------------------------
-- Backfill: rebuild the graph from inquiries already on file.
--
-- Credit is deliberately NOT replayed - those payouts already happened, and
-- running them again would double every historical referral. This writes
-- attribution only.
-- ---------------------------------------------------------------------------

WITH first_referral AS (
  SELECT DISTINCT ON (fi.client_id)
    fi.client_id,
    ref.id AS referrer_id
  FROM form_inquiries fi
  JOIN clients ref
    ON upper(ref.referral_code) = upper(trim(fi.referral_code_used))
  WHERE fi.client_id IS NOT NULL
    AND COALESCE(fi.is_test, false) = false
    AND COALESCE(trim(fi.referral_code_used), '') <> ''
    AND ref.id <> fi.client_id
  -- Earliest inquiry first, matching the trigger's first-referral-wins rule.
  ORDER BY fi.client_id, fi.created_at
)
UPDATE clients c
SET
  referred_by_client_id = fr.referrer_id,
  updated_at = now()
FROM first_referral fr
WHERE c.id = fr.client_id
  AND c.referred_by_client_id IS NULL
  -- Do not close a loop against an edge that already exists.
  AND NOT EXISTS (
    SELECT 1 FROM clients r
    WHERE r.id = fr.referrer_id
      AND r.referred_by_client_id = c.id
  );
