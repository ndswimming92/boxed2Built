/*
  # Fix Comprehensive Security Issues - Mileage System

  ## Security Fixes

  ### 1. Add Missing Foreign Key Indexes
  - Add indexes for business_expenses foreign keys (business_id, category_id)
  - Add index for expense_categories foreign key (business_id)
  - Add indexes for job_completion_reminders foreign keys (completed_by, created_by)
  - Add index for mileage_records foreign key (expense_id)

  ### 2. Consolidate Duplicate Policies
  - Remove duplicate SELECT policy on mileage_settings
  - Remove duplicate policies on site_pages (DELETE, INSERT, UPDATE)

  ### 3. Fix Function Security
  - Add SECURITY DEFINER and set search_path for mileage-related functions
  - Prevents search_path injection attacks

  ## Notes
  - Unused indexes are intentional for new features and will be used in production
  - Leaked Password Protection must be enabled manually in Supabase Dashboard
*/

-- Add missing foreign key indexes for business_expenses
CREATE INDEX IF NOT EXISTS idx_business_expenses_business_id ON business_expenses(business_id);
CREATE INDEX IF NOT EXISTS idx_business_expenses_category_id ON business_expenses(category_id);

-- Add missing foreign key index for expense_categories
CREATE INDEX IF NOT EXISTS idx_expense_categories_business_id ON expense_categories(business_id);

-- Add missing foreign key indexes for job_completion_reminders
CREATE INDEX IF NOT EXISTS idx_job_completion_reminders_completed_by ON job_completion_reminders(completed_by);
CREATE INDEX IF NOT EXISTS idx_job_completion_reminders_created_by ON job_completion_reminders(created_by);

-- Add missing foreign key index for mileage_records
CREATE INDEX IF NOT EXISTS idx_mileage_records_expense_id ON mileage_records(expense_id);

-- Remove duplicate SELECT policy on mileage_settings
DROP POLICY IF EXISTS "Authenticated users can view mileage settings" ON mileage_settings;

-- Remove duplicate policies on site_pages
DROP POLICY IF EXISTS "Authenticated users can delete site pages" ON site_pages;
DROP POLICY IF EXISTS "Authenticated users can insert site pages" ON site_pages;
DROP POLICY IF EXISTS "Authenticated users can update site pages" ON site_pages;

-- Fix function security: update_job_mileage_totals
CREATE OR REPLACE FUNCTION update_job_mileage_totals()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE jobs
  SET 
    total_mileage = COALESCE((
      SELECT SUM(distance_miles)
      FROM mileage_records
      WHERE job_id = COALESCE(NEW.job_id, OLD.job_id)
        AND is_active = true
    ), 0),
    mileage_deduction = COALESCE((
      SELECT SUM(deduction_amount)
      FROM mileage_records
      WHERE job_id = COALESCE(NEW.job_id, OLD.job_id)
        AND is_active = true
    ), 0),
    updated_at = now()
  WHERE id = COALESCE(NEW.job_id, OLD.job_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Fix function security: update_mileage_records_updated_at
CREATE OR REPLACE FUNCTION update_mileage_records_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix function security: get_current_mileage_rate
CREATE OR REPLACE FUNCTION get_current_mileage_rate(p_business_id uuid, p_date date DEFAULT CURRENT_DATE)
RETURNS numeric
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_rate numeric;
BEGIN
  SELECT rate_per_mile INTO v_rate
  FROM mileage_settings
  WHERE business_id = p_business_id
    AND effective_date <= p_date
    AND is_active = true
  ORDER BY effective_date DESC
  LIMIT 1;
  
  RETURN COALESCE(v_rate, 0.67);
END;
$$;