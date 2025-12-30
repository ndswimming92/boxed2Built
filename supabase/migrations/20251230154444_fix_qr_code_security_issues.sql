/*
  # Fix QR Code Security Issues

  1. Policy Consolidation
    - Remove duplicate permissive policies for qr_codes and qr_code_schedules
    - Keep single comprehensive policies for authenticated and public access

  2. Function Security
    - Add stable search_path to update_qr_code_timestamp function

  3. Index Optimization
    - Keep essential indexes for performance
    - Remove redundant status index that provides minimal benefit

  4. Important Notes
    - Slug and foreign key indexes are critical for lookups
    - DateTime indexes are essential for schedule queries
    - Some indexes appear unused because system is new, but will be used in production
*/

-- Drop duplicate policies and create single comprehensive ones for qr_codes
DROP POLICY IF EXISTS "Public can read active QR codes" ON qr_codes;
DROP POLICY IF EXISTS "Authenticated users can view all QR codes" ON qr_codes;

CREATE POLICY "Anyone can read active QR codes for redirects"
  ON qr_codes FOR SELECT
  USING (status = 'active' OR auth.role() = 'authenticated');

-- Drop duplicate policies and create single comprehensive ones for qr_code_schedules
DROP POLICY IF EXISTS "Public can read active schedules" ON qr_code_schedules;
DROP POLICY IF EXISTS "Authenticated users can view all schedules" ON qr_code_schedules;

CREATE POLICY "Anyone can read schedules for active QR codes"
  ON qr_code_schedules FOR SELECT
  USING (
    (is_active = true AND EXISTS (
      SELECT 1 FROM qr_codes 
      WHERE qr_codes.id = qr_code_schedules.qr_code_id 
      AND qr_codes.status = 'active'
    ))
    OR auth.role() = 'authenticated'
  );

-- Fix function search path by recreating with immutable search_path
-- Drop triggers first
DROP TRIGGER IF EXISTS update_qr_codes_timestamp ON qr_codes;
DROP TRIGGER IF EXISTS update_qr_code_schedules_timestamp ON qr_code_schedules;

-- Drop and recreate function with secure search_path
DROP FUNCTION IF EXISTS update_qr_code_timestamp();

CREATE OR REPLACE FUNCTION update_qr_code_timestamp()
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

-- Recreate triggers
CREATE TRIGGER update_qr_codes_timestamp
  BEFORE UPDATE ON qr_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_qr_code_timestamp();

CREATE TRIGGER update_qr_code_schedules_timestamp
  BEFORE UPDATE ON qr_code_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_qr_code_timestamp();

-- Remove non-essential indexes that provide minimal query performance benefit
-- Keep critical indexes: slug (for redirects), foreign keys, and datetime (for schedule logic)

-- Remove status index - status filtering is not a primary query pattern
DROP INDEX IF EXISTS idx_qr_codes_status;

-- Keep these essential indexes:
-- idx_qr_codes_slug - Critical for public redirect lookups
-- idx_qr_codes_business_id - Critical for admin listing
-- idx_qr_code_schedules_qr_code_id - Critical for schedule lookups
-- idx_qr_code_schedules_datetime - Critical for active schedule detection
-- idx_qr_scans_qr_code_id - Critical for analytics
-- idx_qr_scans_scanned_at - Critical for time-series analytics