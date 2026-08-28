/*
  # Coupon codes

  Admin-created discount codes customers type into the referral / coupon box on
  the contact form. A code takes a percentage or a flat dollar amount off the
  quote, and that discount follows the lead through to the invoice.

  1. New table
    - `coupons`
      - `id` (uuid, pk)
      - `business_id` (uuid, references business_info)
      - `organization_id` (uuid, references organizations)
      - `created_by` (uuid, references auth.users)
      - `code` (text, unique) — uppercase, e.g. `WELCOME25`. Unique globally
        because the public lookup is by code alone, with nothing else to
        disambiguate on.
      - `description` (text) — what the code is for, shown only in the admin UI
      - `discount_type` (text) — `fixed` (dollars off) or `percentage`
      - `discount_value` (numeric) — dollars, or percent when `percentage`
      - `starts_at`, `ends_at` (timestamptz, nullable) — the window the code
        works in. Null on either end means open-ended.
      - `is_active` (boolean) — the on/off switch, independent of the window
      - `times_used` (integer), `last_used_at` (timestamptz) — usage counter,
        maintained by the trigger below
      - `created_at`, `updated_at` (timestamptz)

  2. New columns on `form_inquiries`
     `coupon_code`, `coupon_discount_type`, `coupon_discount_value` and
     `coupon_discount_amount` snapshot the coupon as it stood when the customer
     submitted, so editing or deleting a coupon later never rewrites a quote
     someone was already given. `referral_code_used` keeps its existing meaning:
     the box accepts either kind of code and the app stores whichever it was.

  3. Public lookup
     `lookup_coupon_by_code()` is SECURITY DEFINER and callable by `anon` so the
     form can confirm a code before submission. It returns a row only while the
     coupon is redeemable — inactive, not-yet-started and expired codes are
     indistinguishable from codes that do not exist, so the function cannot be
     used to enumerate upcoming promotions. Attempts are recorded per IP and cut
     off at 20 in a rolling 15 minutes, matching the gift card lookup.

  4. Security
     RLS on `coupons`: platform admins have full access, organization members
     get the same through `has_org_permission()`, and `anon` is revoked outright
     — the public path is the lookup function alone.
*/

