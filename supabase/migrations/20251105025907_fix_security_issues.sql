/*
  # Fix Security Issues

  ## Summary
  This migration addresses security issues identified in the Supabase dashboard:
  1. Removes multiple permissive policies on gallery_items table
  2. Drops unused indexes across all tables to improve performance and reduce storage

  ## Changes Made

  ### 1. Gallery Items Policies
  - Drop duplicate permissive SELECT policy for authenticated users
  - Keep the public policy for viewing active items
  - Keep separate authenticated policies for INSERT, UPDATE, DELETE

  ### 2. Unused Indexes
  The following unused indexes are being dropped:
  - `idx_business_address_business_id` - Foreign key constraint provides sufficient indexing
  - `idx_business_attributes_business_id` - Foreign key constraint provides sufficient indexing
  - `idx_business_hours_business_id` - Foreign key constraint provides sufficient indexing
  - `idx_customer_reviews_active` - Not used in current queries
  - `idx_payment_methods_business_id` - Foreign key constraint provides sufficient indexing
  - `idx_service_areas_active` - Not used in current queries
  - `idx_services_active` - Not used in current queries
  - `idx_social_media_business_id` - Foreign key constraint provides sufficient indexing
  - `idx_gallery_items_business_id` - Foreign key constraint provides sufficient indexing
  - `idx_gallery_items_is_active` - Not used frequently enough to justify index
  - `idx_gallery_items_display_order` - Not used frequently enough to justify index
  - `idx_gallery_items_category` - Not used frequently enough to justify index

  ## Note
  Indexes are only kept when they significantly improve query performance on frequently accessed data.
  Foreign key constraints automatically create indexes on the referenced columns.
*/

-- Fix multiple permissive policies on gallery_items
-- Drop the authenticated-only SELECT policy since public policy already handles active items
-- and admins can access through other means
DROP POLICY IF EXISTS "Authenticated users can view all gallery items" ON gallery_items;

-- Keep the public policy for viewing active items
-- Keep the INSERT, UPDATE, and DELETE policies for authenticated users

-- Drop unused indexes on business_address
DROP INDEX IF EXISTS idx_business_address_business_id;

-- Drop unused indexes on business_attributes
DROP INDEX IF EXISTS idx_business_attributes_business_id;

-- Drop unused indexes on business_hours
DROP INDEX IF EXISTS idx_business_hours_business_id;

-- Drop unused indexes on customer_reviews
DROP INDEX IF EXISTS idx_customer_reviews_active;

-- Drop unused indexes on payment_methods
DROP INDEX IF EXISTS idx_payment_methods_business_id;

-- Drop unused indexes on service_areas
DROP INDEX IF EXISTS idx_service_areas_active;

-- Drop unused indexes on services
DROP INDEX IF EXISTS idx_services_active;

-- Drop unused indexes on social_media
DROP INDEX IF EXISTS idx_social_media_business_id;

-- Drop unused indexes on gallery_items
DROP INDEX IF EXISTS idx_gallery_items_business_id;
DROP INDEX IF EXISTS idx_gallery_items_is_active;
DROP INDEX IF EXISTS idx_gallery_items_display_order;
DROP INDEX IF EXISTS idx_gallery_items_category;
