/*
  # Per-client referral QR scan tracking

  ## Overview
  Every client already carries a `referral_code` assigned by
  `trg_assign_referral_code`. Those codes now also exist as scannable QR codes
  printed on physical thank-you tokens, pointing at `/r/<code>`. This migration
  adds the counting behind that route so the CRM can show which tokens are
  actually being used.

  ## 1. New Tables
    - `referral_scans` - one row per scan of a client's referral QR. Keeps the
      raw log so a scan can later be placed in time; the aggregates the CRM
      reads live on `clients` (below) so the client list needs no extra query.
      Carries `organization_id` so its policies stand alone rather than
      reaching into `clients`.

  ## 2. Changes to existing tables
    - `clients.referral_scan_count` (integer, default 0) - running total of
      non-bot scans, maintained by trigger.
    - `clients.referral_last_scanned_at` (timestamptz, nullable) - when the most
      recent non-bot scan happened. Null means never scanned.

  ## 3. Security
    - RLS on `referral_scans`, with SELECT limited to platform admins and org
      admins via the existing helpers. `anon` has no table privileges at all.
    - Writes go exclusively through `log_referral_scan`, a SECURITY DEFINER
      function granted to `anon`. It RETURNS void unconditionally and reveals
      nothing about whether a code matched - otherwise it would be an
      enumeration oracle over the client list, the same weakness
      `20260818233729_rate_limit_gift_card_lookup.sql` was written to close.
    - The trigger function is revoked from PUBLIC and `authenticated`, matching
      the hardening pass in `20260501164010_fix_security_definer_exposure_v2.sql`.

  ## 4. Notes
    - Bot and link-preview traffic is recorded but never counted. Pasting a
      referral link into iMessage, WhatsApp or Slack makes those services fetch
      the URL, and that must not read as a real scan.
    - A repeat scan of the same code from the same user agent inside a minute is
      ignored, which also absorbs a double render of the redirect page.
    - Idempotent throughout: safe to re-run.
*/

-- ---------------------------------------------------------------------------
-- 1. Scan log
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.referral_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  -- Denormalised so the RLS policies below need no subquery into `clients`,
  -- which would otherwise make them depend on that table's own grants.
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  referral_code text NOT NULL,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  user_agent text NOT NULL DEFAULT '',
  referrer text NOT NULL DEFAULT '',
  is_bot boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS referral_scans_client_time_idx
  ON public.referral_scans (client_id, scanned_at DESC);

CREATE INDEX IF NOT EXISTS referral_scans_org_idx
  ON public.referral_scans (organization_id);

-- Supports the 60 second duplicate check in log_referral_scan.
CREATE INDEX IF NOT EXISTS referral_scans_code_time_idx
  ON public.referral_scans (referral_code, scanned_at DESC);

ALTER TABLE public.referral_scans ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.referral_scans FROM anon;

DROP POLICY IF EXISTS "Admins read referral scans" ON public.referral_scans;
CREATE POLICY "Admins read referral scans"
  ON public.referral_scans FOR SELECT
  TO authenticated
  USING (is_platform_admin() OR has_org_permission(organization_id, 'admin'));

DROP POLICY IF EXISTS "Admins delete referral scans" ON public.referral_scans;
CREATE POLICY "Admins delete referral scans"
  ON public.referral_scans FOR DELETE
  TO authenticated
  USING (is_platform_admin() OR has_org_permission(organization_id, 'admin'));

-- ---------------------------------------------------------------------------
-- 2. Cached aggregates on clients
-- ---------------------------------------------------------------------------

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS referral_scan_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS referral_last_scanned_at timestamptz;

CREATE OR REPLACE FUNCTION public.bump_client_referral_scan_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Bots are kept in the log for forensics but never counted.
  IF NEW.is_bot THEN
    RETURN NEW;
  END IF;

  UPDATE public.clients
  SET referral_scan_count = referral_scan_count + 1,
      referral_last_scanned_at = NEW.scanned_at
  WHERE id = NEW.client_id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.bump_client_referral_scan_stats() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_bump_client_referral_scan_stats ON public.referral_scans;
CREATE TRIGGER trg_bump_client_referral_scan_stats
  AFTER INSERT ON public.referral_scans
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_client_referral_scan_stats();

-- ---------------------------------------------------------------------------
-- 3. The only write path
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_referral_scan(
  p_code text,
  p_user_agent text DEFAULT '',
  p_referrer text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_agent text;
  v_client_id uuid;
  v_org_id uuid;
  v_is_bot boolean;
BEGIN
  v_code := upper(trim(coalesce(p_code, '')));

  IF v_code = '' THEN
    RETURN;
  END IF;

  -- Cap what a caller can push into the log.
  v_agent := left(coalesce(p_user_agent, ''), 500);

  SELECT id, organization_id INTO v_client_id, v_org_id
  FROM public.clients
  WHERE upper(referral_code) = v_code
  LIMIT 1;

  -- No match is a silent no-op. Never signal whether the code was real: the
  -- return shape is the same either way.
  IF v_client_id IS NULL THEN
    RETURN;
  END IF;

  -- Link previewers and crawlers. These fetch the URL when a referral link is
  -- pasted into a chat, which is not a person scanning a token.
  v_is_bot := v_agent ~* '(bot|crawler|spider|slurp|facebookexternalhit|whatsapp|telegram|discord|slackbot|twitterbot|linkedinbot|embedly|quora link preview|pinterest|redditbot|applebot|bingpreview|skypeuripreview|preview|headless|curl|wget|python-requests|axios|node-fetch|lighthouse)';

  -- Collapse a repeat within the minute, which also covers a double render of
  -- the redirect page.
  IF EXISTS (
    SELECT 1 FROM public.referral_scans
    WHERE referral_code = v_code
      AND user_agent = v_agent
      AND scanned_at > now() - interval '60 seconds'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.referral_scans (client_id, organization_id, referral_code, user_agent, referrer, is_bot)
  VALUES (v_client_id, v_org_id, v_code, v_agent, left(coalesce(p_referrer, ''), 500), v_is_bot);
END;
$$;

REVOKE ALL ON FUNCTION public.log_referral_scan(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_referral_scan(text, text, text) TO anon, authenticated;
