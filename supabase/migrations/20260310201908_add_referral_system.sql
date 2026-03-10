/*
  # Add Referral Program System

  ## Summary
  Adds a complete referral code and credit tracking system to the clients table and form_inquiries table.

  ## New Columns on `clients` Table
  - `referral_code` (text, unique) - Auto-generated unique referral code per client (e.g., B2B-SMITH-4X2)
  - `referred_by_client_id` (uuid, nullable) - FK to clients; which client referred this client
  - `referral_credit_balance` (numeric) - Current unused credit balance in dollars, defaults 0.00
  - `referral_credit_used` (numeric) - Lifetime total credits ever redeemed, defaults 0.00

  ## New Columns on `form_inquiries` Table
  - `referral_code_used` (text, nullable) - Referral code entered by the prospect on the contact form

  ## New Function
  - `generate_unique_referral_code(client_name text, client_id uuid)` - Generates a code like B2B-JONES-4X2

  ## Backfill
  - Generates referral codes for all existing clients that don't have one

  ## Security
  - RLS remains unchanged; columns follow existing table policies
*/

-- 1. Add referral columns to clients table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'referral_code'
  ) THEN
    ALTER TABLE clients ADD COLUMN referral_code text UNIQUE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'referred_by_client_id'
  ) THEN
    ALTER TABLE clients ADD COLUMN referred_by_client_id uuid REFERENCES clients(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'referral_credit_balance'
  ) THEN
    ALTER TABLE clients ADD COLUMN referral_credit_balance numeric(10,2) DEFAULT 0.00 NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'referral_credit_used'
  ) THEN
    ALTER TABLE clients ADD COLUMN referral_credit_used numeric(10,2) DEFAULT 0.00 NOT NULL;
  END IF;
END $$;

-- 2. Add referral_code_used to form_inquiries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'form_inquiries' AND column_name = 'referral_code_used'
  ) THEN
    ALTER TABLE form_inquiries ADD COLUMN referral_code_used text;
  END IF;
END $$;

-- 3. Create a function to generate unique referral codes
-- Uses extensions.gen_random_uuid() for randomness (pgcrypto is installed)
CREATE OR REPLACE FUNCTION generate_unique_referral_code(
  p_client_name text,
  p_client_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_code text;
  v_name_part text;
  v_suffix text;
  v_attempts int := 0;
  v_uuid_chars text;
BEGIN
  -- Extract up to 6 chars from the first word of the name, uppercase, letters only
  v_name_part := upper(regexp_replace(split_part(trim(p_client_name), ' ', 1), '[^A-Za-z]', '', 'g'));
  v_name_part := left(v_name_part, 6);

  IF length(v_name_part) = 0 THEN
    v_name_part := 'CLIENT';
  END IF;

  LOOP
    v_attempts := v_attempts + 1;
    -- Use upper 4 chars of a new UUID (hex digits) as suffix
    v_uuid_chars := replace(extensions.uuid_generate_v4()::text, '-', '');
    v_suffix := upper(left(v_uuid_chars, 4));
    v_code := 'B2B-' || v_name_part || '-' || v_suffix;

    -- Check uniqueness
    IF NOT EXISTS (SELECT 1 FROM clients WHERE referral_code = v_code) THEN
      RETURN v_code;
    END IF;

    IF v_attempts > 20 THEN
      -- Fallback: use part of client_id
      v_code := 'B2B-' || upper(left(replace(p_client_id::text, '-', ''), 10));
      RETURN v_code;
    END IF;
  END LOOP;
END;
$$;

-- 4. Create a trigger function to auto-assign referral codes on insert
CREATE OR REPLACE FUNCTION assign_referral_code_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_unique_referral_code(NEW.name, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_referral_code ON clients;
CREATE TRIGGER trg_assign_referral_code
  BEFORE INSERT ON clients
  FOR EACH ROW
  EXECUTE FUNCTION assign_referral_code_on_insert();

-- 5. Index for referral_code lookups
CREATE INDEX IF NOT EXISTS idx_clients_referral_code ON clients(referral_code);

-- 6. Index for referred_by_client_id (FK performance)
CREATE INDEX IF NOT EXISTS idx_clients_referred_by_client_id ON clients(referred_by_client_id);

-- 7. Backfill existing clients that don't have a referral code
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT id, name FROM clients WHERE referral_code IS NULL ORDER BY created_at LOOP
    UPDATE clients
    SET referral_code = generate_unique_referral_code(rec.name, rec.id)
    WHERE id = rec.id AND referral_code IS NULL;
  END LOOP;
END $$;
