/*
  # Fix Security and Performance Issues

  ## Summary
  Addresses multiple security and performance findings from the Supabase advisor.

  ## Changes

  ### 1. Unindexed Foreign Key
  - `public.client_notes` — adds index on `created_by` column (foreign key to auth.users)

  ### 2. RLS Auth Function Performance
  - `public.organizations` — replaces bare `auth.uid()` / `auth.jwt()` calls with
    `(select auth.uid())` / `(select auth.jwt())` in the INSERT policy so the planner
    can cache the result instead of re-evaluating per row.

  ### 3. Unused Indexes Dropped
  All indexes flagged as never-used by pg_stat_user_indexes are dropped.
  These were created for anticipated query patterns that turned out not to be needed.

  ### 4. Always-True RLS Policies on test_identifiers
  Replaces the `USING (true)` / `WITH CHECK (true)` policies with proper
  `auth.uid() IS NOT NULL` guards so unauthenticated callers are explicitly
  blocked even if the role claim were somehow bypassed.
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Add missing index for client_notes.created_by foreign key
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_client_notes_created_by
  ON public.client_notes (created_by);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Fix organizations INSERT policy to cache auth function result
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;

CREATE POLICY "Authenticated users can create organizations"
  ON public.organizations
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Fix test_identifiers RLS policies (remove always-true clauses)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can read test identifiers"   ON public.test_identifiers;
DROP POLICY IF EXISTS "Authenticated users can insert test identifiers"  ON public.test_identifiers;
DROP POLICY IF EXISTS "Authenticated users can delete test identifiers"  ON public.test_identifiers;

CREATE POLICY "Authenticated users can read test identifiers"
  ON public.test_identifiers
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can insert test identifiers"
  ON public.test_identifiers
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can delete test identifiers"
  ON public.test_identifiers
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Drop all unused indexes
-- ─────────────────────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS public.idx_business_address_business_id;
DROP INDEX IF EXISTS public.idx_business_address_organization_id;
DROP INDEX IF EXISTS public.idx_business_attributes_business_id;
DROP INDEX IF EXISTS public.idx_business_attributes_organization_id;
DROP INDEX IF EXISTS public.idx_business_expenses_category_id;
DROP INDEX IF EXISTS public.idx_business_expenses_organization_id;
DROP INDEX IF EXISTS public.idx_business_goals_organization_id;
DROP INDEX IF EXISTS public.idx_business_hours_organization_id;
DROP INDEX IF EXISTS public.idx_business_info_organization_id;
DROP INDEX IF EXISTS public.idx_client_notes_organization_id;
DROP INDEX IF EXISTS public.idx_customer_reviews_job_completion_id;
DROP INDEX IF EXISTS public.idx_customer_reviews_organization_id;
DROP INDEX IF EXISTS public.idx_expense_categories_business_id;
DROP INDEX IF EXISTS public.idx_expense_categories_organization_id;
DROP INDEX IF EXISTS public.idx_forecast_accuracy_business_id;
DROP INDEX IF EXISTS public.idx_forecast_accuracy_organization_id;
DROP INDEX IF EXISTS public.idx_forecast_settings_organization_id;
DROP INDEX IF EXISTS public.idx_form_inquiries_organization_id;
DROP INDEX IF EXISTS public.idx_gallery_items_business_id;
DROP INDEX IF EXISTS public.idx_gallery_items_organization_id;
DROP INDEX IF EXISTS public.idx_invoice_line_items_organization_id;
DROP INDEX IF EXISTS public.idx_invoice_payments_organization_id;
DROP INDEX IF EXISTS public.idx_invoice_settings_organization_id;
DROP INDEX IF EXISTS public.idx_invoices_organization_id;
DROP INDEX IF EXISTS public.idx_job_completion_reminders_completed_by;
DROP INDEX IF EXISTS public.idx_job_completion_reminders_created_by;
DROP INDEX IF EXISTS public.idx_job_completion_reminders_job_completion_id;
DROP INDEX IF EXISTS public.idx_job_completion_reminders_job_id;
DROP INDEX IF EXISTS public.idx_job_completion_reminders_organization_id;
DROP INDEX IF EXISTS public.idx_job_completions_completed_by;
DROP INDEX IF EXISTS public.idx_job_completions_job_id;
DROP INDEX IF EXISTS public.idx_job_completions_organization_id;
DROP INDEX IF EXISTS public.idx_jobs_completion_id;
DROP INDEX IF EXISTS public.idx_jobs_organization_id;
DROP INDEX IF EXISTS public.idx_qr_code_schedules_organization_id;
DROP INDEX IF EXISTS public.idx_qr_codes_organization_id;
DROP INDEX IF EXISTS public.idx_qr_scans_organization_id;
DROP INDEX IF EXISTS public.idx_quarterly_tax_payments_organization_id;
DROP INDEX IF EXISTS public.idx_mileage_records_business_id;
DROP INDEX IF EXISTS public.idx_mileage_records_expense_id;
DROP INDEX IF EXISTS public.idx_mileage_records_organization_id;
DROP INDEX IF EXISTS public.idx_mileage_settings_organization_id;
DROP INDEX IF EXISTS public.idx_notification_bar_organization_id;
DROP INDEX IF EXISTS public.idx_payment_methods_business_id;
DROP INDEX IF EXISTS public.idx_payment_methods_organization_id;
DROP INDEX IF EXISTS public.idx_saved_requests_business_id;
DROP INDEX IF EXISTS public.idx_saved_requests_organization_id;
DROP INDEX IF EXISTS public.idx_service_areas_business_id;
DROP INDEX IF EXISTS public.idx_service_areas_organization_id;
DROP INDEX IF EXISTS public.idx_services_business_id;
DROP INDEX IF EXISTS public.idx_services_organization_id;
DROP INDEX IF EXISTS public.idx_site_pages_organization_id;
DROP INDEX IF EXISTS public.idx_social_media_business_id;
DROP INDEX IF EXISTS public.idx_social_media_organization_id;
DROP INDEX IF EXISTS public.idx_tax_calculations_business_id;
DROP INDEX IF EXISTS public.idx_tax_calculations_organization_id;
DROP INDEX IF EXISTS public.idx_tax_settings_organization_id;
DROP INDEX IF EXISTS public.idx_form_inquiries_is_test;
DROP INDEX IF EXISTS public.idx_saved_requests_is_test;
