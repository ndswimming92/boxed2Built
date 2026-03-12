/*
  # Automatically add referral credit when a referral code is used

  ## Summary
  - Adds a trigger on `form_inquiries` inserts.
  - When `referral_code_used` is present and matches an existing client referral code,
    the referring client's `referral_credit_balance` is incremented by $25.00.
  - Leaves manual credit adjustments fully intact (no changes to existing admin update flows).
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
  -- Ignore test inquiries and blank codes
  IF COALESCE(NEW.is_test, false) THEN
    RETURN NEW;
  END IF;

  v_referral_code := upper(trim(COALESCE(NEW.referral_code_used, '')));

  IF v_referral_code = '' THEN
    RETURN NEW;
  END IF;

  -- Find the referring client by referral code (case-insensitive)
  SELECT c.id
  INTO v_referrer_client_id
  FROM clients c
  WHERE upper(c.referral_code) = v_referral_code
  LIMIT 1;

  IF v_referrer_client_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Add referral credit to available balance
  UPDATE clients
  SET
    referral_credit_balance = round((COALESCE(referral_credit_balance, 0) + v_credit_amount)::numeric, 2),
    updated_at = now()
  WHERE id = v_referrer_client_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_add_referral_credit_on_inquiry_insert ON form_inquiries;
CREATE TRIGGER trg_add_referral_credit_on_inquiry_insert
  AFTER INSERT ON form_inquiries
  FOR EACH ROW
  EXECUTE FUNCTION add_referral_credit_on_inquiry_insert();
