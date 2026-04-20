/*
  # Create App Branding Table

  1. New Tables
    - `app_branding`
      - `id` (uuid, primary key) - Unique identifier
      - `scope` (text, unique) - Branding scope ("admin" for admin Home Screen, extensible to other scopes)
      - `theme_color` (text) - Hex color used for the PWA tile background and theme-color meta tag
      - `title` (text) - Long app title shown under tile on some platforms
      - `short_name` (text) - Short app title shown under Home Screen icon
      - `status_bar_style` (text) - iOS status bar style ("default", "black", or "black-translucent")
      - `icon_url` (text, nullable) - Optional custom icon URL (overrides the built-in default)
      - `mark_text` (text) - The text displayed on the tile (e.g., "Admin")
      - `mark_color` (text) - Hex color of the mark text (e.g., white)
      - `updated_at` (timestamptz) - Last update timestamp
      - `created_at` (timestamptz) - Creation timestamp

  2. Seeds
    - Seed a row for the "admin" scope with dark blue (#1E3A8A) background and white "Admin" mark.

  3. Security
    - Enable RLS on `app_branding` table.
    - Public read access is allowed so the manifest swapper can load the branding
      anonymously before authentication (needed for the iOS Add-to-Home-Screen flow).
    - Write access is restricted to authenticated users only.
*/

CREATE TABLE IF NOT EXISTS app_branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text UNIQUE NOT NULL,
  theme_color text NOT NULL DEFAULT '#1E3A8A',
  title text NOT NULL DEFAULT 'Admin',
  short_name text NOT NULL DEFAULT 'Admin',
  status_bar_style text NOT NULL DEFAULT 'black-translucent',
  icon_url text,
  mark_text text NOT NULL DEFAULT 'Admin',
  mark_color text NOT NULL DEFAULT '#FFFFFF',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_branding ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_app_branding_scope ON app_branding(scope);

-- Seed the admin scope (idempotent)
INSERT INTO app_branding (scope, theme_color, title, short_name, status_bar_style, mark_text, mark_color)
VALUES ('admin', '#1E3A8A', 'Boxed2Built Admin', 'B2B Admin', 'black-translucent', 'Admin', '#FFFFFF')
ON CONFLICT (scope) DO NOTHING;

-- Public read so the manifest manager (which runs before auth) can fetch branding.
CREATE POLICY "Public can view branding"
  ON app_branding
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert branding"
  ON app_branding
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update branding"
  ON app_branding
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete branding"
  ON app_branding
  FOR DELETE
  TO authenticated
  USING (true);

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION update_app_branding_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_app_branding_updated_at_trigger ON app_branding;
CREATE TRIGGER update_app_branding_updated_at_trigger
  BEFORE UPDATE ON app_branding
  FOR EACH ROW
  EXECUTE FUNCTION update_app_branding_updated_at();
