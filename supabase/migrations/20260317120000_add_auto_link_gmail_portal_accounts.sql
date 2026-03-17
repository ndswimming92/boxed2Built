/*
  # Auto-link Gmail portal sign-ins to customer records

  ## Summary
  - Adds RPC for signed-in users to auto-link customer records by email.
  - Intended for Google OAuth users with @gmail.com addresses.
  - Links jobs and invoices by normalized email within the matched organization.
*/

CREATE OR REPLACE FUNCTION public.auto_link_gmail_portal_account(
  p_email text,
  p_request_user_agent text DEFAULT NULL
)
RETURNS TABLE (
  status text,
  customer_id uuid,
  linked_jobs integer,
  linked_invoices integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_email_norm text := NULLIF(lower(btrim(p_email)), '');
  v_customer public.customers%ROWTYPE;
  v_candidate_count integer := 0;
  v_jobs_count integer := 0;
  v_invoices_count integer := 0;
BEGIN
  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF v_email_norm IS NULL OR right(v_email_norm, 10) <> '@gmail.com' THEN
    RETURN QUERY SELECT 'not_gmail'::text, NULL::uuid, 0, 0;
    RETURN;
  END IF;

  SELECT COUNT(*)
    INTO v_candidate_count
  FROM public.customers c
  WHERE lower(c.email) = v_email_norm
    AND (c.auth_user_id IS NULL OR c.auth_user_id = v_auth_user_id);

  IF v_candidate_count = 0 THEN
    RETURN QUERY SELECT 'no_match'::text, NULL::uuid, 0, 0;
    RETURN;
  END IF;

  IF v_candidate_count > 1 THEN
    RETURN QUERY SELECT 'ambiguous'::text, NULL::uuid, 0, 0;
    RETURN;
  END IF;

  SELECT *
    INTO v_customer
  FROM public.customers c
  WHERE lower(c.email) = v_email_norm
    AND (c.auth_user_id IS NULL OR c.auth_user_id = v_auth_user_id)
  LIMIT 1;

  IF v_customer.auth_user_id IS NOT NULL AND v_customer.auth_user_id <> v_auth_user_id THEN
    RETURN QUERY SELECT 'already_linked'::text, v_customer.id, 0, 0;
    RETURN;
  END IF;

  UPDATE public.customers
  SET auth_user_id = v_auth_user_id,
      updated_at = now()
  WHERE id = v_customer.id;

  UPDATE public.jobs j
  SET customer_id = v_customer.id
  WHERE j.customer_id IS NULL
    AND lower(COALESCE(j.client_email, '')) = v_email_norm
    AND COALESCE(j.organization_id, (SELECT organization_id FROM public.business_info bi WHERE bi.id = j.business_id)) = v_customer.organization_id;
  GET DIAGNOSTICS v_jobs_count = ROW_COUNT;

  UPDATE public.invoices i
  SET customer_id = v_customer.id
  WHERE i.customer_id IS NULL
    AND lower(COALESCE(i.client_email, '')) = v_email_norm
    AND COALESCE(i.organization_id, (SELECT organization_id FROM public.business_info bi WHERE bi.id = i.business_id)) = v_customer.organization_id;
  GET DIAGNOSTICS v_invoices_count = ROW_COUNT;

  IF to_regclass('public.portal_funnel_events') IS NOT NULL THEN
    INSERT INTO public.portal_funnel_events (organization_id, customer_id, event_type, metadata)
    VALUES (
      v_customer.organization_id,
      v_customer.id,
      'login',
      jsonb_build_object(
        'source', 'gmail_auto_link',
        'request_user_agent', p_request_user_agent
      )
    );
  END IF;

  RETURN QUERY SELECT 'linked'::text, v_customer.id, v_jobs_count, v_invoices_count;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_link_gmail_portal_account(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_link_gmail_portal_account(text, text) TO authenticated;
