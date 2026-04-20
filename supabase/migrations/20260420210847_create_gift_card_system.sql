/*
  # Gift Card System

  Introduces end-to-end gift card support for Boxed2Built services. Gift cards
  are purchased through Stripe Checkout and applied as service credit against
  future invoices. Gift cards never expire.

  1. New Tables
    - `gift_cards`
      - `id` (uuid, pk)
      - `code` (text, unique) - customer-facing redemption code
      - `initial_amount_cents` (integer) - purchase amount in cents
      - `remaining_amount_cents` (integer) - balance remaining
      - `status` (text) - pending | active | partially_redeemed | redeemed | voided | failed
      - `purchaser_name`, `purchaser_email` (text)
      - `recipient_name`, `recipient_email` (text, nullable)
      - `delivery_type` (text) - 'self' | 'recipient'
      - `personal_message` (text, nullable)
      - `stripe_checkout_session_id` (text, unique, nullable)
      - `stripe_payment_intent_id` (text, nullable)
      - `activated_at`, `created_at`, `updated_at` (timestamptz)

    - `gift_card_redemptions`
      - `id` (uuid, pk)
      - `gift_card_id` (uuid, fk)
      - `job_id` (uuid, nullable)
      - `invoice_id` (uuid, nullable)
      - `redeemed_amount_cents` (integer)
      - `redeemed_by_name`, `redeemed_by_email` (text, nullable)
      - `notes` (text, nullable)
      - `created_at` (timestamptz)

  2. Schema Changes
    - Adds `gift_card_code` column to `form_inquiries` so that prospective
      customers can attach a code during the quote/contact flow without
      performing any redemption.

  3. Functions
    - `lookup_gift_card_by_code(p_code text)` (SECURITY DEFINER) returns a
      limited, safe projection of the gift card (status, balance, recipient
      first name) for the public redemption lookup page.
    - `redeem_gift_card(...)` (SECURITY DEFINER) atomically decrements the
      remaining balance, creates a redemption row, and flips status when the
      balance reaches zero. Uses row-locking to prevent double-spend.

  4. Security (RLS)
    - RLS enabled on both tables.
    - Public (anon/authenticated) have NO direct INSERT/UPDATE/DELETE on
      `gift_cards` or `gift_card_redemptions`.
    - Platform admins (via existing `is_platform_admin()`) have full access.
    - Edge functions using the service role key bypass RLS as usual.
    - A narrow, read-only RPC exposes non-sensitive lookup data to the public.

  5. Notes
    - Gift cards never expire - no expiry column intentionally.
    - Amount allow-list enforced by CHECK constraint.
    - Unique index on `code` guarantees non-collision.
    - Stripe session id uniqueness enables webhook idempotency.
*/

-- 1) Tables -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS gift_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  initial_amount_cents integer NOT NULL CHECK (initial_amount_cents IN (2500, 5000, 10000, 20000)),
  remaining_amount_cents integer NOT NULL DEFAULT 0 CHECK (remaining_amount_cents >= 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','partially_redeemed','redeemed','voided','failed')),
  purchaser_name text NOT NULL DEFAULT '',
  purchaser_email text NOT NULL DEFAULT '',
  recipient_name text,
  recipient_email text,
  delivery_type text NOT NULL DEFAULT 'self'
    CHECK (delivery_type IN ('self','recipient')),
  personal_message text,
  stripe_checkout_session_id text UNIQUE,
  stripe_payment_intent_id text,
  activated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gift_card_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_card_id uuid NOT NULL REFERENCES gift_cards(id) ON DELETE CASCADE,
  job_id uuid,
  invoice_id uuid,
  redeemed_amount_cents integer NOT NULL CHECK (redeemed_amount_cents > 0),
  redeemed_by_name text,
  redeemed_by_email text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Indexes ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_gift_cards_code ON gift_cards (code);
CREATE INDEX IF NOT EXISTS idx_gift_cards_purchaser_email ON gift_cards (purchaser_email);
CREATE INDEX IF NOT EXISTS idx_gift_cards_recipient_email ON gift_cards (recipient_email);
CREATE INDEX IF NOT EXISTS idx_gift_cards_status ON gift_cards (status);
CREATE INDEX IF NOT EXISTS idx_gift_cards_created_at ON gift_cards (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gift_card_redemptions_gift_card ON gift_card_redemptions (gift_card_id);
CREATE INDEX IF NOT EXISTS idx_gift_card_redemptions_job ON gift_card_redemptions (job_id);
CREATE INDEX IF NOT EXISTS idx_gift_card_redemptions_invoice ON gift_card_redemptions (invoice_id);

-- 3) updated_at trigger -------------------------------------------------

CREATE OR REPLACE FUNCTION set_gift_cards_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gift_cards_updated_at ON gift_cards;
CREATE TRIGGER trg_gift_cards_updated_at
  BEFORE UPDATE ON gift_cards
  FOR EACH ROW
  EXECUTE FUNCTION set_gift_cards_updated_at();

-- 4) Form inquiries integration ----------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'form_inquiries' AND column_name = 'gift_card_code'
  ) THEN
    ALTER TABLE form_inquiries ADD COLUMN gift_card_code text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_form_inquiries_gift_card_code
  ON form_inquiries (gift_card_code)
  WHERE gift_card_code IS NOT NULL;

-- 5) Enable RLS ---------------------------------------------------------

ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_card_redemptions ENABLE ROW LEVEL SECURITY;

