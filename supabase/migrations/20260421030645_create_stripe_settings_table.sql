/*
  # Create stripe_settings table

  1. New Tables
    - `stripe_settings`
      - `id` (uuid, primary key)
      - `business_id` (uuid, unique, references business_info)
      - `organization_id` (uuid, references organizations)
      - `stripe_mode` (text, 'live' or 'test', default 'live')
      - `updated_at` (timestamptz, auto-updated)
      - `updated_by` (text, email of admin who last changed it)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `stripe_settings` table
    - Authenticated admins (organization members) can read and update
    - Insert policy for authenticated users to seed initial row

  3. Notes
    - This table stores the Stripe environment mode preference
    - Edge functions query this table at runtime to decide which Stripe key to use
    - Only one row per business (enforced by unique constraint on business_id)
*/

CREATE TABLE IF NOT EXISTS stripe_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid UNIQUE NOT NULL REFERENCES business_info(id),
  organization_id uuid REFERENCES organizations(id),
  stripe_mode text NOT NULL DEFAULT 'live' CHECK (stripe_mode IN ('live', 'test')),
  updated_at timestamptz DEFAULT now(),
  updated_by text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE stripe_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read stripe_settings"
  ON stripe_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = stripe_settings.organization_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can update stripe_settings"
  ON stripe_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = stripe_settings.organization_id
      AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = stripe_settings.organization_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can insert stripe_settings"
  ON stripe_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = stripe_settings.organization_id
      AND om.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_stripe_settings_business_id ON stripe_settings(business_id);
CREATE INDEX IF NOT EXISTS idx_stripe_settings_organization_id ON stripe_settings(organization_id);
