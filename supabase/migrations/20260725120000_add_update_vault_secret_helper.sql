/*
  # Vault Update Helper + YouTube Provider

  1. New function
    - `update_vault_secret(p_name, p_secret)` - SECURITY DEFINER wrapper around
      `vault.update_secret`, mirroring `store_vault_secret` and
      `read_vault_secret`. Lets an edge function persist a refreshed OAuth
      access token in place (e.g. Google's short-lived access tokens) without
      creating a duplicate secret or changing `vault_secret_name` on the
      owning `integration_connections` row. Restricted to the service role.

  2. Changes
    - Extends the `integration_connections.provider` check constraint to allow
      `'youtube'`, since YouTube uploads reuse the existing Google OAuth
      connection (broadened scope) as a distinct connection row.
*/

ALTER TABLE integration_connections DROP CONSTRAINT IF EXISTS integration_connections_provider_check;
ALTER TABLE integration_connections ADD CONSTRAINT integration_connections_provider_check
  CHECK (provider IN (
    'instagram', 'facebook', 'google_business', 'youtube', 'tiktok', 'twitter', 'linkedin', 'other'
  ));

CREATE OR REPLACE FUNCTION public.update_vault_secret(p_name text, p_secret text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = p_name;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Secret not found: %', p_name;
  END IF;
  PERFORM vault.update_secret(v_id, p_secret);
END;
$$;

REVOKE ALL ON FUNCTION public.update_vault_secret(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_vault_secret(text, text) TO service_role;

COMMENT ON FUNCTION public.update_vault_secret(text, text) IS
  'Service-role-only wrapper around vault.update_secret, used to refresh stored OAuth tokens in place.';
