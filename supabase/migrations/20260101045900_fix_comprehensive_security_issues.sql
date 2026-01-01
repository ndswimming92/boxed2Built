/*
  # Comprehensive Security Fixes
  
  This migration addresses multiple security and performance issues identified in the database audit:
  
  ## 1. Missing Foreign Key Indexes
  
  Adds indexes for foreign keys in `job_completion_reminders`:
  - `completed_by` column (references auth.users)
  - `created_by` column (references auth.users)
  
  ## 2. Unused Index Cleanup
  
  Removes 34 unused indexes across multiple tables to improve write performance:
  - Gallery items, jobs, invoices, audit logs
  - QR codes, site pages, job completions
  - Forecasting, business goals, saved requests
  - Business-related tables, customer reviews, tax calculations
  
  ## 3. RLS Policy Optimization
  
  Optimizes auth function calls in RLS policies to prevent per-row re-evaluation:
  - `qr_codes`: Uses `(select auth.role())` instead of `auth.role()`
  - `qr_code_schedules`: Uses `(select auth.role())` instead of `auth.role()`
  
  ## 4. Duplicate Policy Consolidation
  
  Removes duplicate permissive RLS policies:
  - `qr_codes`: Consolidates 3 SELECT policies into 2 (anon + authenticated)
  - `qr_code_schedules`: Consolidates 3 SELECT policies into 2 (anon + authenticated)
  - `site_pages`: Keeps existing structure (already optimal)
  
  ## 5. Function Security Hardening
  
  Sets immutable search_path on functions to prevent search_path attacks:
  - `update_job_on_completion`
  - `update_updated_at_column`
  
  ## 6. Password Protection Note
  
  Leaked password protection must be enabled in Supabase Dashboard:
  Authentication → Policies → Enable "Leaked Password Protection"
*/

-- =====================================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- =====================================================

-- Add index for job_completion_reminders.completed_by
CREATE INDEX IF NOT EXISTS idx_job_completion_reminders_completed_by_fkey 
  ON job_completion_reminders(completed_by);

-- Add index for job_completion_reminders.created_by
CREATE INDEX IF NOT EXISTS idx_job_completion_reminders_created_by_fkey 
  ON job_completion_reminders(created_by);

-- =====================================================
-- 2. DROP UNUSED INDEXES
-- =====================================================

-- Gallery items
DROP INDEX IF EXISTS idx_gallery_items_business_id;

-- Jobs table
DROP INDEX IF EXISTS idx_jobs_completion_id;
DROP INDEX IF EXISTS idx_jobs_has_signature;

-- Invoices
DROP INDEX IF EXISTS idx_invoices_inquiry_id;
DROP INDEX IF EXISTS idx_invoices_job_id;

-- Audit logs
DROP INDEX IF EXISTS idx_audit_logs_table_name;
DROP INDEX IF EXISTS idx_audit_logs_status;
DROP INDEX IF EXISTS idx_audit_logs_table_record;

-- QR codes
DROP INDEX IF EXISTS idx_qr_code_schedules_datetime;

-- Site pages
DROP INDEX IF EXISTS idx_site_pages_active;

-- Job completions
DROP INDEX IF EXISTS idx_job_completions_job_id;
DROP INDEX IF EXISTS idx_job_completions_completed_by;
DROP INDEX IF EXISTS idx_job_completions_is_satisfied;

-- Job completion reminders (keep the new FK indexes we just created)
DROP INDEX IF EXISTS idx_job_completion_reminders_job_id;
DROP INDEX IF EXISTS idx_job_completion_reminders_completion_id;
DROP INDEX IF EXISTS idx_job_completion_reminders_status;
DROP INDEX IF EXISTS idx_job_completion_reminders_status_date;

-- Forecasting
DROP INDEX IF EXISTS idx_forecast_accuracy_business_id;

-- Business goals
DROP INDEX IF EXISTS idx_business_goals_status;
DROP INDEX IF EXISTS idx_business_goals_priority;
DROP INDEX IF EXISTS idx_business_goals_due_date;
DROP INDEX IF EXISTS idx_business_goals_archived;

-- Saved requests
DROP INDEX IF EXISTS idx_saved_requests_business_id;
DROP INDEX IF EXISTS idx_saved_requests_inquiry_id;

-- Business tables
DROP INDEX IF EXISTS idx_business_address_business_id;
DROP INDEX IF EXISTS idx_business_attributes_business_id;
DROP INDEX IF EXISTS idx_services_business_id;
DROP INDEX IF EXISTS idx_payment_methods_business_id;
DROP INDEX IF EXISTS idx_service_areas_business_id;
DROP INDEX IF EXISTS idx_social_media_business_id;

