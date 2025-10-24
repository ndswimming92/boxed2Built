/*
  # Fix Security Issues in Database Schema

  ## Overview
  This migration addresses security vulnerabilities and optimization issues:
  1. Removes unused indexes to improve performance
  2. Consolidates multiple permissive RLS policies
  3. Fixes function search path mutability issue

  ## Changes Made

  ### 1. Remove Unused Indexes
  - Drop `idx_service_areas_business_id` (redundant with foreign key)
  - Drop `idx_services_business_id` (redundant with foreign key)
  - Drop `idx_services_featured` (unused)
  - Drop `idx_customer_reviews_business_id` (redundant with foreign key)
  - Drop `idx_customer_reviews_featured` (unused)

  ### 2. Consolidate RLS Policies
  For each table with multiple permissive policies, we will:
  - Drop the broad "Authenticated users can manage" policy for SELECT
  - Keep only the specific public read policy
  - Maintain separate policies for INSERT, UPDATE, DELETE for authenticated users

  ### 3. Fix Function Search Path
  - Drop existing triggers first
  - Recreate `update_updated_at_column` function with immutable search_path
  - Recreate triggers

  ## Security Impact
  - Reduces policy evaluation overhead
  - Eliminates potential policy conflicts
  - Secures function against search_path injection attacks
  - Maintains all existing access controls
*/

-- ============================================
-- 1. DROP UNUSED INDEXES
-- ============================================

DROP INDEX IF EXISTS idx_service_areas_business_id;
DROP INDEX IF EXISTS idx_services_business_id;
DROP INDEX IF EXISTS idx_services_featured;
DROP INDEX IF EXISTS idx_customer_reviews_business_id;
DROP INDEX IF EXISTS idx_customer_reviews_featured;

-- ============================================
-- 2. CONSOLIDATE RLS POLICIES
-- ============================================

-- Fix business_address policies
DROP POLICY IF EXISTS "Authenticated users can manage business addresses" ON business_address;
CREATE POLICY "Authenticated users can insert business addresses"
  ON business_address FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update business addresses"
  ON business_address FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete business addresses"
  ON business_address FOR DELETE
  TO authenticated
  USING (true);

-- Fix business_attributes policies
DROP POLICY IF EXISTS "Authenticated users can manage business attributes" ON business_attributes;
CREATE POLICY "Authenticated users can insert business attributes"
  ON business_attributes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update business attributes"
  ON business_attributes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete business attributes"
  ON business_attributes FOR DELETE
  TO authenticated
  USING (true);

-- Fix business_hours policies
DROP POLICY IF EXISTS "Authenticated users can manage business hours" ON business_hours;
CREATE POLICY "Authenticated users can insert business hours"
  ON business_hours FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update business hours"
  ON business_hours FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete business hours"
  ON business_hours FOR DELETE
  TO authenticated
  USING (true);

-- Fix customer_reviews policies
DROP POLICY IF EXISTS "Authenticated users can manage reviews" ON customer_reviews;
CREATE POLICY "Authenticated users can insert reviews"
  ON customer_reviews FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update reviews"
  ON customer_reviews FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete reviews"
  ON customer_reviews FOR DELETE
  TO authenticated
  USING (true);

-- Fix payment_methods policies
DROP POLICY IF EXISTS "Authenticated users can manage payment methods" ON payment_methods;
CREATE POLICY "Authenticated users can insert payment methods"
  ON payment_methods FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update payment methods"
  ON payment_methods FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete payment methods"
  ON payment_methods FOR DELETE
  TO authenticated
  USING (true);

-- Fix service_areas policies
DROP POLICY IF EXISTS "Authenticated users can manage service areas" ON service_areas;
CREATE POLICY "Authenticated users can insert service areas"
  ON service_areas FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update service areas"
  ON service_areas FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete service areas"
  ON service_areas FOR DELETE
  TO authenticated
  USING (true);

-- Fix services policies
DROP POLICY IF EXISTS "Authenticated users can manage services" ON services;
CREATE POLICY "Authenticated users can insert services"
  ON services FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update services"
  ON services FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete services"
  ON services FOR DELETE
  TO authenticated
  USING (true);

-- Fix social_media policies
DROP POLICY IF EXISTS "Authenticated users can manage social media" ON social_media;
CREATE POLICY "Authenticated users can insert social media"
  ON social_media FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update social media"
  ON social_media FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete social media"
  ON social_media FOR DELETE
  TO authenticated
  USING (true);

-- ============================================
-- 3. FIX FUNCTION SEARCH PATH
-- ============================================

-- Drop all triggers first
DROP TRIGGER IF EXISTS update_business_info_updated_at ON business_info;
DROP TRIGGER IF EXISTS update_business_address_updated_at ON business_address;
DROP TRIGGER IF EXISTS update_service_areas_updated_at ON service_areas;
DROP TRIGGER IF EXISTS update_services_updated_at ON services;
DROP TRIGGER IF EXISTS update_business_hours_updated_at ON business_hours;
DROP TRIGGER IF EXISTS update_customer_reviews_updated_at ON customer_reviews;

-- Now drop and recreate function with secure search_path
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- Recreate all triggers
CREATE TRIGGER update_business_info_updated_at
  BEFORE UPDATE ON business_info
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_address_updated_at
  BEFORE UPDATE ON business_address
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_areas_updated_at
  BEFORE UPDATE ON service_areas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_hours_updated_at
  BEFORE UPDATE ON business_hours
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customer_reviews_updated_at
  BEFORE UPDATE ON customer_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
