/*
  # Gallery Social Publish Columns + Vault Read Helper

  1. Changes to `gallery_items`
    - `facebook_post_id` (text) - the Graph API photo/post id once published
    - `facebook_posted_at` (timestamptz) - when the Facebook publish succeeded
    - `facebook_post_error` (text) - last error message, if the last attempt failed
    - `instagram_post_id` (text) - the published Instagram media id
    - `instagram_posted_at` (timestamptz) - when the Instagram publish succeeded
    - `instagram_post_error` (text) - last error message, if the last attempt failed

    These are written only by the `publish-gallery-photo` edge function (via the
    service role), so no RLS changes are needed — existing gallery_items
    policies already let organization members read them.

  2. Vault helper
    - `read_vault_secret(p_name text)` - SECURITY DEFINER wrapper that returns a
      decrypted secret's value by name, mirroring `store_vault_secret`. Needed
      so edge functions can retrieve the Facebook Page token stored during the
      OAuth connect flow. Restricted to the service role only.
*/

ALTER TABLE gallery_items
  ADD COLUMN IF NOT EXISTS facebook_post_id text,
  ADD COLUMN IF NOT EXISTS facebook_posted_at timestamptz,
  ADD COLUMN IF NOT EXISTS facebook_post_error text,
  ADD COLUMN IF NOT EXISTS instagram_post_id text,
  ADD COLUMN IF NOT EXISTS instagram_posted_at timestamptz,
  ADD COLUMN IF NOT EXISTS instagram_post_error text;

CREATE OR REPLACE FUNCTION public.read_vault_secret(p_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = p_name;
  RETURN v_secret;
END;
$$;

REVOKE ALL ON FUNCTION public.read_vault_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_vault_secret(text) TO service_role;

COMMENT ON FUNCTION public.read_vault_secret(text) IS
  'Service-role-only wrapper around vault.decrypted_secrets, used to retrieve OAuth tokens stored for integration_connections.';
