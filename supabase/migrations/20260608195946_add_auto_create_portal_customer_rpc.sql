/*
  # Auto-create customer record on portal sign-in

  ## Summary
  Creates an RPC function `auto_create_portal_customer` that is called after
  `auto_link_gmail_portal_account` returns 'no_match'. It creates both a
  `customers` record (for portal access) and a `clients` record (visible in
  admin panel) for new portal sign-ups.

  ## New Functions
  - `auto_create_portal_customer(p_email, p_full_name, p_request_user_agent)`
    - Checks if the authenticated user already has a customer record
    - If not, creates one in `customers` (source = 'portal_self_registration')
    - Also creates a corresponding `clients` record (source = 'portal_signup', status = 'lead')
    - Returns status, customer_id

  ## Security
  - SECURITY DEFINER to allow insert into customers/clients tables
  - Only callable by authenticated users
  - Idempotent: returns 'already_exists' if customer record already present

  ## Important Notes
  1. The function resolves the organization_id from the single active business_info row.
  2. If no active business exists, it returns 'no_organization' status.
  3. Duplicate prevention via auth_user_id unique index on customers table.
  4. The clients record uses the existing upsert-by-email pattern to avoid duplicates.
*/

CREATE OR REPLACE FUNCTION public.auto_create_portal_customer(
  p_email text,
  p_full_name text DEFAULT NULL,
  p_request_user_agent text DEFAULT NULL
)
RETURNS TABLE (
  status text,
  customer_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_email_norm text := NULLIF(lower(btrim(COALESCE(p_email, ''))), '');
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

  -- Must have an email
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

  -- Also check if a customer with this email already exists (but unlinked)
  -- If so, link it instead of creating a new one
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

  -- Resolve organization from active business_info
  SELECT bi.organization_id INTO v_organization_id
  FROM public.business_info bi
  WHERE bi.is_active = true
  LIMIT 1;

  IF v_organization_id IS NULL THEN
    RETURN QUERY SELECT 'no_organization'::text, NULL::uuid;
    RETURN;
  END IF;

  -- Create the customer record
  INSERT INTO public.customers (
    organization_id,
    auth_user_id,
    email,
    full_name,
    source
  ) VALUES (
    v_organization_id,
    v_auth_user_id,
    v_email_norm,
    v_full_name,
    'portal_self_registration'
  )
  RETURNING id INTO v_new_customer_id;

  -- Create or link a corresponding clients record
  SELECT id INTO v_existing_client_id
  FROM public.clients
  WHERE organization_id = v_organization_id
    AND lower(email) = v_email_norm
  LIMIT 1;

  IF v_existing_client_id IS NULL THEN
    INSERT INTO public.clients (
      organization_id,
      name,
      email,
      client_status,
      source,
      first_contact_date
    ) VALUES (
      v_organization_id,
      COALESCE(v_full_name, split_part(v_email_norm, '@', 1)),
      v_email_norm,
      'lead',
      'portal_signup',
      now()
    );
  END IF;

  -- Track funnel event if table exists
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
$$;

REVOKE ALL ON FUNCTION public.auto_create_portal_customer(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_create_portal_customer(text, text, text) TO authenticated;
