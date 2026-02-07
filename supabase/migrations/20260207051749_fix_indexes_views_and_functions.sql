/*
  # Fix Indexes, Views, and Functions

  1. New Indexes
    - Add index on `client_notes.created_by` to cover foreign key `client_notes_created_by_fkey`

  2. Dropped Unused Indexes (62 total)
    - Organization ID indexes across all tables (not used because RLS helper functions handle access)
    - Business ID indexes on various tables
    - Job-related FK indexes
    - Client indexes (phone, status, last_contact, notes org)

  3. Fixed Views (3 views)
    - `high_value_clients` - changed from SECURITY DEFINER to SECURITY INVOKER
    - `dormant_clients` - changed from SECURITY DEFINER to SECURITY INVOKER
    - `repeat_customers` - changed from SECURITY DEFINER to SECURITY INVOKER

  4. Fixed Functions (3 functions)
    - `is_platform_admin()` - added SET search_path = ''
    - `update_client_timestamp()` - added SET search_path = ''
    - `update_client_note_timestamp()` - added SET search_path = ''

  5. Fixed RLS Policy
    - `Service role can insert audit logs` on admin_audit_logs - wrapped auth.jwt() in (select ...) for performance

  6. Important Notes
    - All unused indexes were confirmed unused by Supabase advisor
    - SECURITY INVOKER views inherit the caller's permissions, respecting RLS on the clients table
    - Setting search_path prevents search_path hijacking in functions
*/

-- 1. Add missing FK index on client_notes.created_by
CREATE INDEX IF NOT EXISTS idx_client_notes_created_by ON public.client_notes (created_by);

-- 2. Drop unused organization_id indexes
DROP INDEX IF EXISTS public.idx_organization_members_organization_id;
DROP INDEX IF EXISTS public.idx_organizations_active;
DROP INDEX IF EXISTS public.idx_social_media_organization_id;
DROP INDEX IF EXISTS public.idx_customer_reviews_organization_id;
DROP INDEX IF EXISTS public.idx_business_info_organization_id;
DROP INDEX IF EXISTS public.idx_business_address_organization_id;
DROP INDEX IF EXISTS public.idx_business_hours_organization_id;
DROP INDEX IF EXISTS public.idx_business_attributes_organization_id;
DROP INDEX IF EXISTS public.idx_services_organization_id;
DROP INDEX IF EXISTS public.idx_service_areas_organization_id;
DROP INDEX IF EXISTS public.idx_payment_methods_organization_id;
DROP INDEX IF EXISTS public.idx_gallery_items_organization_id;
DROP INDEX IF EXISTS public.idx_form_inquiries_organization_id;
DROP INDEX IF EXISTS public.idx_saved_requests_organization_id;
DROP INDEX IF EXISTS public.idx_jobs_organization_id;
DROP INDEX IF EXISTS public.idx_job_completions_organization_id;
DROP INDEX IF EXISTS public.idx_job_completion_reminders_organization_id;
DROP INDEX IF EXISTS public.idx_invoices_organization_id;
DROP INDEX IF EXISTS public.idx_invoice_line_items_organization_id;
DROP INDEX IF EXISTS public.idx_invoice_payments_organization_id;
DROP INDEX IF EXISTS public.idx_invoice_settings_organization_id;
DROP INDEX IF EXISTS public.idx_tax_settings_organization_id;
DROP INDEX IF EXISTS public.idx_tax_calculations_organization_id;
DROP INDEX IF EXISTS public.idx_quarterly_tax_payments_organization_id;
DROP INDEX IF EXISTS public.idx_business_expenses_organization_id;
DROP INDEX IF EXISTS public.idx_expense_categories_organization_id;
DROP INDEX IF EXISTS public.idx_mileage_records_organization_id;
DROP INDEX IF EXISTS public.idx_mileage_settings_organization_id;
DROP INDEX IF EXISTS public.idx_qr_codes_organization_id;
DROP INDEX IF EXISTS public.idx_qr_code_schedules_organization_id;
DROP INDEX IF EXISTS public.idx_qr_scans_organization_id;
DROP INDEX IF EXISTS public.idx_notification_bar_organization_id;
DROP INDEX IF EXISTS public.idx_site_pages_organization_id;
DROP INDEX IF EXISTS public.idx_business_goals_organization_id;
DROP INDEX IF EXISTS public.idx_forecast_accuracy_organization_id;
DROP INDEX IF EXISTS public.idx_forecast_settings_organization_id;

