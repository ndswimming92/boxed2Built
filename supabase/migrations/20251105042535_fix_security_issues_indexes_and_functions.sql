/*
  # Fix Security Issues - Indexes and Functions

  ## Changes Made

  1. **Foreign Key Indexes**
     - Add covering indexes for all foreign key columns to improve query performance
     - Tables affected:
       - business_address.business_id
       - business_attributes.business_id
       - customer_reviews.business_id
       - gallery_items.business_id
       - payment_methods.business_id
       - service_areas.business_id
       - services.business_id
       - social_media.business_id

  2. **Unused Index Cleanup**
     - Drop unused indexes on jobs table:
       - idx_jobs_date_completed
       - idx_jobs_location_city
     - These indexes were created but are not being used by queries

  3. **Function Security Fix**
     - Fix update_jobs_updated_at function to prevent search_path manipulation attacks
     - Add explicit schema qualification and security definer with restricted search_path

  ## Performance Impact
  - Adding indexes will improve JOIN performance for all business-related queries
  - Removing unused indexes will reduce write overhead on jobs table

  ## Security Impact
  - Function search_path fix prevents potential SQL injection via search_path manipulation
  - All changes maintain existing RLS policies
*/

-- Add indexes for foreign keys to improve query performance
CREATE INDEX IF NOT EXISTS idx_business_address_business_id 
  ON business_address(business_id);

CREATE INDEX IF NOT EXISTS idx_business_attributes_business_id 
  ON business_attributes(business_id);

CREATE INDEX IF NOT EXISTS idx_customer_reviews_business_id 
  ON customer_reviews(business_id);

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

-- Drop unused indexes on jobs table
DROP INDEX IF EXISTS idx_jobs_date_completed;
DROP INDEX IF EXISTS idx_jobs_location_city;

-- Fix function search_path security issue
-- Drop the existing function first
DROP FUNCTION IF EXISTS update_jobs_updated_at() CASCADE;

-- Recreate with proper security settings
CREATE OR REPLACE FUNCTION public.update_jobs_updated_at()
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

-- Recreate the trigger
DROP TRIGGER IF EXISTS update_jobs_updated_at_trigger ON public.jobs;

CREATE TRIGGER update_jobs_updated_at_trigger
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_jobs_updated_at();

-- Add comment to document the security fix
COMMENT ON FUNCTION public.update_jobs_updated_at() IS 
  'Updates the updated_at timestamp. Uses SECURITY DEFINER with restricted search_path to prevent SQL injection.';
