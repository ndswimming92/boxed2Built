-- Ensure RPC can resolve create_portal_account_link_token regardless of
-- whether callers send p_request_user_agent before p_verification_method.
ALTER FUNCTION public.create_portal_account_link_token(text, text, text)
  RENAME TO create_portal_account_link_token_v1;

CREATE OR REPLACE FUNCTION public.create_portal_account_link_token(
  p_email text,
  p_request_user_agent text DEFAULT NULL,
  p_verification_method text DEFAULT NULL
)
RETURNS TABLE (
  status text,
  token text,
  delivery_target text,
  expires_at timestamptz,
  customer_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.create_portal_account_link_token_v1(
    p_email,
    p_verification_method,
    p_request_user_agent
  );
$$;

REVOKE ALL ON FUNCTION public.create_portal_account_link_token(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_portal_account_link_token(text, text, text) TO authenticated;
