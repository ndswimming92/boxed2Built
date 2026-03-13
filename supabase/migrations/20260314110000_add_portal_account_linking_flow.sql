/*
  # Add portal account linking flow

  ## Summary
  1) Add short-lived, single-use link token table with hashed token storage.
  2) Add helper functions to create and consume account-link tokens.
  3) Attach matching customer/job/invoice records to authenticated customer accounts.
  4) Log link attempts/successes to admin_audit_logs including source IP + user agent.
  5) Queue ambiguous matches in customer_identity_review_queue for admin review.
*/

CREATE TABLE IF NOT EXISTS public.portal_account_link_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  verification_method text NOT NULL CHECK (verification_method IN ('email', 'sms')),
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_by_auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  request_ip text,
  request_user_agent text
);

CREATE UNIQUE INDEX IF NOT EXISTS portal_account_link_tokens_token_hash_unique
  ON public.portal_account_link_tokens(token_hash);

CREATE INDEX IF NOT EXISTS portal_account_link_tokens_lookup_idx
  ON public.portal_account_link_tokens(customer_id, expires_at)
  WHERE consumed_at IS NULL;

ALTER TABLE public.portal_account_link_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can create account-link tokens" ON public.portal_account_link_tokens;
CREATE POLICY "Customers can create account-link tokens"
  ON public.portal_account_link_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by_auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Customers can view own account-link tokens" ON public.portal_account_link_tokens;
