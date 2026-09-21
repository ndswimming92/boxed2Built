/*
  # Keep the portal profile and the admin client record in step

  ## The gap
  The portal writes `customers.full_name` and `customers.phone`. Admin reads
  `clients.name` and `clients.phone`. Nothing connected them, so a customer who
  updated their phone in the portal saw it save and an admin saw nothing change.

  `auto_create_portal_customer` creates the `clients` row at signup with no
  phone at all and never touches it again, so a self-registered customer's
  client record stayed blank indefinitely.

  There is no foreign key between the two tables. They are matched on
  `(organization_id, lower(email))`, which is unique on both sides
  (`customers_org_email_unique`, `clients_email_org_unique`), and the portal
  cannot change an email, so the key is stable at write time.

  ## Why triggers rather than a write from the app
  Every policy on `clients` requires `can_view_org_data` or
  `can_manage_org_settings`. A portal customer is `authenticated` but has no
  `organization_members` row, so all of them evaluate false — a portal client
  cannot read or write `clients` at all. `push_job_address_to_client`
  (20260814120000) is the existing template for this: SECURITY DEFINER, pinned
  search_path, and a guarded UPDATE.

  ## The loop guard, which matters most
  The two contact triggers point at each other. What stops them recursing is the
  `IS DISTINCT FROM` in each WHERE clause:

    portal writes customers.phone
      -> trigger 1 updates clients (value differs)
      -> trigger 2 fires, finds customers.phone already equal
      -> WHERE matches zero rows, no write, no further trigger

  It settles after one bounce. Preserve that guard in any future edit.

  ## Rollback
  DROP TRIGGER trg_sync_customer_contact_to_client ON public.customers;
  DROP TRIGGER trg_sync_client_contact_to_customer ON public.clients;
  DROP TRIGGER trg_sync_customer_prefs_to_client ON public.customer_notification_preferences;
  DROP FUNCTION public.sync_customer_contact_to_client();
  DROP FUNCTION public.sync_client_contact_to_customer();
  DROP FUNCTION public.sync_customer_prefs_to_client();
  (The backfill is not reversible, but it only ever filled nulls.)
*/

-- ── 1. Portal → admin ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_customer_contact_to_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text := NULLIF(btrim(COALESCE(NEW.full_name, '')), '');
BEGIN
  IF NULLIF(btrim(COALESCE(NEW.email, '')), '') IS NULL THEN
    RETURN NEW;
  END IF;

  -- phone goes through as-is, nulls included: the trigger only fires when the
  -- value actually changed, so a null here is a customer deliberately clearing
  -- it rather than an empty initial state.
  --
  -- name is guarded, because clients.name is the display name across the whole
  -- admin UI and blanking it would leave a row nobody could identify.
  UPDATE public.clients c
  SET name = COALESCE(v_name, c.name),
      phone = NEW.phone
  WHERE c.organization_id = NEW.organization_id
    AND lower(c.email) = lower(NEW.email)
    AND (c.phone IS DISTINCT FROM NEW.phone
         OR c.name IS DISTINCT FROM COALESCE(v_name, c.name));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_customer_contact_to_client ON public.customers;
CREATE TRIGGER trg_sync_customer_contact_to_client
  AFTER UPDATE OF full_name, phone ON public.customers
  FOR EACH ROW
  WHEN (OLD.full_name IS DISTINCT FROM NEW.full_name
        OR OLD.phone IS DISTINCT FROM NEW.phone)
  EXECUTE FUNCTION public.sync_customer_contact_to_client();

-- ── 2. Admin → portal ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_client_contact_to_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text := NULLIF(btrim(COALESCE(NEW.name, '')), '');
BEGIN
  IF NULLIF(btrim(COALESCE(NEW.email, '')), '') IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.customers cu
  SET full_name = COALESCE(v_name, cu.full_name),
      phone = NEW.phone
  WHERE cu.organization_id = NEW.organization_id
    AND lower(cu.email) = lower(NEW.email)
    AND (cu.phone IS DISTINCT FROM NEW.phone
         OR cu.full_name IS DISTINCT FROM COALESCE(v_name, cu.full_name));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_client_contact_to_customer ON public.clients;
CREATE TRIGGER trg_sync_client_contact_to_customer
  AFTER UPDATE OF name, phone ON public.clients
  FOR EACH ROW
  WHEN (OLD.name IS DISTINCT FROM NEW.name
        OR OLD.phone IS DISTINCT FROM NEW.phone)
  EXECUTE FUNCTION public.sync_client_contact_to_customer();

-- ── 3. Portal email preferences → the admin opt-in flag ─────────────────────
CREATE OR REPLACE FUNCTION public.sync_customer_prefs_to_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_email text;
  v_opted_out boolean := NEW.unsubscribed_at IS NOT NULL OR NEW.email_enabled IS FALSE;
BEGIN
  SELECT cu.organization_id, NULLIF(btrim(COALESCE(cu.email, '')), '')
  INTO v_org_id, v_email
  FROM public.customers cu
  WHERE cu.id = NEW.customer_id;

  IF v_org_id IS NULL OR v_email IS NULL THEN
    RETURN NEW;
  END IF;

  -- important_only is deliberately not mapped. It picks which portal
  -- notifications get mirrored to email; it is not a consent signal and has no
  -- equivalent on the admin side.
  UPDATE public.clients c
  SET marketing_email_opt_in = NOT v_opted_out,
      opt_out_date = CASE WHEN v_opted_out THEN COALESCE(c.opt_out_date, now()) ELSE NULL END
  WHERE c.organization_id = v_org_id
    AND lower(c.email) = lower(v_email)
    AND c.marketing_email_opt_in IS DISTINCT FROM (NOT v_opted_out);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_customer_prefs_to_client ON public.customer_notification_preferences;
CREATE TRIGGER trg_sync_customer_prefs_to_client
  AFTER INSERT OR UPDATE ON public.customer_notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_customer_prefs_to_client();

-- ── Grants ──────────────────────────────────────────────────────────────────
-- Trigger functions are never called directly. Left with the default PUBLIC
-- grant they would be definer-rights wrappers reachable over /rest/v1/rpc/,
-- which is what 20260921153000 had to clean up. Revoking is safe: PostgreSQL
-- checks EXECUTE at CREATE TRIGGER time, not on each fire.
REVOKE ALL ON FUNCTION public.sync_customer_contact_to_client() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_client_contact_to_customer() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_customer_prefs_to_client() FROM PUBLIC, anon, authenticated;

-- ── Backfill ────────────────────────────────────────────────────────────────
-- Only fills nulls. A backfill cannot tell which side is newer, so it must not
-- overwrite anything a person typed; from here the triggers keep both in step.
UPDATE public.clients c
SET phone = cu.phone
FROM public.customers cu
WHERE cu.organization_id = c.organization_id
  AND lower(cu.email) = lower(c.email)
  AND c.phone IS NULL
  AND NULLIF(btrim(COALESCE(cu.phone, '')), '') IS NOT NULL;

UPDATE public.customers cu
SET phone = c.phone
FROM public.clients c
WHERE cu.organization_id = c.organization_id
  AND lower(cu.email) = lower(c.email)
  AND cu.phone IS NULL
  AND NULLIF(btrim(COALESCE(c.phone, '')), '') IS NOT NULL;
