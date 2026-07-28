/*
  # Claude API usage budget settings

  1. New Tables
    - `claude_usage_settings` - singleton row holding the admin-configured
      monthly budget for Claude API spend, used by the Claude Usage admin
      page to compute "remaining budget". Actual usage/cost figures are
      fetched live from Anthropic's Usage & Cost Admin API by the
      `get-claude-usage` edge function and are never persisted here.
      - `id` (boolean, primary key, always `true`) - enforces a single row
      - `monthly_budget_usd` (numeric) - admin-set monthly spend budget
      - `updated_at` (timestamptz)
      - `updated_by` (uuid, references auth.users)

  2. Security
    - Enable RLS
    - Platform admins have full read/write access (same `is_platform_admin()`
      helper used by the API Keys and Connections tables)
    - No anon access

  3. Notes
    - Seeded with a single row (`monthly_budget_usd = 0`) so the settings
      page always has a row to read/update rather than needing insert logic
      in the frontend.
*/

CREATE TABLE IF NOT EXISTS claude_usage_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  monthly_budget_usd numeric(10,2) NOT NULL DEFAULT 0 CHECK (monthly_budget_usd >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE claude_usage_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins have full access to claude_usage_settings"
  ON claude_usage_settings FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

INSERT INTO claude_usage_settings (id, monthly_budget_usd)
VALUES (true, 0)
ON CONFLICT (id) DO NOTHING;
