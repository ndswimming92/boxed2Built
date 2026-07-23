/*
  # OAuth State Tracking + Vault Helper Functions

  1. New Tables
    - `oauth_states` - short-lived, single-use records that bind a random
      `state` value to the admin who started an OAuth connect flow. Used to
      defend the Google Business Profile (and future provider) OAuth
      handshake against CSRF: the callback only proceeds if the `state` it
      receives matches an unexpired row here.
      - `id` (uuid, primary key)
      - `state` (text, unique) - random token round-tripped through the
        provider's OAuth redirect
      - `provider` (text) - which integration this handshake is for
      - `created_by` (uuid, references auth.users) - the admin who initiated it
      - `created_at` / `expires_at` (timestamptz) - handshakes expire after
        10 minutes; the callback rejects anything older

  2. Security
    - RLS enabled with no policies: only the service role (used exclusively
      by the two OAuth edge functions) can read or write this table. No
      admin or anon access is needed or granted.

  3. Vault helper functions
    - `store_vault_secret(p_secret, p_name)` - thin SECURITY DEFINER wrapper
      around `vault.create_secret`, since the `vault` schema is not exposed
      to PostgREST/RPC directly. Used to store OAuth tokens for
      `integration_connections` without ever putting them in a plain table
      column. Restricted to the service role only.
*/

CREATE TABLE IF NOT EXISTS oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text NOT NULL UNIQUE,
  provider text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes')
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON oauth_states(state);

ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: only the service role (edge functions) touches
-- this table, and RLS with zero policies denies all other access by default.

CREATE OR REPLACE FUNCTION public.store_vault_secret(p_secret text, p_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT vault.create_secret(p_secret, p_name) INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.store_vault_secret(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_vault_secret(text, text) TO service_role;

COMMENT ON FUNCTION public.store_vault_secret(text, text) IS
  'Service-role-only wrapper around vault.create_secret, used to store OAuth tokens for integration_connections.';
