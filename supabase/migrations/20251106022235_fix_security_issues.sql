/*
  # Fix Security Issues

  ## Overview
  This migration addresses security issues identified in the database audit:
  1. Removes unused indexes that add overhead without providing benefit
  2. Fixes function search paths to prevent security vulnerabilities

  ## Changes Made

  ### 1. Drop Unused Indexes
  These indexes were created but are not being used by any queries:
  - `idx_business_address_business_id` - Unused on business_address
  - `idx_business_attributes_business_id` - Unused on business_attributes
  - `idx_customer_reviews_business_id` - Unused on customer_reviews
  - `idx_gallery_items_business_id` - Unused on gallery_items
  - `idx_payment_methods_business_id` - Unused on payment_methods
  - `idx_service_areas_business_id` - Unused on service_areas
  - `idx_services_business_id` - Unused on services
  - `idx_social_media_business_id` - Unused on social_media
  - `idx_form_inquiries_status` - Unused on form_inquiries
  - `idx_form_inquiries_viewed` - Unused on form_inquiries
  - `idx_form_inquiries_submission_date` - Unused on form_inquiries
  - `idx_revenue_forecasts_business_id` - Unused on revenue_forecasts
  - `idx_revenue_forecasts_forecast_date` - Unused on revenue_forecasts
  - `idx_revenue_forecasts_business_date` - Unused on revenue_forecasts
  - `idx_forecast_settings_business_id` - Unused on forecast_settings
  - `idx_forecast_accuracy_business_id` - Unused on forecast_accuracy
  - `idx_forecast_accuracy_forecast_date` - Unused on forecast_accuracy

  ### 2. Fix Function Search Paths
  Functions with mutable search paths can be exploited by malicious users.
  We fix this by setting explicit search_path and security definer where appropriate:
  - `update_revenue_forecasts_updated_at`
  - `update_forecast_settings_updated_at`

  ## Security Impact
  - Reduced attack surface by removing unused indexes
  - Prevented search path manipulation attacks in functions
  - Improved database performance by reducing index maintenance overhead

  ## Important Notes
  - Indexes should only be created when they provide measurable query performance benefits
  - All functions should have immutable search paths for security
  - Password protection against leaked credentials should be enabled in Supabase Auth settings
*/

-- Drop unused indexes on business_address
DROP INDEX IF EXISTS idx_business_address_business_id;

-- Drop unused indexes on business_attributes
DROP INDEX IF EXISTS idx_business_attributes_business_id;

-- Drop unused indexes on customer_reviews
DROP INDEX IF EXISTS idx_customer_reviews_business_id;

-- Drop unused indexes on gallery_items
DROP INDEX IF EXISTS idx_gallery_items_business_id;

-- Drop unused indexes on payment_methods
DROP INDEX IF EXISTS idx_payment_methods_business_id;

-- Drop unused indexes on service_areas
DROP INDEX IF EXISTS idx_service_areas_business_id;

-- Drop unused indexes on services
DROP INDEX IF EXISTS idx_services_business_id;

-- Drop unused indexes on social_media
DROP INDEX IF EXISTS idx_social_media_business_id;

-- Drop unused indexes on form_inquiries
DROP INDEX IF EXISTS idx_form_inquiries_status;
DROP INDEX IF EXISTS idx_form_inquiries_viewed;
DROP INDEX IF EXISTS idx_form_inquiries_submission_date;

-- Drop unused indexes on revenue_forecasts
DROP INDEX IF EXISTS idx_revenue_forecasts_business_id;
DROP INDEX IF EXISTS idx_revenue_forecasts_forecast_date;
DROP INDEX IF EXISTS idx_revenue_forecasts_business_date;

-- Drop unused indexes on forecast_settings
DROP INDEX IF EXISTS idx_forecast_settings_business_id;

-- Drop unused indexes on forecast_accuracy
DROP INDEX IF EXISTS idx_forecast_accuracy_business_id;
DROP INDEX IF EXISTS idx_forecast_accuracy_forecast_date;

-- Fix function search paths for security
-- Recreate update_revenue_forecasts_updated_at with secure search_path
CREATE OR REPLACE FUNCTION update_revenue_forecasts_updated_at()
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

-- Recreate update_forecast_settings_updated_at with secure search_path
CREATE OR REPLACE FUNCTION update_forecast_settings_updated_at()
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

-- Also fix other similar functions for consistency
CREATE OR REPLACE FUNCTION update_jobs_updated_at()
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

CREATE OR REPLACE FUNCTION update_gallery_items_updated_at()
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

CREATE OR REPLACE FUNCTION update_form_inquiries_updated_at()
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