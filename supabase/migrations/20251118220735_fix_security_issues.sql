/*
  # Fix Security Issues

  1. Add Missing Foreign Key Indexes
    - Add indexes on all foreign key columns to improve query performance
    - business_address(business_id)
    - business_attributes(business_id)
    - customer_reviews(business_id)
    - forecast_accuracy(business_id)
    - gallery_items(business_id)
    - payment_methods(business_id)
    - saved_requests(inquiry_id)
    - service_areas(business_id)
    - services(business_id)
    - social_media(business_id)

  2. Fix Function Search Path Mutability
    - Add explicit schema qualification to functions
    - Set immutable search_path for security

  3. Remove Unused Indexes
    - Remove indexes that are not being used by queries
    - idx_notification_bar_is_enabled
    - idx_saved_requests_email_code
    - idx_saved_requests_confirmation_code
    - idx_saved_requests_submission_date
    - idx_saved_requests_business_id

  4. Fix Multiple Permissive Policies
    - Consolidate overlapping policies into single policies
    - notification_bar: Merge authenticated and public SELECT policies
    - saved_requests: Merge authenticated SELECT policies

  5. Notes
    - Leaked Password Protection must be enabled in Supabase Dashboard Settings
    - Navigate to: Authentication > Settings > Password Protection
    - This cannot be enabled via SQL migration
*/

-- ============================================================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_business_address_business_id
  ON business_address(business_id);

CREATE INDEX IF NOT EXISTS idx_business_attributes_business_id
  ON business_attributes(business_id);

CREATE INDEX IF NOT EXISTS idx_customer_reviews_business_id
  ON customer_reviews(business_id);

CREATE INDEX IF NOT EXISTS idx_forecast_accuracy_business_id
  ON forecast_accuracy(business_id);

CREATE INDEX IF NOT EXISTS idx_gallery_items_business_id
  ON gallery_items(business_id);

CREATE INDEX IF NOT EXISTS idx_payment_methods_business_id
  ON payment_methods(business_id);

CREATE INDEX IF NOT EXISTS idx_saved_requests_inquiry_id
  ON saved_requests(inquiry_id);

CREATE INDEX IF NOT EXISTS idx_service_areas_business_id
  ON service_areas(business_id);

CREATE INDEX IF NOT EXISTS idx_services_business_id
  ON services(business_id);

CREATE INDEX IF NOT EXISTS idx_social_media_business_id
  ON social_media(business_id);

-- ============================================================================
-- 2. FIX FUNCTION SEARCH PATH MUTABILITY
-- ============================================================================

-- Drop and recreate update_saved_requests_updated_at with explicit schema
DROP FUNCTION IF EXISTS update_saved_requests_updated_at() CASCADE;

CREATE OR REPLACE FUNCTION public.update_saved_requests_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS update_saved_requests_updated_at_trigger ON saved_requests;
CREATE TRIGGER update_saved_requests_updated_at_trigger
  BEFORE UPDATE ON saved_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_saved_requests_updated_at();

-- Drop and recreate track_saved_request_access with explicit schema
DROP FUNCTION IF EXISTS track_saved_request_access(uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.track_saved_request_access(request_id uuid)
RETURNS void
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.saved_requests
  SET
    last_accessed = now(),
    access_count = access_count + 1
  WHERE id = request_id;
END;
$$;

-- Drop and recreate update_notification_bar_updated_at with explicit schema
DROP FUNCTION IF EXISTS update_notification_bar_updated_at() CASCADE;

CREATE OR REPLACE FUNCTION public.update_notification_bar_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS update_notification_bar_updated_at_trigger ON notification_bar;
CREATE TRIGGER update_notification_bar_updated_at_trigger
  BEFORE UPDATE ON notification_bar
  FOR EACH ROW
  EXECUTE FUNCTION public.update_notification_bar_updated_at();

-- ============================================================================
-- 3. REMOVE UNUSED INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_notification_bar_is_enabled;
DROP INDEX IF EXISTS idx_saved_requests_email_code;
DROP INDEX IF EXISTS idx_saved_requests_confirmation_code;
DROP INDEX IF EXISTS idx_saved_requests_submission_date;
DROP INDEX IF EXISTS idx_saved_requests_business_id;

-- ============================================================================
-- 4. FIX MULTIPLE PERMISSIVE POLICIES
-- ============================================================================

-- Fix notification_bar policies
-- Drop existing overlapping policies
DROP POLICY IF EXISTS "Public can view enabled notifications" ON notification_bar;
DROP POLICY IF EXISTS "Authenticated users can view own business notifications" ON notification_bar;

-- Create single consolidated SELECT policy
CREATE POLICY "Allow public read of enabled notifications and admin read of all"
  ON notification_bar
  FOR SELECT
  USING (
    is_enabled = true
    OR
    (
      auth.uid() IS NOT NULL
      AND business_id IN (
        SELECT id FROM public.business_info WHERE is_active = true
      )
    )
  );

-- Fix saved_requests policies
-- Drop existing overlapping policies
DROP POLICY IF EXISTS "Admins can view all saved requests" ON saved_requests;
DROP POLICY IF EXISTS "Users can view their own requests with confirmation code" ON saved_requests;

-- Create single consolidated SELECT policy
CREATE POLICY "Allow admin and user access to saved requests"
  ON saved_requests
  FOR SELECT
  USING (
    (
      auth.uid() IS NOT NULL
      AND business_id IN (
        SELECT id FROM public.business_info WHERE is_active = true
      )
    )
    OR
    (
      client_email = current_setting('request.jwt.claims', true)::json->>'email'
    )
  );