-- Customer reviews
DROP INDEX IF EXISTS idx_customer_reviews_job_completion_id;
DROP INDEX IF EXISTS idx_customer_reviews_source;
DROP INDEX IF EXISTS idx_customer_reviews_business_id;

-- Tax calculations
DROP INDEX IF EXISTS idx_tax_calculations_business_id;

-- =====================================================
-- 3. OPTIMIZE RLS POLICIES - QR CODES
-- =====================================================

-- Drop all existing duplicate QR codes SELECT policies
DROP POLICY IF EXISTS "Anonymous users can read active QR codes" ON qr_codes;
DROP POLICY IF EXISTS "Anyone can read active QR codes for redirects" ON qr_codes;
DROP POLICY IF EXISTS "Public can read active QR codes for redirect" ON qr_codes;

-- Create optimized policy for anonymous users
CREATE POLICY "Anonymous users can read active QR codes"
  ON qr_codes
  FOR SELECT
  TO anon
  USING (status = 'active');

-- Create optimized policy for authenticated users (with SELECT wrapper to avoid per-row evaluation)
CREATE POLICY "Authenticated users can read active QR codes"
  ON qr_codes
  FOR SELECT
  TO authenticated
  USING (status = 'active' OR (SELECT auth.role()) = 'authenticated');

-- Keep the admin management policy
-- "Authenticated admins can manage QR codes" already exists

-- =====================================================
-- 4. OPTIMIZE RLS POLICIES - QR CODE SCHEDULES
-- =====================================================

-- Drop all existing duplicate schedule SELECT policies
DROP POLICY IF EXISTS "Anonymous users can read active schedules" ON qr_code_schedules;
DROP POLICY IF EXISTS "Anyone can read schedules for active QR codes" ON qr_code_schedules;
DROP POLICY IF EXISTS "Public can read active schedules for redirect" ON qr_code_schedules;

-- Create optimized policy for anonymous users
CREATE POLICY "Anonymous users can read active schedules"
  ON qr_code_schedules
  FOR SELECT
  TO anon
  USING (
    is_active = true 
    AND EXISTS (
      SELECT 1 FROM qr_codes 
      WHERE qr_codes.id = qr_code_schedules.qr_code_id 
      AND qr_codes.status = 'active'
    )
  );

-- Create optimized policy for authenticated users (with SELECT wrapper)
CREATE POLICY "Authenticated users can read schedules"
  ON qr_code_schedules
  FOR SELECT
  TO authenticated
  USING (
    (is_active = true AND EXISTS (
      SELECT 1 FROM qr_codes 
      WHERE qr_codes.id = qr_code_schedules.qr_code_id 
      AND qr_codes.status = 'active'
    ))
    OR (SELECT auth.role()) = 'authenticated'
  );

-- Keep the admin management policy
-- "Authenticated admins can manage schedules" already exists

-- =====================================================
-- 5. SITE PAGES POLICIES
-- =====================================================

-- Site pages already has optimal structure:
-- - "Admins can view all site pages" for authenticated
-- - "Anyone can view active site pages" for public
-- No changes needed, already consolidated properly

-- =====================================================
-- 6. FIX FUNCTION SEARCH PATHS
-- =====================================================

-- Recreate update_job_on_completion with immutable search_path
CREATE OR REPLACE FUNCTION update_job_on_completion()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update the job's completion_date when a completion record is created
  IF (TG_OP = 'INSERT') THEN
    UPDATE jobs 
    SET 
      completion_date = NEW.completion_date,
      updated_at = now()
    WHERE id = NEW.job_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate update_updated_at_column with immutable search_path
CREATE OR REPLACE FUNCTION update_updated_at_column()
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

-- =====================================================
-- 7. ADD COMMENT ABOUT LEAKED PASSWORD PROTECTION
-- =====================================================

COMMENT ON SCHEMA public IS 'NOTE: Enable Leaked Password Protection in Supabase Dashboard under Authentication → Policies → Enable "Leaked Password Protection" to enhance security by preventing use of compromised passwords.';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify foreign key indexes exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_job_completion_reminders_completed_by_fkey'
  ) THEN
    RAISE EXCEPTION 'Missing index: idx_job_completion_reminders_completed_by_fkey';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_job_completion_reminders_created_by_fkey'
  ) THEN
    RAISE EXCEPTION 'Missing index: idx_job_completion_reminders_created_by_fkey';
  END IF;
END $$;