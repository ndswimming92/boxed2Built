-- F6: create_portal_account_link_token(_v1) returned the RAW one-time link token
-- to the caller. A signed-in user could therefore request a token for any other
-- person's unlinked customer record and consume it immediately, without ever
-- receiving the verification email. Token creation now happens server-side only:
-- the send-portal-link-email edge function calls this v2 routine with the service
-- role, mails the link to the address on file, and returns no token to the browser.

CREATE OR REPLACE FUNCTION public.create_portal_account_link_token_v2(
  p_auth_user_id uuid,
  p_email text,
  p_verification_method text DEFAULT 'email',
  p_request_user_agent text DEFAULT NULL
)
RETURNS TABLE(status text, token text, delivery_target text, expires_at timestamptz, customer_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_auth_user_id uuid := p_auth_user_id;
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
      COALESCE(
        (SELECT organization_id FROM public.customers WHERE auth_user_id = v_auth_user_id LIMIT 1),
        (SELECT id FROM public.organizations LIMIT 1)
      ),
      jsonb_build_object('event', 'portal_account_link_attempt', 'reason', 'no_match')
    );

    RETURN QUERY SELECT 'no_match'::text, NULL::text, NULL::text, NULL::timestamptz, NULL::uuid;
    RETURN;
  END IF;

  IF v_candidate_count > 1 THEN
    INSERT INTO public.customer_identity_review_queue (
      source_table, source_pk, organization_id, candidate_email, reason, payload, status
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
    customer_id, organization_id, email, verification_method,
    token_hash, expires_at, created_by_auth_user_id, request_ip, request_user_agent
  ) VALUES (
    v_customer.id, v_customer.organization_id, v_email_norm, v_method,
    v_token_hash, v_expiry, v_auth_user_id, v_ip, p_request_user_agent
  );

  RETURN QUERY
  SELECT
    'token_created'::text,
    v_token,
    CASE WHEN v_method = 'sms' THEN v_customer.phone ELSE v_customer.email END,
    v_expiry,
    v_customer.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_portal_account_link_token_v2(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_portal_account_link_token_v2(uuid, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.create_portal_account_link_token_v2(uuid, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_portal_account_link_token_v2(uuid, text, text, text) TO service_role;

-- The browser-callable versions that leaked the token are closed off.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('create_portal_account_link_token', 'create_portal_account_link_token_v1')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', r.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', r.sig);
  END LOOP;
END $$;
