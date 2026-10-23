/*
  # Harden request-IP derivation and anon access to account-deletion confirm

  1. Request IP
    - The per-IP throttles on code lookups, form audit logging and coupon
      lookups all key on get_request_ip_from_headers(). It took the FIRST
      x-forwarded-for entry, which is the one a caller can write themselves, so
      rotating that header would reset every throttle.
    - cf-connecting-ip is set by Cloudflare in front of the API and replaces
      any client-supplied value, so it is read first. When it is absent the old
      order applies, so behaviour only changes where a trusted header exists.

  2. confirm_account_deletion_request
    - It resolves the caller through current_customer_id(), which is NULL for
      anon, so an anonymous call could never match a row. Revoking EXECUTE from
      anon removes it from the public RPC surface without changing behaviour.
*/

CREATE OR REPLACE FUNCTION public.get_request_ip_from_headers()
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
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
NULLIF(btrim(headers ->> 'cf-connecting-ip'), ''),
headers ->> 'x-forwarded-for',
headers ->> 'x-real-ip'
);

IF xff IS NULL OR btrim(xff) = '' THEN
RETURN NULL;
END IF;

RETURN btrim(split_part(xff, ',', 1));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.confirm_account_deletion_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_account_deletion_request(uuid, text) TO authenticated;