-- Admin SELECT/INSERT/UPDATE/DELETE via is_platform_admin()
DROP POLICY IF EXISTS "Platform admins select gift cards" ON gift_cards;
CREATE POLICY "Platform admins select gift cards"
  ON gift_cards FOR SELECT
  TO authenticated
  USING (is_platform_admin());

DROP POLICY IF EXISTS "Platform admins insert gift cards" ON gift_cards;
CREATE POLICY "Platform admins insert gift cards"
  ON gift_cards FOR INSERT
  TO authenticated
  WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS "Platform admins update gift cards" ON gift_cards;
CREATE POLICY "Platform admins update gift cards"
  ON gift_cards FOR UPDATE
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS "Platform admins delete gift cards" ON gift_cards;
CREATE POLICY "Platform admins delete gift cards"
  ON gift_cards FOR DELETE
  TO authenticated
  USING (is_platform_admin());

DROP POLICY IF EXISTS "Platform admins select redemptions" ON gift_card_redemptions;
CREATE POLICY "Platform admins select redemptions"
  ON gift_card_redemptions FOR SELECT
  TO authenticated
  USING (is_platform_admin());

DROP POLICY IF EXISTS "Platform admins insert redemptions" ON gift_card_redemptions;
CREATE POLICY "Platform admins insert redemptions"
  ON gift_card_redemptions FOR INSERT
  TO authenticated
  WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS "Platform admins update redemptions" ON gift_card_redemptions;
CREATE POLICY "Platform admins update redemptions"
  ON gift_card_redemptions FOR UPDATE
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS "Platform admins delete redemptions" ON gift_card_redemptions;
CREATE POLICY "Platform admins delete redemptions"
  ON gift_card_redemptions FOR DELETE
  TO authenticated
  USING (is_platform_admin());

-- 6) Public lookup function -------------------------------------------
-- Returns only the minimal info needed for the public redemption page.
-- Never exposes purchaser email, recipient email, message, or stripe IDs.

CREATE OR REPLACE FUNCTION lookup_gift_card_by_code(p_code text)
RETURNS TABLE (
  code text,
  status text,
  initial_amount_cents integer,
  remaining_amount_cents integer,
  recipient_first_name text,
  delivery_type text,
  activated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    gc.code,
    gc.status,
    gc.initial_amount_cents,
    gc.remaining_amount_cents,
    CASE
      WHEN gc.recipient_name IS NULL THEN NULL
      ELSE split_part(gc.recipient_name, ' ', 1)
    END AS recipient_first_name,
    gc.delivery_type,
    gc.activated_at
  FROM gift_cards gc
  WHERE upper(gc.code) = upper(p_code)
    AND gc.status IN ('active','partially_redeemed','redeemed','voided');
$$;

GRANT EXECUTE ON FUNCTION lookup_gift_card_by_code(text) TO anon, authenticated;

-- 7) Redemption function ----------------------------------------------
-- Atomic, transaction-safe redemption. Admin-only (enforced at caller via
-- service-role edge function or authenticated admin client + RLS).

CREATE OR REPLACE FUNCTION redeem_gift_card(
  p_gift_card_id uuid,
  p_amount_cents integer,
  p_job_id uuid DEFAULT NULL,
  p_invoice_id uuid DEFAULT NULL,
  p_redeemed_by_name text DEFAULT NULL,
  p_redeemed_by_email text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS TABLE (
  redemption_id uuid,
  new_remaining_cents integer,
  new_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card gift_cards%ROWTYPE;
  v_redemption_id uuid;
  v_new_remaining integer;
  v_new_status text;
BEGIN
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'Redemption amount must be positive';
  END IF;

  -- Lock the card row to prevent concurrent double-spend
  SELECT * INTO v_card
  FROM gift_cards
  WHERE id = p_gift_card_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gift card not found';
  END IF;

  IF v_card.status NOT IN ('active','partially_redeemed') THEN
    RAISE EXCEPTION 'Gift card is not redeemable (status=%)', v_card.status;
  END IF;

  IF p_amount_cents > v_card.remaining_amount_cents THEN
    RAISE EXCEPTION 'Redemption amount (%) exceeds remaining balance (%)',
      p_amount_cents, v_card.remaining_amount_cents;
  END IF;

  v_new_remaining := v_card.remaining_amount_cents - p_amount_cents;
  v_new_status := CASE
    WHEN v_new_remaining = 0 THEN 'redeemed'
    ELSE 'partially_redeemed'
  END;

  UPDATE gift_cards
  SET remaining_amount_cents = v_new_remaining,
      status = v_new_status,
      updated_at = now()
  WHERE id = p_gift_card_id;

  INSERT INTO gift_card_redemptions (
    gift_card_id, job_id, invoice_id, redeemed_amount_cents,
    redeemed_by_name, redeemed_by_email, notes
  ) VALUES (
    p_gift_card_id, p_job_id, p_invoice_id, p_amount_cents,
    p_redeemed_by_name, p_redeemed_by_email, p_notes
  ) RETURNING id INTO v_redemption_id;

  RETURN QUERY SELECT v_redemption_id, v_new_remaining, v_new_status;
END;
$$;

REVOKE ALL ON FUNCTION redeem_gift_card(uuid, integer, uuid, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION redeem_gift_card(uuid, integer, uuid, uuid, text, text, text) TO authenticated;