-- Drop unused business_id and other FK indexes
DROP INDEX IF EXISTS public.idx_business_address_business_id;
DROP INDEX IF EXISTS public.idx_business_attributes_business_id;
DROP INDEX IF EXISTS public.idx_business_expenses_category_id;
DROP INDEX IF EXISTS public.idx_customer_reviews_job_completion_id;
DROP INDEX IF EXISTS public.idx_expense_categories_business_id;
DROP INDEX IF EXISTS public.idx_forecast_accuracy_business_id;
DROP INDEX IF EXISTS public.idx_gallery_items_business_id;
DROP INDEX IF EXISTS public.idx_job_completion_reminders_completed_by;
DROP INDEX IF EXISTS public.idx_job_completion_reminders_created_by;
DROP INDEX IF EXISTS public.idx_job_completion_reminders_job_completion_id;
DROP INDEX IF EXISTS public.idx_job_completion_reminders_job_id;
DROP INDEX IF EXISTS public.idx_job_completions_completed_by;
DROP INDEX IF EXISTS public.idx_job_completions_job_id;
DROP INDEX IF EXISTS public.idx_jobs_completion_id;
DROP INDEX IF EXISTS public.idx_mileage_records_business_id;
DROP INDEX IF EXISTS public.idx_mileage_records_expense_id;
DROP INDEX IF EXISTS public.idx_payment_methods_business_id;
DROP INDEX IF EXISTS public.idx_saved_requests_business_id;
DROP INDEX IF EXISTS public.idx_service_areas_business_id;
DROP INDEX IF EXISTS public.idx_services_business_id;
DROP INDEX IF EXISTS public.idx_social_media_business_id;
DROP INDEX IF EXISTS public.idx_tax_calculations_business_id;

-- Drop unused client indexes
DROP INDEX IF EXISTS public.clients_phone_idx;
DROP INDEX IF EXISTS public.clients_status_idx;
DROP INDEX IF EXISTS public.clients_last_contact_idx;
DROP INDEX IF EXISTS public.client_notes_org_idx;

-- 3. Recreate views with SECURITY INVOKER (drop and recreate)
DROP VIEW IF EXISTS public.high_value_clients;
CREATE VIEW public.high_value_clients
WITH (security_invoker = true)
AS
SELECT id, organization_id, name, email, phone, address,
  client_status, client_value_tier, marketing_email_opt_in,
  marketing_sms_opt_in, opt_in_date, opt_out_date,
  last_campaign_date, first_contact_date, last_contact_date,
  last_job_date, total_revenue, job_count, average_job_value,
  source, tags, preferences_token, created_at, updated_at
FROM public.clients
WHERE client_value_tier IN ('high_value', 'vip');

DROP VIEW IF EXISTS public.dormant_clients;
CREATE VIEW public.dormant_clients
WITH (security_invoker = true)
AS
SELECT id, organization_id, name, email, phone, address,
  client_status, client_value_tier, marketing_email_opt_in,
  marketing_sms_opt_in, opt_in_date, opt_out_date,
  last_campaign_date, first_contact_date, last_contact_date,
  last_job_date, total_revenue, job_count, average_job_value,
  source, tags, preferences_token, created_at, updated_at,
  EXTRACT(days FROM (now() - last_contact_date))::integer AS days_since_contact
FROM public.clients c
WHERE last_contact_date < (now() - '90 days'::interval)
  OR (last_contact_date IS NULL AND created_at < (now() - '90 days'::interval));

DROP VIEW IF EXISTS public.repeat_customers;
CREATE VIEW public.repeat_customers
WITH (security_invoker = true)
AS
SELECT id, organization_id, name, email, phone, address,
  client_status, client_value_tier, marketing_email_opt_in,
  marketing_sms_opt_in, opt_in_date, opt_out_date,
  last_campaign_date, first_contact_date, last_contact_date,
  last_job_date, total_revenue, job_count, average_job_value,
  source, tags, preferences_token, created_at, updated_at
FROM public.clients
WHERE job_count >= 2;

-- 4. Fix functions with mutable search_path
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
SELECT COALESCE(
  (auth.jwt() -> 'app_metadata' ->> 'is_platform_admin')::boolean,
  false
);
$$;

CREATE OR REPLACE FUNCTION public.update_client_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_client_note_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 5. Fix auth function initialization in admin_audit_logs RLS policy
DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.admin_audit_logs;
CREATE POLICY "Service role can insert audit logs"
  ON public.admin_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (((select auth.jwt()) ->> 'role') = 'service_role');
