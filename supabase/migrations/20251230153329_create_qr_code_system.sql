/*
  # QR Code Management System

  1. New Tables
    - qr_codes: Main table storing QR code metadata and default destination
    - qr_code_schedules: Time-based redirects with priority system
    - qr_scans: Comprehensive analytics tracking for each scan

  2. Security
    - Enable RLS on all tables
    - Admin users can fully manage QR codes
    - Public can read qr_codes and schedules for redirect logic
    - Public can insert scan records for analytics

  3. Indexes
    - Fast slug lookups for redirects
    - Optimized analytics queries on scanned_at
    - Efficient schedule time-based queries

  4. Important Notes
    - Slugs are globally unique
    - Overlapping schedules resolved by priority
    - All timestamps in UTC
*/

-- Create qr_codes table
CREATE TABLE IF NOT EXISTS qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text DEFAULT '',
  default_destination_url text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create qr_code_schedules table
CREATE TABLE IF NOT EXISTS qr_code_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_code_id uuid NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,
  destination_url text NOT NULL,
  start_datetime timestamptz NOT NULL,
  end_datetime timestamptz NOT NULL,
  priority integer NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_datetime_range CHECK (end_datetime > start_datetime)
);

-- Create qr_scans table
CREATE TABLE IF NOT EXISTS qr_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_code_id uuid NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,
  scanned_at timestamptz DEFAULT now(),
  user_agent text DEFAULT '',
  device_type text DEFAULT '',
  browser text DEFAULT '',
  os text DEFAULT '',
  referrer text DEFAULT '',
  ip_address text DEFAULT '',
  country text DEFAULT '',
  city text DEFAULT '',
  utm_source text DEFAULT '',
  utm_medium text DEFAULT '',
  utm_campaign text DEFAULT ''
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_qr_codes_slug ON qr_codes(slug);
CREATE INDEX IF NOT EXISTS idx_qr_codes_business_id ON qr_codes(business_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_status ON qr_codes(status);
CREATE INDEX IF NOT EXISTS idx_qr_code_schedules_qr_code_id ON qr_code_schedules(qr_code_id);
CREATE INDEX IF NOT EXISTS idx_qr_code_schedules_datetime ON qr_code_schedules(start_datetime, end_datetime);
CREATE INDEX IF NOT EXISTS idx_qr_scans_qr_code_id ON qr_scans(qr_code_id);
CREATE INDEX IF NOT EXISTS idx_qr_scans_scanned_at ON qr_scans(scanned_at);

-- Enable Row Level Security
ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_code_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_scans ENABLE ROW LEVEL SECURITY;

-- Policies for qr_codes
CREATE POLICY "Public can read active QR codes"
  ON qr_codes FOR SELECT
  TO public
  USING (status = 'active');

CREATE POLICY "Authenticated users can view all QR codes"
  ON qr_codes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert QR codes"
  ON qr_codes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update QR codes"
  ON qr_codes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete QR codes"
  ON qr_codes FOR DELETE
  TO authenticated
  USING (true);

-- Policies for qr_code_schedules
CREATE POLICY "Public can read active schedules"
  ON qr_code_schedules FOR SELECT
  TO public
  USING (
    is_active = true 
    AND EXISTS (
      SELECT 1 FROM qr_codes 
      WHERE qr_codes.id = qr_code_schedules.qr_code_id 
      AND qr_codes.status = 'active'
    )
  );

CREATE POLICY "Authenticated users can view all schedules"
  ON qr_code_schedules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert schedules"
  ON qr_code_schedules FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update schedules"
  ON qr_code_schedules FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete schedules"
  ON qr_code_schedules FOR DELETE
  TO authenticated
  USING (true);

-- Policies for qr_scans
CREATE POLICY "Public can insert scan records"
  ON qr_scans FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view all scans"
  ON qr_scans FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete scans"
  ON qr_scans FOR DELETE
  TO authenticated
  USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_qr_code_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_qr_codes_timestamp
  BEFORE UPDATE ON qr_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_qr_code_timestamp();

CREATE TRIGGER update_qr_code_schedules_timestamp
  BEFORE UPDATE ON qr_code_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_qr_code_timestamp();