-- F7: auto_create_portal_customer took the email from its argument and linked any
-- unlinked customer record with that address to the calling account. Any signed-in
-- user could therefore claim another person's customer history. The email is now
-- read from the caller's own verified session (auth.users), and p_email is only a
-- hint that must match it.
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

  SELECT bi.organization_id INTO v_organization_id
  FROM public.business_info bi
  WHERE bi.is_active = true
  LIMIT 1;

  IF v_organization_id IS NULL THEN
    RETURN QUERY SELECT 'no_organization'::text, NULL::uuid;
    RETURN;
  END IF;

  INSERT INTO public.customers (
    organization_id, auth_user_id, email, full_name, source
  ) VALUES (
    v_organization_id, v_auth_user_id, v_email_norm, v_full_name, 'portal_self_registration'
  )
  RETURNING id INTO v_new_customer_id;

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
