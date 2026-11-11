/*
  # Coupon popup on the home page

  A small modal that fades in on the home page while a coupon is live, so a
  first-time visitor sees the offer without having to be sent a link.

  1. New columns on `coupons`
     - `show_on_home` (boolean, default false) — the per-coupon opt-in. Off by
       default on purpose: most codes are private (a partner's code, a code for
       one employer's staff), and a popup publishes the code to every visitor.
     - `popup_headline`, `popup_message` (text, nullable) — the customer-facing
       wording. `description` stays admin-only; when these are empty the site
       writes the wording from the discount.

  2. New table `coupon_popup_settings`
     One row per business: the master switch, how long to wait, how long the
     fade takes, how often one visitor sees it, where it sits and what the
     button says. No row means the defaults below.

  3. Public read
     `get_home_coupon_popup(business)` is SECURITY DEFINER and callable by
     `anon`. It returns at most one row: the opted-in coupon that is redeemable
     right now, soonest-ending first, with the settings beside it. It returns
     nothing when the switch is off or no opted-in coupon is live, so a
     scheduled promotion stays invisible until its first day and a coupon that
     was never ticked is never exposed. `anon` still has no rights on either
     table.

  4. Security
     RLS on `coupon_popup_settings`: platform admins, and members of the
     organization that owns the business. `anon` is revoked outright.
*/

-- ── Per-coupon opt-in and wording ────────────────────────────────────────────
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS show_on_home boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS popup_headline text,
  ADD COLUMN IF NOT EXISTS popup_message text;

COMMENT ON COLUMN public.coupons.show_on_home IS
  'Opt-in: advertise this code in the home page popup while it is redeemable.';

CREATE INDEX IF NOT EXISTS idx_coupons_show_on_home
  ON public.coupons (business_id)
  WHERE show_on_home;

-- ── Settings ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coupon_popup_settings (
  business_id uuid PRIMARY KEY REFERENCES public.business_info(id) ON DELETE CASCADE,
  is_enabled boolean NOT NULL DEFAULT true,
  delay_seconds numeric(4,1) NOT NULL DEFAULT 3,
  fade_ms integer NOT NULL DEFAULT 600,
  frequency text NOT NULL DEFAULT 'once_per_coupon',
  position text NOT NULL DEFAULT 'center',
  cta_label text NOT NULL DEFAULT 'Claim my discount',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coupon_popup_settings_delay_check CHECK (delay_seconds BETWEEN 0 AND 60),
  CONSTRAINT coupon_popup_settings_fade_check CHECK (fade_ms BETWEEN 0 AND 3000),
  CONSTRAINT coupon_popup_settings_frequency_check
    CHECK (frequency IN ('once_per_coupon', 'once_per_day', 'every_visit')),
  CONSTRAINT coupon_popup_settings_position_check
    CHECK (position IN ('center', 'corner')),
  CONSTRAINT coupon_popup_settings_cta_check
    CHECK (length(btrim(cta_label)) BETWEEN 1 AND 40)
);

CREATE OR REPLACE FUNCTION public.update_coupon_popup_settings_updated_at()
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

DROP TRIGGER IF EXISTS coupon_popup_settings_updated_at ON public.coupon_popup_settings;
CREATE TRIGGER coupon_popup_settings_updated_at
  BEFORE UPDATE ON public.coupon_popup_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_coupon_popup_settings_updated_at();

ALTER TABLE public.coupon_popup_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins have full access to coupon popup settings" ON public.coupon_popup_settings;
CREATE POLICY "Platform admins have full access to coupon popup settings"
  ON public.coupon_popup_settings FOR ALL TO authenticated
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS "Organization members can manage coupon popup settings" ON public.coupon_popup_settings;
CREATE POLICY "Organization members can manage coupon popup settings"
  ON public.coupon_popup_settings FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.business_info b
      WHERE b.id = coupon_popup_settings.business_id
        AND has_org_permission(b.organization_id, 'member')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.business_info b
      WHERE b.id = coupon_popup_settings.business_id
        AND has_org_permission(b.organization_id, 'member')
    )
  );

REVOKE ALL ON public.coupon_popup_settings FROM anon;

-- ── Public read ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_home_coupon_popup(p_business_id uuid)
RETURNS TABLE(
  code text,
  discount_type text,
  discount_value numeric,
  ends_at timestamptz,
  headline text,
  message text,
  delay_seconds numeric,
  fade_ms integer,
  frequency text,
  "position" text,
  cta_label text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    c.code,
    c.discount_type,
    c.discount_value,
    c.ends_at,
    NULLIF(btrim(c.popup_headline), ''),
    NULLIF(btrim(c.popup_message), ''),
    COALESCE(s.delay_seconds, 3),
    COALESCE(s.fade_ms, 600),
    COALESCE(s.frequency, 'once_per_coupon'),
    COALESCE(s.position, 'center'),
    COALESCE(s.cta_label, 'Claim my discount')
  FROM public.coupons c
  LEFT JOIN public.coupon_popup_settings s ON s.business_id = c.business_id
  WHERE c.business_id = p_business_id
    AND c.show_on_home
    AND c.is_active
    AND (c.starts_at IS NULL OR c.starts_at <= now())
    AND (c.ends_at IS NULL OR c.ends_at > now())
    AND COALESCE(s.is_enabled, true)
  -- Soonest-ending first: the offer about to run out is the urgent one. A code
  -- with no end date only shows when nothing with a deadline is live.
  ORDER BY c.ends_at ASC NULLS LAST, c.created_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_home_coupon_popup(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_home_coupon_popup(uuid) TO anon, authenticated;
