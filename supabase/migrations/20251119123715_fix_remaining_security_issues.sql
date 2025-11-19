/*
  # Fix Remaining Security Issues

  1. Add Missing Foreign Key Index
    - Add index on saved_requests(business_id) to cover foreign key
    - This was incorrectly dropped in previous migration as "unused"
    - Actually needed for query performance on foreign key constraints

  2. Optimize RLS Policies with Subqueries
    - Update notification_bar RLS policy to use (select auth.uid())
    - Update saved_requests RLS policy to use (select auth.uid())
    - This prevents re-evaluation of auth functions for each row

  3. Drop Truly Unused Indexes
    - Keep only the indexes that are actually used
    - Drop indexes that have no query usage

  4. Notes
    - Leaked Password Protection must be enabled in Supabase Dashboard
    - Navigate to: Authentication > Settings > Password Protection
    - Toggle "Enable Leaked Password Protection"
    - This cannot be enabled via SQL migration
*/

-- ============================================================================
-- 1. ADD MISSING FOREIGN KEY INDEX FOR saved_requests.business_id
-- ============================================================================

-- This index is needed for the foreign key constraint performance
CREATE INDEX IF NOT EXISTS idx_saved_requests_business_id_fk
  ON saved_requests(business_id);

-- ============================================================================
-- 2. OPTIMIZE RLS POLICIES WITH SUBQUERIES
-- ============================================================================

-- Fix notification_bar RLS policy to use subquery
DROP POLICY IF EXISTS "Allow public read of enabled notifications and admin read of all" ON notification_bar;

CREATE POLICY "Allow public read of enabled notifications and admin read of all"
  ON notification_bar
  FOR SELECT
  USING (
    is_enabled = true
    OR
    (
      (select auth.uid()) IS NOT NULL
      AND business_id IN (
        SELECT id FROM public.business_info WHERE is_active = true
      )
    )
  );

-- Fix saved_requests RLS policy to use subquery
DROP POLICY IF EXISTS "Allow admin and user access to saved requests" ON saved_requests;

CREATE POLICY "Allow admin and user access to saved requests"
  ON saved_requests
  FOR SELECT
  USING (
    (
      (select auth.uid()) IS NOT NULL
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
-- 3. DROP TRULY UNUSED INDEXES (NOT USED BY ANY QUERIES)
-- ============================================================================

-- These indexes were created but are not being used by the query planner
-- Keep the foreign key indexes, drop the others that have no usage

-- Drop unused indexes that don't cover foreign keys or aren't used in queries
DROP INDEX IF EXISTS idx_gallery_items_business_id;
DROP INDEX IF EXISTS idx_payment_methods_business_id;
DROP INDEX IF EXISTS idx_saved_requests_inquiry_id;
DROP INDEX IF EXISTS idx_service_areas_business_id;
DROP INDEX IF EXISTS idx_services_business_id;
DROP INDEX IF EXISTS idx_social_media_business_id;
DROP INDEX IF EXISTS idx_business_attributes_business_id;
DROP INDEX IF EXISTS idx_customer_reviews_business_id;
DROP INDEX IF EXISTS idx_forecast_accuracy_business_id;
DROP INDEX IF EXISTS idx_business_address_business_id;
