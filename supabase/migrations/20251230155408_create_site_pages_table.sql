/*
  # Create Site Pages Table for QR Code URLs

  1. New Tables
    - `site_pages`
      - `id` (uuid, primary key) - Unique identifier
      - `title` (text) - Display name for the page
      - `url_path` (text, unique) - The URL path (e.g., '/services', '/contact')
      - `description` (text, nullable) - Optional description of the page
      - `display_order` (integer) - Order for displaying in dropdowns
      - `is_active` (boolean) - Whether the page is currently available
      - `created_at` (timestamptz) - When the record was created
      - `updated_at` (timestamptz) - When the record was last updated

  2. Security
    - Enable RLS on `site_pages` table
    - Add policy for public read access to active pages
    - Add policy for authenticated admins to manage pages

  3. Data
    - Pre-populate with all current public pages
*/

-- Create site_pages table
CREATE TABLE IF NOT EXISTS site_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  url_path text UNIQUE NOT NULL,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE site_pages ENABLE ROW LEVEL SECURITY;

-- Policy for public read access to active pages
CREATE POLICY "Anyone can view active site pages"
  ON site_pages
  FOR SELECT
  USING (is_active = true);

-- Policy for authenticated admins to view all pages
CREATE POLICY "Admins can view all site pages"
  ON site_pages
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy for authenticated admins to insert pages
CREATE POLICY "Admins can insert site pages"
  ON site_pages
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy for authenticated admins to update pages
CREATE POLICY "Admins can update site pages"
  ON site_pages
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy for authenticated admins to delete pages
CREATE POLICY "Admins can delete site pages"
  ON site_pages
  FOR DELETE
  TO authenticated
  USING (true);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_site_pages_active ON site_pages(is_active);
CREATE INDEX IF NOT EXISTS idx_site_pages_display_order ON site_pages(display_order);

-- Insert default site pages
INSERT INTO site_pages (title, url_path, description, display_order, is_active) VALUES
  ('Home', '/', 'Main landing page', 1, true),
  ('Services', '/services', 'Services we offer', 2, true),
  ('About Us', '/about', 'About our business', 3, true),
  ('Contact', '/contact', 'Contact information and form', 4, true),
  ('Gallery', '/gallery', 'Photo gallery of our work', 5, true),
  ('Partners', '/partners', 'Our trusted partners', 6, true),
  ('FAQ', '/faq', 'Frequently asked questions', 7, true),
  ('Request Lookup', '/request-lookup', 'Look up saved requests', 8, true),
  ('Privacy Policy', '/privacy-policy', 'Privacy policy', 9, true),
  ('Terms of Service', '/terms-of-service', 'Terms of service', 10, true)
ON CONFLICT (url_path) DO NOTHING;