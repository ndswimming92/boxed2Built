/*
  # Fix pgcrypto search_path for consume_portal_account_link_token and submit_account_deletion_request

  ## Summary
  Both functions call digest() or gen_random_bytes() from pgcrypto, which lives
  in the 'extensions' schema. Without 'extensions' in the search_path these calls
  fail at runtime. This migration drops and recreates both functions with the
  correct search_path = public, extensions.
*/

DROP FUNCTION IF EXISTS public.consume_portal_account_link_token(text, text);
DROP FUNCTION IF EXISTS public.submit_account_deletion_request(integer);

CREATE FUNCTION public.consume_portal_account_link_token(
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

  RETURN QUERY SELECT 'linked'::text, v_customer.id, v_jobs_count, v_invoices_count;
END;
$$;

CREATE FUNCTION public.submit_account_deletion_request(
  p_grace_period_days integer
)
RETURNS public.customer_privacy_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_customer_id uuid := public.current_customer_id();
  v_request public.customer_privacy_requests;
BEGIN
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'No linked customer account found.';
  END IF;

  INSERT INTO public.customer_privacy_requests (
    customer_id, organization_id, request_type, status,
    confirmation_token, grace_period_ends_at, metadata
  )
  SELECT
    c.id,
    c.organization_id,
    'account_deletion',
    'pending_confirmation',
    encode(gen_random_bytes(16), 'hex'),
    now() + make_interval(days => GREATEST(1, COALESCE(p_grace_period_days, 30))),
    jsonb_build_object(
      'channel', 'portal_privacy',
      'grace_period_days', GREATEST(1, COALESCE(p_grace_period_days, 30))
    )
  FROM public.customers c
  WHERE c.id = v_customer_id
  RETURNING * INTO v_request;

  PERFORM public.log_privacy_event(
    v_request.organization_id,
    v_request.customer_id,
    'customer',
    'deletion_requested',
    'customer_privacy_requests',
    v_request.id,
    jsonb_build_object(
      'status', v_request.status,
      'grace_period_ends_at', v_request.grace_period_ends_at
    )
  );

  RETURN v_request;
END;
$$;
