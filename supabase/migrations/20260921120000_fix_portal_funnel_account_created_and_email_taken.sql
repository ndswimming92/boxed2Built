/*
  # Repair portal self-registration

  ## The bug
  `auto_create_portal_customer` inserts a `portal_funnel_events` row with
  `event_type = 'account_created'`, but that table's CHECK constraint only ever
  allowed ('login', 'first_job_view', 'repeat_login', 'walkthrough_completed')
  and no migration widened it. The insert raises 23514, which aborts the whole
  function and rolls back the `customers` row and the `clients` row with it.
  `runPortalPostLogin` treats every step as best-effort and swallows the error.

  Net effect: a customer who has never used the portal before gets NO account.
  They land on the dashboard, `getMyProfile()` 404s, and they see the
  "Link existing records" panel instead — on every single login.

  ## What this changes
  1. Widen the CHECK to include 'account_created'. Widening rather than
     downgrading the RPC to 'login' keeps the signal; `portal_adoption_report`'s
     funnel_stage CASE ignores event types it does not name, so nothing
     downstream breaks.
     `track_portal_funnel_event` has its own separate allowlist and is left
     alone — only this SECURITY DEFINER function writes 'account_created'.
  2. Return an explicit 'email_taken' status instead of letting
     `customers_org_email_unique` raise a bare 23505 that the caller swallows.

  ## Rollback
  Restore the previous constraint (without 'account_created') and re-apply
  20260819200921_auto_create_portal_customer_uses_verified_email.sql. Any
  portal_funnel_events rows of type 'account_created' must be deleted first or
  the narrower constraint will not validate.
*/

DO $$
DECLARE
  v_constraint_name text;
BEGIN
  -- Find the real constraint name rather than assuming Postgres's default,
  -- then rebuild it with the extra event type.
  SELECT con.conname INTO v_constraint_name
  FROM pg_constraint con
  WHERE con.conrelid = 'public.portal_funnel_events'::regclass
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%event_type%'
  LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.portal_funnel_events DROP CONSTRAINT %I',
      v_constraint_name
    );
  END IF;

  ALTER TABLE public.portal_funnel_events
    ADD CONSTRAINT portal_funnel_events_event_type_check
    CHECK (event_type IN (
      'login',
      'first_job_view',
      'repeat_login',
      'walkthrough_completed',
      'account_created'
    ));
END $$;

CREATE OR REPLACE FUNCTION public.auto_create_portal_customer(
  p_email text,
  p_full_name text DEFAULT NULL::text,
  p_request_user_agent text DEFAULT NULL::text
)
RETURNS TABLE(status text, customer_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_email_norm text;
  v_full_name text := NULLIF(btrim(COALESCE(p_full_name, '')), '');
  v_existing_customer_id uuid;
  v_organization_id uuid;
  v_new_customer_id uuid;
  v_existing_client_id uuid;
BEGIN
  -- Must be authenticated
  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- The address always comes from the session, never from the argument, so a
  -- caller cannot name someone else's email here.
  SELECT NULLIF(lower(btrim(COALESCE(u.email, ''))), '')
  INTO v_email_norm
  FROM auth.users u
  WHERE u.id = v_auth_user_id;

  IF v_email_norm IS NULL THEN
    RETURN QUERY SELECT 'missing_email'::text, NULL::uuid;
    RETURN;
  END IF;

  -- Check if this auth user already has a customer record
  SELECT id INTO v_existing_customer_id
  FROM public.customers
  WHERE auth_user_id = v_auth_user_id
  LIMIT 1;

  IF v_existing_customer_id IS NOT NULL THEN
    RETURN QUERY SELECT 'already_exists'::text, v_existing_customer_id;
    RETURN;
  END IF;

  -- An unlinked customer record with the caller's OWN verified address is
  -- linked instead of creating a duplicate.
  SELECT c.id INTO v_existing_customer_id
  FROM public.customers c
  WHERE lower(c.email) = v_email_norm
    AND c.auth_user_id IS NULL
  LIMIT 1;

  IF v_existing_customer_id IS NOT NULL THEN
    UPDATE public.customers
    SET auth_user_id = v_auth_user_id,
        full_name = COALESCE(v_full_name, full_name),
        updated_at = now()
    WHERE id = v_existing_customer_id;

    RETURN QUERY SELECT 'linked_existing'::text, v_existing_customer_id;
    RETURN;
  END IF;

  -- Hoisted above the conflict check below, which needs the org to scope its
  -- lookup to the same partial unique index (organization_id, lower(email)).
  SELECT bi.organization_id INTO v_organization_id
  FROM public.business_info bi
  WHERE bi.is_active = true
  LIMIT 1;

  IF v_organization_id IS NULL THEN
    RETURN QUERY SELECT 'no_organization'::text, NULL::uuid;
    RETURN;
  END IF;

  -- The address is already spoken for by a DIFFERENT auth user. Inserting would
  -- trip customers_org_email_unique and abort the function; report it instead so
  -- the caller can log it rather than swallowing a bare 23505.
  PERFORM 1
  FROM public.customers c
  WHERE c.organization_id = v_organization_id
    AND lower(c.email) = v_email_norm
    AND c.auth_user_id IS NOT NULL
    AND c.auth_user_id <> v_auth_user_id;

  IF FOUND THEN
    RETURN QUERY SELECT 'email_taken'::text, NULL::uuid;
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.customers (
      organization_id, auth_user_id, email, full_name, source
    ) VALUES (
      v_organization_id, v_auth_user_id, v_email_norm, v_full_name, 'portal_self_registration'
    )
    RETURNING id INTO v_new_customer_id;
  EXCEPTION
    WHEN unique_violation THEN
      -- Closes the race between the check above and this insert.
      RETURN QUERY SELECT 'email_taken'::text, NULL::uuid;
      RETURN;
  END;

  SELECT id INTO v_existing_client_id
  FROM public.clients
  WHERE organization_id = v_organization_id
    AND lower(email) = v_email_norm
  LIMIT 1;

  IF v_existing_client_id IS NULL THEN
    INSERT INTO public.clients (
      organization_id, name, email, client_status, source, first_contact_date
    ) VALUES (
      v_organization_id,
      COALESCE(v_full_name, split_part(v_email_norm, '@', 1)),
      v_email_norm,
      'lead',
      'portal_signup',
      now()
    );
  END IF;

  IF to_regclass('public.portal_funnel_events') IS NOT NULL THEN
    INSERT INTO public.portal_funnel_events (organization_id, customer_id, event_type, metadata)
    VALUES (
      v_organization_id,
      v_new_customer_id,
      'account_created',
      jsonb_build_object(
        'source', 'portal_self_registration',
        'request_user_agent', p_request_user_agent
      )
    );
  END IF;

  RETURN QUERY SELECT 'created'::text, v_new_customer_id;
END;
$function$;