-- ── Table ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES business_info(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  code text NOT NULL,
  description text,
  discount_type text NOT NULL DEFAULT 'fixed',
  discount_value numeric(10,2) NOT NULL,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  times_used integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coupons_discount_type_check
    CHECK (discount_type IN ('fixed', 'percentage')),
  -- A 0% coupon is a support ticket waiting to happen, and a percentage over
  -- 100 would invert the quote.
  CONSTRAINT coupons_discount_value_check
    CHECK (
      discount_value > 0
      AND (discount_type <> 'percentage' OR discount_value <= 100)
    ),
  -- Stored uppercase and trimmed so lookups never depend on how it was typed.
  CONSTRAINT coupons_code_format_check
    CHECK (code = upper(btrim(code)) AND code ~ '^[A-Z0-9][A-Z0-9-]{2,29}$'),
  CONSTRAINT coupons_window_check
    CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS coupons_code_key ON public.coupons (code);
CREATE INDEX IF NOT EXISTS idx_coupons_business ON public.coupons (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coupons_organization ON public.coupons (organization_id);
CREATE INDEX IF NOT EXISTS idx_coupons_created_by ON public.coupons (created_by);

-- ── updated_at ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_coupons_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS coupons_updated_at ON public.coupons;
CREATE TRIGGER coupons_updated_at
  BEFORE UPDATE ON public.coupons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_coupons_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins have full access to coupons" ON public.coupons;
CREATE POLICY "Platform admins have full access to coupons"
  ON public.coupons FOR ALL TO authenticated
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS "Organization members can manage coupons" ON public.coupons;
CREATE POLICY "Organization members can manage coupons"
  ON public.coupons FOR ALL TO authenticated
  USING (has_org_permission(organization_id, 'member'))
  WITH CHECK (has_org_permission(organization_id, 'member'));

REVOKE ALL ON public.coupons FROM anon;

-- ── Inquiry snapshot columns ─────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'form_inquiries' AND column_name = 'coupon_code'
  ) THEN
    ALTER TABLE public.form_inquiries ADD COLUMN coupon_code text;
    ALTER TABLE public.form_inquiries ADD COLUMN coupon_discount_type text;
    ALTER TABLE public.form_inquiries ADD COLUMN coupon_discount_value numeric(10,2);
    ALTER TABLE public.form_inquiries ADD COLUMN coupon_discount_amount numeric(10,2);

    ALTER TABLE public.form_inquiries ADD CONSTRAINT form_inquiries_coupon_type_check
      CHECK (coupon_discount_type IS NULL OR coupon_discount_type IN ('fixed', 'percentage'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_form_inquiries_coupon_code
  ON public.form_inquiries (coupon_code)
  WHERE coupon_code IS NOT NULL;

-- ── Usage counter ────────────────────────────────────────────────────────────
-- Inquiries are inserted by `anon`, which has no rights on `coupons`, so the
-- counter is maintained by a definer-rights trigger rather than by the client.
CREATE OR REPLACE FUNCTION public.record_coupon_use()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.coupon_code IS NOT NULL AND btrim(NEW.coupon_code) <> '' THEN
    UPDATE public.coupons
    SET times_used = times_used + 1,
        last_used_at = now()
    WHERE code = upper(btrim(NEW.coupon_code));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS form_inquiries_record_coupon_use ON public.form_inquiries;
CREATE TRIGGER form_inquiries_record_coupon_use
  AFTER INSERT ON public.form_inquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.record_coupon_use();

-- ── Public lookup, rate limited ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coupon_lookup_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_ip text,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  found boolean NOT NULL DEFAULT false
);

ALTER TABLE public.coupon_lookup_attempts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS coupon_lookup_attempts_ip_time_idx
  ON public.coupon_lookup_attempts (request_ip, attempted_at DESC);

REVOKE ALL ON TABLE public.coupon_lookup_attempts FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.lookup_coupon_by_code(p_code text)
RETURNS TABLE(
  code text,
  description text,
  discount_type text,
  discount_value numeric,
  ends_at timestamptz
)
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ip text;
  v_recent integer;
  v_found boolean := false;
BEGIN
  IF p_code IS NULL OR length(btrim(p_code)) < 3 THEN
    RETURN;
  END IF;

  v_ip := COALESCE(public.get_request_ip_from_headers(), 'unknown');

  SELECT count(*) INTO v_recent
  FROM public.coupon_lookup_attempts a
  WHERE a.request_ip = v_ip
    AND a.attempted_at > now() - interval '15 minutes';

  IF v_recent >= 20 THEN
    RAISE EXCEPTION 'Too many code lookups. Please try again later.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Only redeemable coupons match, so a wrong code, a paused code and a code
  -- whose window has not opened all look identical from outside.
  SELECT EXISTS (
    SELECT 1 FROM public.coupons c
    WHERE c.code = upper(btrim(p_code))
      AND c.is_active
      AND (c.starts_at IS NULL OR c.starts_at <= now())
      AND (c.ends_at IS NULL OR c.ends_at > now())
  ) INTO v_found;

  INSERT INTO public.coupon_lookup_attempts (request_ip, found)
  VALUES (v_ip, v_found);

  -- Housekeeping: keep the throttle table small.
  DELETE FROM public.coupon_lookup_attempts
  WHERE attempted_at < now() - interval '1 day';

  IF NOT v_found THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT c.code, c.description, c.discount_type, c.discount_value, c.ends_at
  FROM public.coupons c
  WHERE c.code = upper(btrim(p_code))
    AND c.is_active
    AND (c.starts_at IS NULL OR c.starts_at <= now())
    AND (c.ends_at IS NULL OR c.ends_at > now());
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_coupon_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_coupon_by_code(text) TO anon, authenticated;
