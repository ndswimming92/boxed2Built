/*
  # Track portal login funnel event when account linking succeeds

  ## Why
  Customers who link their existing records after signing in may not generate a
  login funnel event for the newly linked customer record. That leaves the admin
  Portal Adoption report stuck on "not invited" with empty login timestamps even
  though linking succeeded.

  ## What
  Recreate consume_portal_account_link_token to append a login funnel event for
  the linked customer when portal_funnel_events exists.
*/

CREATE OR REPLACE FUNCTION public.consume_portal_account_link_token(
  p_token text,
  p_request_user_agent text
)
RETURNS TABLE(
  status text,
  customer_id uuid,
  linked_jobs integer,
  linked_invoices integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_token_hash text := encode(digest(COALESCE(p_token, ''), 'sha256'), 'hex');
  v_token_row public.portal_account_link_tokens%ROWTYPE;
  v_customer public.customers%ROWTYPE;
  v_jobs_count integer := 0;
  v_invoices_count integer := 0;
  v_ip text := public.get_request_ip_from_headers();
BEGIN
  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_token_row
  FROM public.portal_account_link_tokens t
  WHERE t.token_hash = v_token_hash
    AND t.consumed_at IS NULL
    AND t.expires_at > now()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'invalid_token'::text, NULL::uuid, 0, 0;
    RETURN;
  END IF;

  SELECT * INTO v_customer
  FROM public.customers c
  WHERE c.id = v_token_row.customer_id
  LIMIT 1;

  IF v_customer.auth_user_id IS NOT NULL AND v_customer.auth_user_id <> v_auth_user_id THEN
    RETURN QUERY SELECT 'already_linked'::text, v_customer.id, 0, 0;
    RETURN;
  END IF;

  UPDATE public.customers
  SET auth_user_id = v_auth_user_id, updated_at = now()
  WHERE id = v_customer.id;

  UPDATE public.jobs j
  SET customer_id = v_customer.id
  WHERE j.customer_id IS NULL
    AND lower(COALESCE(j.client_email, '')) = lower(COALESCE(v_customer.email, ''))
    AND COALESCE(j.organization_id, (SELECT organization_id FROM public.business_info bi WHERE bi.id = j.business_id)) = v_customer.organization_id;
  GET DIAGNOSTICS v_jobs_count = ROW_COUNT;

  UPDATE public.invoices i
  SET customer_id = v_customer.id
  WHERE i.customer_id IS NULL
    AND lower(COALESCE(i.client_email, '')) = lower(COALESCE(v_customer.email, ''))
    AND COALESCE(i.organization_id, (SELECT organization_id FROM public.business_info bi WHERE bi.id = i.business_id)) = v_customer.organization_id;
  GET DIAGNOSTICS v_invoices_count = ROW_COUNT;

  UPDATE public.portal_account_link_tokens
  SET consumed_at = now()
  WHERE id = v_token_row.id;

  IF to_regclass('public.portal_funnel_events') IS NOT NULL THEN
    INSERT INTO public.portal_funnel_events (organization_id, customer_id, event_type, metadata)
    VALUES (
      v_customer.organization_id,
      v_customer.id,
      'login',
      jsonb_build_object(
        'source', 'account_link_token',
        'request_user_agent', p_request_user_agent,
        'request_ip', v_ip
      )
    );
  END IF;

  RETURN QUERY SELECT 'linked'::text, v_customer.id, v_jobs_count, v_invoices_count;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_portal_account_link_token(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_portal_account_link_token(text, text) TO authenticated;
