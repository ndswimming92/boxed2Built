/*
  # Add Foreign Key Indexes - Final Fix

  1. Add All Missing Foreign Key Indexes
    - Foreign keys need covering indexes for optimal query performance
    - These are NOT query-usage indexes, they're structural indexes for FK constraints
    - Required for efficient JOIN operations and constraint checking

  2. Fix saved_requests RLS Policy
    - Properly wrap auth.uid() in a subquery to cache the result
    - This prevents re-evaluation for each row

  3. Remove Duplicate Index
    - Drop idx_saved_requests_business_id_fk (added in previous migration)
    - We'll use idx_saved_requests_business_id instead (standard naming)

  4. Verify Function Search Path
    - Ensure track_saved_request_access has proper search_path set
*/

-- ============================================================================
-- 1. ADD ALL FOREIGN KEY INDEXES
-- ============================================================================

-- These indexes cover foreign key constraints and are essential for:
-- - JOIN performance
-- - CASCADE operations
-- - Referential integrity checks

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

CREATE INDEX IF NOT EXISTS idx_service_areas_business_id
  ON service_areas(business_id);

CREATE INDEX IF NOT EXISTS idx_services_business_id
  ON services(business_id);

CREATE INDEX IF NOT EXISTS idx_social_media_business_id
  ON social_media(business_id);

CREATE INDEX IF NOT EXISTS idx_saved_requests_inquiry_id
  ON saved_requests(inquiry_id);

CREATE INDEX IF NOT EXISTS idx_saved_requests_business_id
  ON saved_requests(business_id);

-- ============================================================================
-- 2. REMOVE DUPLICATE INDEX
-- ============================================================================

-- Drop the duplicate index created in previous migration
DROP INDEX IF EXISTS idx_saved_requests_business_id_fk;

-- ============================================================================
-- 3. FIX SAVED_REQUESTS RLS POLICY WITH PROPER SUBQUERY
-- ============================================================================

-- Drop existing policy
DROP POLICY IF EXISTS "Allow admin and user access to saved requests" ON saved_requests;

-- Create policy with properly cached auth.uid() call
CREATE POLICY "Allow admin and user access to saved requests"
  ON saved_requests
  FOR SELECT
  USING (
    (
      (SELECT auth.uid()) IS NOT NULL
      AND business_id IN (
        SELECT id FROM public.business_info WHERE is_active = true
      )
    )
    OR
    (
      client_email = current_setting('request.jwt.claims', true)::json->>'email'
    )
  );

-- ============================================================================
-- 4. VERIFY AND FIX FUNCTION SEARCH PATH
-- ============================================================================

-- Recreate track_saved_request_access with proper search_path
DROP FUNCTION IF EXISTS public.track_saved_request_access(uuid) CASCADE;

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
