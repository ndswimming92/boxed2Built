/*
  # Fix Security Issues: Foreign Key Indexes and Function Search Paths

  1. Performance Improvements
    - Add indexes for all unindexed foreign keys across multiple tables
    - Improves query performance for joins and foreign key lookups

  2. Security Improvements
    - Fix function search path vulnerabilities by setting explicit search paths
    - Remove security definer view that exposes auth.users data
    - Add secure helper functions with proper search path configuration

  3. Tables with new indexes:
    - business_address (business_id)
    - business_attributes (business_id)
    - customer_reviews (business_id)
    - forecast_accuracy (business_id)
    - gallery_items (business_id)
    - invoices (inquiry_id, job_id)
    - payment_methods (business_id)
    - quarterly_tax_payments (business_id)
    - saved_requests (business_id, inquiry_id)
    - service_areas (business_id)
    - services (business_id)
    - social_media (business_id)
    - tax_calculations (business_id)

  4. Function Security Fixes
    - Set search_path for all functions to prevent security vulnerabilities
    - Functions: calculate_goal_progress, update_overdue_goals, 
      update_business_goals_updated_at, log_auth_event, calculate_line_item_total
*/

-- Add foreign key indexes for performance
CREATE INDEX IF NOT EXISTS idx_business_address_business_id ON business_address(business_id);
CREATE INDEX IF NOT EXISTS idx_business_attributes_business_id ON business_attributes(business_id);
CREATE INDEX IF NOT EXISTS idx_customer_reviews_business_id ON customer_reviews(business_id);
CREATE INDEX IF NOT EXISTS idx_forecast_accuracy_business_id ON forecast_accuracy(business_id);
CREATE INDEX IF NOT EXISTS idx_gallery_items_business_id ON gallery_items(business_id);
CREATE INDEX IF NOT EXISTS idx_invoices_inquiry_id ON invoices(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_invoices_job_id ON invoices(job_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_business_id ON payment_methods(business_id);
CREATE INDEX IF NOT EXISTS idx_quarterly_tax_payments_business_id ON quarterly_tax_payments(business_id);
CREATE INDEX IF NOT EXISTS idx_saved_requests_business_id ON saved_requests(business_id);
CREATE INDEX IF NOT EXISTS idx_saved_requests_inquiry_id ON saved_requests(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_service_areas_business_id ON service_areas(business_id);
CREATE INDEX IF NOT EXISTS idx_services_business_id ON services(business_id);
CREATE INDEX IF NOT EXISTS idx_social_media_business_id ON social_media(business_id);
CREATE INDEX IF NOT EXISTS idx_tax_calculations_business_id ON tax_calculations(business_id);

-- Drop the insecure recent_audit_logs view
DROP VIEW IF EXISTS recent_audit_logs;

-- Recreate log_auth_event function with secure search path
CREATE OR REPLACE FUNCTION log_auth_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- This is a placeholder for future enhancement
  -- Can be extended to automatically log certain database changes
  RETURN NEW;
END;
$$;

-- Fix calculate_goal_progress function with secure search path
CREATE OR REPLACE FUNCTION calculate_goal_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.target_value > 0 THEN
    NEW.progress := ROUND((NEW.current_value::numeric / NEW.target_value::numeric) * 100, 2);
  ELSE
    NEW.progress := 0;
  END IF;
  RETURN NEW;
END;
$$;

-- Fix update_overdue_goals function with secure search path
CREATE OR REPLACE FUNCTION update_overdue_goals()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE business_goals
  SET status = 'overdue'
  WHERE status IN ('not_started', 'in_progress')
    AND due_date < CURRENT_DATE
    AND is_active = true
    AND is_archived = false;
END;
$$;

-- Fix update_business_goals_updated_at function with secure search path
CREATE OR REPLACE FUNCTION update_business_goals_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Fix calculate_line_item_total function with secure search path
CREATE OR REPLACE FUNCTION calculate_line_item_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.line_total := NEW.quantity * NEW.unit_price;
  RETURN NEW;
END;
$$;

-- Add a secure function to get recent audit logs without exposing auth.users
CREATE OR REPLACE FUNCTION get_recent_audit_logs(days_back integer DEFAULT 30)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  user_email text,
  action_type text,
  table_name text,
  record_id uuid,
  record_identifier text,
  old_values jsonb,
  new_values jsonb,
  changes_summary text,
  ip_address text,
  user_agent text,
  status text,
  error_message text,
  metadata jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.id,
    al.user_id,
    al.user_email,
    al.action_type,
    al.table_name,
    al.record_id,
    al.record_identifier,
    al.old_values,
    al.new_values,
    al.changes_summary,
    al.ip_address,
    al.user_agent,
    al.status,
    al.error_message,
    al.metadata,
    al.created_at
  FROM admin_audit_logs al
  WHERE al.created_at >= NOW() - (days_back || ' days')::interval
  ORDER BY al.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users only
GRANT EXECUTE ON FUNCTION get_recent_audit_logs(integer) TO authenticated;