CREATE POLICY "Customers can view own account-link tokens"
  ON public.portal_account_link_tokens
  FOR SELECT
  TO authenticated
  USING (created_by_auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Service role can update account-link tokens" ON public.portal_account_link_tokens;
CREATE POLICY "Service role can update account-link tokens"
  ON public.portal_account_link_tokens
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.get_request_ip_from_headers()
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  headers json;
  xff text;
BEGIN
  BEGIN
    headers := current_setting('request.headers', true)::json;
  EXCEPTION WHEN OTHERS THEN
    headers := NULL;
  END;

  IF headers IS NULL THEN
    RETURN NULL;
  END IF;

  xff := COALESCE(
    headers ->> 'x-forwarded-for',
    headers ->> 'x-real-ip',
    headers ->> 'cf-connecting-ip'
  );

  IF xff IS NULL OR btrim(xff) = '' THEN
    RETURN NULL;
  END IF;

  RETURN split_part(xff, ',', 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_portal_account_link_token(
  p_email text,
  p_verification_method text,
  p_request_user_agent text DEFAULT NULL
)
RETURNS TABLE (
  status text,
  token text,
  delivery_target text,
  expires_at timestamptz,
  customer_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_email_norm text := NULLIF(lower(btrim(p_email)), '');
  v_method text := lower(btrim(COALESCE(p_verification_method, '')));
  v_candidate_count integer;
  v_customer public.customers%ROWTYPE;
  v_token text;
  v_token_hash text;
  v_expiry timestamptz := now() + interval '15 minutes';
  v_ip text := public.get_request_ip_from_headers();
BEGIN
  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF v_email_norm IS NULL THEN
    RAISE EXCEPTION 'Email is required';
  END IF;

  IF v_method NOT IN ('email', 'sms') THEN
    RAISE EXCEPTION 'Invalid verification method';
  END IF;

  SELECT COUNT(*)
    INTO v_candidate_count
  FROM public.customers c
  WHERE lower(c.email) = v_email_norm
    AND (c.auth_user_id IS NULL OR c.auth_user_id = v_auth_user_id);

  IF v_candidate_count = 0 THEN
    INSERT INTO public.admin_audit_logs (
      user_id, user_email, action_type, table_name, record_identifier,
      status, error_message, ip_address, user_agent, organization_id, metadata
    )
    VALUES (
      v_auth_user_id,
      COALESCE((SELECT email FROM auth.users WHERE id = v_auth_user_id), 'unknown'),
      'SUBMIT',
      'portal_account_link_tokens',
      v_email_norm,
      'error',
      'No matching customer records found for account-link request',
      v_ip,
      p_request_user_agent,
      COALESCE((SELECT organization_id FROM public.customers WHERE auth_user_id = v_auth_user_id LIMIT 1), (SELECT id FROM public.organizations LIMIT 1)),
      jsonb_build_object('event', 'portal_account_link_attempt', 'reason', 'no_match')
    );

    RETURN QUERY SELECT 'no_match'::text, NULL::text, NULL::text, NULL::timestamptz, NULL::uuid;
    RETURN;
  END IF;

  IF v_candidate_count > 1 THEN
    INSERT INTO public.customer_identity_review_queue (
      source_table,
      source_pk,
      organization_id,
      candidate_email,
      reason,
      payload,
      status
    )
    SELECT
      'portal_account_link_tokens',
      gen_random_uuid(),
      MIN(c.organization_id),
      v_email_norm,
      'ambiguous_portal_account_match',
      jsonb_build_object(
        'auth_user_id', v_auth_user_id,
        'candidate_customer_ids', array_agg(c.id),
        'candidate_organization_ids', array_agg(c.organization_id),
        'requested_verification_method', v_method
      ),
      'pending'
    FROM public.customers c
    WHERE lower(c.email) = v_email_norm
      AND (c.auth_user_id IS NULL OR c.auth_user_id = v_auth_user_id)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.admin_audit_logs (
      user_id, user_email, action_type, table_name, record_identifier,
      status, error_message, ip_address, user_agent, organization_id, metadata
    )
    VALUES (
      v_auth_user_id,
      COALESCE((SELECT email FROM auth.users WHERE id = v_auth_user_id), 'unknown'),
      'SUBMIT',
      'portal_account_link_tokens',
      v_email_norm,
      'warning',
      'Multiple customer records matched; sent to admin review queue',
      v_ip,
      p_request_user_agent,
      COALESCE((SELECT organization_id FROM public.customers WHERE lower(email) = v_email_norm LIMIT 1), (SELECT id FROM public.organizations LIMIT 1)),
      jsonb_build_object('event', 'portal_account_link_attempt', 'reason', 'ambiguous_match', 'candidate_count', v_candidate_count)
    );

    RETURN QUERY SELECT 'ambiguous'::text, NULL::text, NULL::text, NULL::timestamptz, NULL::uuid;
    RETURN;
  END IF;

  SELECT *
    INTO v_customer
  FROM public.customers c
  WHERE lower(c.email) = v_email_norm
    AND (c.auth_user_id IS NULL OR c.auth_user_id = v_auth_user_id)
  LIMIT 1;

  IF v_method = 'sms' AND (v_customer.phone IS NULL OR btrim(v_customer.phone) = '') THEN
    RAISE EXCEPTION 'SMS verification unavailable: no phone number is on file for this customer.';
  END IF;

  v_token := encode(gen_random_bytes(24), 'hex');
  v_token_hash := encode(digest(v_token, 'sha256'), 'hex');

  INSERT INTO public.portal_account_link_tokens (
    customer_id,
    organization_id,
    email,
    verification_method,
    token_hash,
    expires_at,
    created_by_auth_user_id,
    request_ip,
    request_user_agent
  ) VALUES (
    v_customer.id,
    v_customer.organization_id,
    v_email_norm,
    v_method,
    v_token_hash,
    v_expiry,
    v_auth_user_id,
    v_ip,
    p_request_user_agent
  );

  INSERT INTO public.admin_audit_logs (
    user_id, user_email, action_type, table_name, record_identifier,
    status, ip_address, user_agent, organization_id, metadata
  )
  VALUES (
    v_auth_user_id,
    COALESCE((SELECT email FROM auth.users WHERE id = v_auth_user_id), 'unknown'),
    'SUBMIT',
    'portal_account_link_tokens',
    v_email_norm,
    'success',
    v_ip,
    p_request_user_agent,
    v_customer.organization_id,
    jsonb_build_object('event', 'portal_account_link_attempt', 'verification_method', v_method)
  );

  RETURN QUERY
  SELECT
    'token_created'::text,
    v_token,
    CASE WHEN v_method = 'sms' THEN v_customer.phone ELSE v_customer.email END,
    v_expiry,
    v_customer.id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_portal_account_link_token(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_portal_account_link_token(text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.consume_portal_account_link_token(
  p_token text,
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
    INSERT INTO public.admin_audit_logs (
      user_id, user_email, action_type, table_name, record_identifier,
      status, error_message, ip_address, user_agent, organization_id, metadata
    )
    VALUES (
      v_auth_user_id,
      COALESCE((SELECT email FROM auth.users WHERE id = v_auth_user_id), 'unknown'),
      'APPROVE',
      'portal_account_link_tokens',
      'token_validation',
      'error',
      'Invalid, expired, or already used account-link token',
      v_ip,
      p_request_user_agent,
      COALESCE((SELECT organization_id FROM public.customers WHERE auth_user_id = v_auth_user_id LIMIT 1), (SELECT id FROM public.organizations LIMIT 1)),
      jsonb_build_object('event', 'portal_account_link_validation', 'result', 'invalid_token')
    );

    RETURN QUERY SELECT 'invalid_token'::text, NULL::uuid, 0, 0;
    RETURN;
  END IF;

  SELECT * INTO v_customer
  FROM public.customers c
  WHERE c.id = v_token_row.customer_id
  LIMIT 1;

  IF v_customer.auth_user_id IS NOT NULL AND v_customer.auth_user_id <> v_auth_user_id THEN
    INSERT INTO public.admin_audit_logs (
      user_id, user_email, action_type, table_name, record_identifier,
      status, error_message, ip_address, user_agent, organization_id, metadata
    )
    VALUES (
      v_auth_user_id,
      COALESCE((SELECT email FROM auth.users WHERE id = v_auth_user_id), 'unknown'),
      'APPROVE',
      'portal_account_link_tokens',
      v_customer.email,
      'error',
      'Customer record is already linked to another user',
      v_ip,
      p_request_user_agent,
      v_customer.organization_id,
      jsonb_build_object('event', 'portal_account_link_validation', 'result', 'already_linked')
    );

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

  INSERT INTO public.admin_audit_logs (
    user_id, user_email, action_type, table_name, record_identifier,
    status, ip_address, user_agent, organization_id, metadata
  )
  VALUES (
    v_auth_user_id,
    COALESCE((SELECT email FROM auth.users WHERE id = v_auth_user_id), 'unknown'),
    'APPROVE',
    'portal_account_link_tokens',
    v_customer.email,
    'success',
    v_ip,
    p_request_user_agent,
    v_customer.organization_id,
    jsonb_build_object(
      'event', 'portal_account_link_success',
      'customer_id', v_customer.id,
      'linked_jobs', v_jobs_count,
      'linked_invoices', v_invoices_count
    )
  );

  RETURN QUERY SELECT 'linked'::text, v_customer.id, v_jobs_count, v_invoices_count;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_portal_account_link_token(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_portal_account_link_token(text, text) TO authenticated;
