/*
  # Create API Platform System

  1. New Tables
    - `api_keys` - keys issued to external tools/integrations to call the public API
      - `id` (uuid, primary key)
      - `name` (text, required) - Human label, e.g. "Zapier - new inquiries"
      - `key_prefix` (text, required) - First characters of the key (e.g. "b2b_live_a1b2c3")
        kept for display and support; the full key is NEVER stored
      - `key_hash` (text, unique, required) - SHA-256 hex digest of the full key;
        validation hashes the presented key and looks it up here
      - `scopes` (text[], required) - Granted permissions, e.g. {inquiries:read,jobs:read}
      - `rate_limit_per_minute` (integer) - Rolling-window request cap for this key
      - `expires_at` (timestamptz) - Optional expiry; null = never expires
      - `revoked_at` (timestamptz) - Set when revoked; revoked keys are permanently dead
      - `last_used_at` (timestamptz) - Updated (throttled) on API use
      - `created_by` (uuid, references auth.users)
      - `created_at` / `updated_at` (timestamptz)

    - `api_request_logs` - audit trail of every API request, also used for rate limiting
      - `id` (uuid, primary key)
      - `api_key_id` (uuid, references api_keys, cascade delete)
      - `method` / `path` / `status_code` - What was requested and the outcome
      - `error` (text) - Error message for failed requests
      - `ip_address` / `user_agent` (text) - Caller fingerprint
      - `created_at` (timestamptz)

    - `integration_connections` - outbound connections to third-party platforms
      (social media, other apps). OAuth tokens are stored in Supabase Vault and
      referenced by `vault_secret_name`; they never live in this table or reach
      the browser.
      - `id` (uuid, primary key)
      - `provider` (text, required) - e.g. instagram, facebook, google_business, tiktok
      - `account_label` (text) - Display name of the connected account
      - `account_identifier` (text) - Provider-side account/page id
      - `status` (text) - pending | connected | error | disconnected
      - `scopes` (text[]) - OAuth scopes granted by the provider
      - `vault_secret_name` (text) - Name of the Vault secret holding tokens
      - `token_expires_at` (timestamptz) - Access-token expiry for refresh scheduling
      - `last_synced_at` (timestamptz) / `sync_error` (text) - Sync health
      - `metadata` (jsonb) - Provider-specific extras
      - `created_by` (uuid, references auth.users)
      - `created_at` / `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all three tables
    - Platform admins have full access to `api_keys` and `integration_connections`
    - Platform admins can read `api_request_logs`; only the service role writes them
    - No anon access anywhere; API-key validation happens in edge functions using
      the service role

  3. Notes
    - Rate limiting counts recent `api_request_logs` rows per key, so no separate
      counter table is needed.
    - Revocation is soft (revoked_at) so the audit trail keeps the key's history.
*/

CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  scopes text[] NOT NULL DEFAULT '{}',
  rate_limit_per_minute integer NOT NULL DEFAULT 60 CHECK (rate_limit_per_minute > 0),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_created_at ON api_keys(created_at DESC);

CREATE TABLE IF NOT EXISTS api_request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  method text NOT NULL,
  path text NOT NULL,
  status_code integer NOT NULL,
  error text,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_request_logs_key_time
  ON api_request_logs(api_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_request_logs_created_at
  ON api_request_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS integration_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN (
    'instagram', 'facebook', 'google_business', 'tiktok', 'twitter', 'linkedin', 'other'
  )),
  account_label text,
  account_identifier text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'connected', 'error', 'disconnected'
  )),
  scopes text[] NOT NULL DEFAULT '{}',
  vault_secret_name text,
  token_expires_at timestamptz,
  last_synced_at timestamptz,
  sync_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_connections_provider
  ON integration_connections(provider);

-- updated_at triggers (shared helper already exists)
DROP TRIGGER IF EXISTS update_api_keys_updated_at ON api_keys;
CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_integration_connections_updated_at ON integration_connections;
CREATE TRIGGER update_integration_connections_updated_at
  BEFORE UPDATE ON integration_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins have full access to api_keys"
  ON api_keys FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

ALTER TABLE api_request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view api_request_logs"
  ON api_request_logs FOR SELECT TO authenticated
  USING (is_platform_admin());

ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins have full access to integration_connections"
  ON integration_connections FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());
