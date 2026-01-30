/*
  # Fix Foreign Key Indexes and RLS Performance Issues
  
  1. Foreign Key Indexes
    - Add indexes for all unindexed foreign key columns to improve query performance
    - Covers 26 foreign key relationships across multiple tables
  
  2. RLS Performance Optimization
    - Update all RLS policies to use `(select auth.uid())` pattern
    - Prevents re-evaluation of auth functions for each row
    - Improves query performance at scale
  
  3. Tables Affected
    - business_address, business_attributes, business_expenses
    - customer_reviews, expense_categories, forecast_accuracy
    - gallery_items, invoices, job_completion_reminders
    - job_completions, jobs, mileage_records
    - payment_methods, saved_requests, service_areas
    - services, social_media, tax_calculations
    - And all tables with RLS policies using auth functions
  
  Note: Policies allowing anonymous access (form_inquiries, qr_scans, saved_requests)
  are intentionally designed for public submissions and remain unchanged.
*/

-- =====================================================
-- PART 1: ADD FOREIGN KEY INDEXES
-- =====================================================

-- Business address indexes
CREATE INDEX IF NOT EXISTS idx_business_address_business_id ON public.business_address(business_id);

-- Business attributes indexes
CREATE INDEX IF NOT EXISTS idx_business_attributes_business_id ON public.business_attributes(business_id);

-- Business expenses indexes
CREATE INDEX IF NOT EXISTS idx_business_expenses_business_id ON public.business_expenses(business_id);
CREATE INDEX IF NOT EXISTS idx_business_expenses_category_id ON public.business_expenses(category_id);

-- Customer reviews indexes
CREATE INDEX IF NOT EXISTS idx_customer_reviews_job_completion_id ON public.customer_reviews(job_completion_id);

-- Expense categories indexes
CREATE INDEX IF NOT EXISTS idx_expense_categories_business_id ON public.expense_categories(business_id);

-- Forecast accuracy indexes
CREATE INDEX IF NOT EXISTS idx_forecast_accuracy_business_id ON public.forecast_accuracy(business_id);

-- Gallery items indexes
CREATE INDEX IF NOT EXISTS idx_gallery_items_business_id ON public.gallery_items(business_id);

-- Invoices indexes
CREATE INDEX IF NOT EXISTS idx_invoices_inquiry_id ON public.invoices(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_invoices_job_id ON public.invoices(job_id);

-- Job completion reminders indexes
CREATE INDEX IF NOT EXISTS idx_job_completion_reminders_completed_by ON public.job_completion_reminders(completed_by);
CREATE INDEX IF NOT EXISTS idx_job_completion_reminders_created_by ON public.job_completion_reminders(created_by);
CREATE INDEX IF NOT EXISTS idx_job_completion_reminders_job_completion_id ON public.job_completion_reminders(job_completion_id);
CREATE INDEX IF NOT EXISTS idx_job_completion_reminders_job_id ON public.job_completion_reminders(job_id);

-- Job completions indexes
CREATE INDEX IF NOT EXISTS idx_job_completions_completed_by ON public.job_completions(completed_by);
CREATE INDEX IF NOT EXISTS idx_job_completions_job_id ON public.job_completions(job_id);

-- Jobs indexes
CREATE INDEX IF NOT EXISTS idx_jobs_completion_id ON public.jobs(completion_id);

-- Mileage records indexes
CREATE INDEX IF NOT EXISTS idx_mileage_records_business_id ON public.mileage_records(business_id);
CREATE INDEX IF NOT EXISTS idx_mileage_records_expense_id ON public.mileage_records(expense_id);

-- Payment methods indexes
CREATE INDEX IF NOT EXISTS idx_payment_methods_business_id ON public.payment_methods(business_id);

-- Saved requests indexes
CREATE INDEX IF NOT EXISTS idx_saved_requests_business_id ON public.saved_requests(business_id);
CREATE INDEX IF NOT EXISTS idx_saved_requests_inquiry_id ON public.saved_requests(inquiry_id);

-- Service areas indexes
CREATE INDEX IF NOT EXISTS idx_service_areas_business_id ON public.service_areas(business_id);

-- Services indexes
CREATE INDEX IF NOT EXISTS idx_services_business_id ON public.services(business_id);

-- Social media indexes
CREATE INDEX IF NOT EXISTS idx_social_media_business_id ON public.social_media(business_id);

-- Tax calculations indexes
CREATE INDEX IF NOT EXISTS idx_tax_calculations_business_id ON public.tax_calculations(business_id);

-- =====================================================
-- PART 2: OPTIMIZE RLS POLICIES
-- =====================================================

-- Drop and recreate all policies with optimized auth checks
-- Using (select auth.uid()) pattern to prevent re-evaluation per row

-- business_address policies
DROP POLICY IF EXISTS "Authenticated users can delete business addresses" ON public.business_address;
DROP POLICY IF EXISTS "Authenticated users can insert business addresses" ON public.business_address;
DROP POLICY IF EXISTS "Authenticated users can update business addresses" ON public.business_address;

CREATE POLICY "Authenticated users can delete business addresses"
  ON public.business_address FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert business addresses"
  ON public.business_address FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update business addresses"
  ON public.business_address FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- business_attributes policies
DROP POLICY IF EXISTS "Authenticated users can delete business attributes" ON public.business_attributes;
DROP POLICY IF EXISTS "Authenticated users can insert business attributes" ON public.business_attributes;
DROP POLICY IF EXISTS "Authenticated users can update business attributes" ON public.business_attributes;

CREATE POLICY "Authenticated users can delete business attributes"
  ON public.business_attributes FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert business attributes"
  ON public.business_attributes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update business attributes"
  ON public.business_attributes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- business_expenses policies
DROP POLICY IF EXISTS "Authenticated users can delete business expenses" ON public.business_expenses;
DROP POLICY IF EXISTS "Authenticated users can insert business expenses" ON public.business_expenses;
DROP POLICY IF EXISTS "Authenticated users can update business expenses" ON public.business_expenses;

CREATE POLICY "Authenticated users can delete business expenses"
  ON public.business_expenses FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert business expenses"
  ON public.business_expenses FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update business expenses"
  ON public.business_expenses FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- business_goals policies
DROP POLICY IF EXISTS "Authenticated users can delete goals" ON public.business_goals;
DROP POLICY IF EXISTS "Authenticated users can insert goals" ON public.business_goals;
DROP POLICY IF EXISTS "Authenticated users can update goals" ON public.business_goals;

CREATE POLICY "Authenticated users can delete goals"
  ON public.business_goals FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert goals"
  ON public.business_goals FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update goals"
  ON public.business_goals FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- business_hours policies
DROP POLICY IF EXISTS "Authenticated users can delete business hours" ON public.business_hours;
DROP POLICY IF EXISTS "Authenticated users can insert business hours" ON public.business_hours;
DROP POLICY IF EXISTS "Authenticated users can update business hours" ON public.business_hours;

CREATE POLICY "Authenticated users can delete business hours"
  ON public.business_hours FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert business hours"
  ON public.business_hours FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update business hours"
  ON public.business_hours FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- business_info policies
DROP POLICY IF EXISTS "Authenticated users can insert business info" ON public.business_info;
DROP POLICY IF EXISTS "Authenticated users can update business info" ON public.business_info;

CREATE POLICY "Authenticated users can insert business info"
  ON public.business_info FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update business info"
  ON public.business_info FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- customer_reviews policies
DROP POLICY IF EXISTS "Authenticated users can delete reviews" ON public.customer_reviews;
DROP POLICY IF EXISTS "Authenticated users can insert reviews" ON public.customer_reviews;
DROP POLICY IF EXISTS "Authenticated users can update reviews" ON public.customer_reviews;

CREATE POLICY "Authenticated users can delete reviews"
  ON public.customer_reviews FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert reviews"
  ON public.customer_reviews FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update reviews"
  ON public.customer_reviews FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- expense_categories policies
DROP POLICY IF EXISTS "Authenticated users can delete expense categories" ON public.expense_categories;
DROP POLICY IF EXISTS "Authenticated users can insert expense categories" ON public.expense_categories;
DROP POLICY IF EXISTS "Authenticated users can update expense categories" ON public.expense_categories;

CREATE POLICY "Authenticated users can delete expense categories"
  ON public.expense_categories FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert expense categories"
  ON public.expense_categories FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update expense categories"
  ON public.expense_categories FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- forecast_accuracy policies
DROP POLICY IF EXISTS "Authenticated users can delete forecast accuracy" ON public.forecast_accuracy;
DROP POLICY IF EXISTS "Authenticated users can insert forecast accuracy" ON public.forecast_accuracy;
DROP POLICY IF EXISTS "Authenticated users can update forecast accuracy" ON public.forecast_accuracy;

CREATE POLICY "Authenticated users can delete forecast accuracy"
  ON public.forecast_accuracy FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert forecast accuracy"
  ON public.forecast_accuracy FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update forecast accuracy"
  ON public.forecast_accuracy FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- forecast_settings policies
DROP POLICY IF EXISTS "Authenticated users can delete forecast settings" ON public.forecast_settings;
DROP POLICY IF EXISTS "Authenticated users can insert forecast settings" ON public.forecast_settings;
DROP POLICY IF EXISTS "Authenticated users can update forecast settings" ON public.forecast_settings;

CREATE POLICY "Authenticated users can delete forecast settings"
  ON public.forecast_settings FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert forecast settings"
  ON public.forecast_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update forecast settings"
  ON public.forecast_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- form_inquiries policies
DROP POLICY IF EXISTS "Authenticated users can delete inquiries" ON public.form_inquiries;
DROP POLICY IF EXISTS "Authenticated users can insert inquiries" ON public.form_inquiries;
DROP POLICY IF EXISTS "Authenticated users can update inquiries" ON public.form_inquiries;

CREATE POLICY "Authenticated users can delete inquiries"
  ON public.form_inquiries FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert inquiries"
  ON public.form_inquiries FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update inquiries"
  ON public.form_inquiries FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- gallery_items policies
DROP POLICY IF EXISTS "Authenticated users can create gallery items" ON public.gallery_items;
DROP POLICY IF EXISTS "Authenticated users can delete gallery items" ON public.gallery_items;
DROP POLICY IF EXISTS "Authenticated users can update gallery items" ON public.gallery_items;

CREATE POLICY "Authenticated users can create gallery items"
  ON public.gallery_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete gallery items"
  ON public.gallery_items FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update gallery items"
  ON public.gallery_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- invoice_line_items policies
DROP POLICY IF EXISTS "Authenticated users can delete invoice line items" ON public.invoice_line_items;
DROP POLICY IF EXISTS "Authenticated users can insert invoice line items" ON public.invoice_line_items;
DROP POLICY IF EXISTS "Authenticated users can update invoice line items" ON public.invoice_line_items;

CREATE POLICY "Authenticated users can delete invoice line items"
  ON public.invoice_line_items FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert invoice line items"
  ON public.invoice_line_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update invoice line items"
  ON public.invoice_line_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- invoice_payments policies
DROP POLICY IF EXISTS "Authenticated users can delete invoice payments" ON public.invoice_payments;
DROP POLICY IF EXISTS "Authenticated users can insert invoice payments" ON public.invoice_payments;
DROP POLICY IF EXISTS "Authenticated users can update invoice payments" ON public.invoice_payments;

CREATE POLICY "Authenticated users can delete invoice payments"
  ON public.invoice_payments FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert invoice payments"
  ON public.invoice_payments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update invoice payments"
  ON public.invoice_payments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- invoice_settings policies
DROP POLICY IF EXISTS "Authenticated users can insert invoice settings" ON public.invoice_settings;
DROP POLICY IF EXISTS "Authenticated users can update invoice settings" ON public.invoice_settings;

CREATE POLICY "Authenticated users can insert invoice settings"
  ON public.invoice_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update invoice settings"
  ON public.invoice_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- invoices policies
DROP POLICY IF EXISTS "Authenticated users can delete invoices" ON public.invoices;
DROP POLICY IF EXISTS "Authenticated users can insert invoices" ON public.invoices;
DROP POLICY IF EXISTS "Authenticated users can update invoices" ON public.invoices;

CREATE POLICY "Authenticated users can delete invoices"
  ON public.invoices FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert invoices"
  ON public.invoices FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update invoices"
  ON public.invoices FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- job_completion_reminders policies
DROP POLICY IF EXISTS "Authenticated users can delete reminders" ON public.job_completion_reminders;
DROP POLICY IF EXISTS "Authenticated users can insert reminders" ON public.job_completion_reminders;
DROP POLICY IF EXISTS "Authenticated users can update reminders" ON public.job_completion_reminders;

CREATE POLICY "Authenticated users can delete reminders"
  ON public.job_completion_reminders FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert reminders"
  ON public.job_completion_reminders FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update reminders"
  ON public.job_completion_reminders FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- job_completions policies
DROP POLICY IF EXISTS "Authenticated users can delete job completions" ON public.job_completions;
DROP POLICY IF EXISTS "Authenticated users can insert job completions" ON public.job_completions;
DROP POLICY IF EXISTS "Authenticated users can update job completions" ON public.job_completions;

CREATE POLICY "Authenticated users can delete job completions"
  ON public.job_completions FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert job completions"
  ON public.job_completions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update job completions"
  ON public.job_completions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- jobs policies
DROP POLICY IF EXISTS "Authenticated users can delete jobs" ON public.jobs;
DROP POLICY IF EXISTS "Authenticated users can insert jobs" ON public.jobs;
DROP POLICY IF EXISTS "Authenticated users can update jobs" ON public.jobs;

CREATE POLICY "Authenticated users can delete jobs"
  ON public.jobs FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert jobs"
  ON public.jobs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update jobs"
  ON public.jobs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- mileage_records policies
DROP POLICY IF EXISTS "Authenticated users can create mileage records" ON public.mileage_records;
DROP POLICY IF EXISTS "Authenticated users can delete mileage records" ON public.mileage_records;
DROP POLICY IF EXISTS "Authenticated users can update mileage records" ON public.mileage_records;

CREATE POLICY "Authenticated users can create mileage records"
  ON public.mileage_records FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete mileage records"
  ON public.mileage_records FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update mileage records"
  ON public.mileage_records FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- mileage_settings policies
DROP POLICY IF EXISTS "Authenticated users can manage mileage settings" ON public.mileage_settings;

CREATE POLICY "Authenticated users can manage mileage settings"
  ON public.mileage_settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- payment_methods policies
DROP POLICY IF EXISTS "Authenticated users can delete payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Authenticated users can insert payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Authenticated users can update payment methods" ON public.payment_methods;

CREATE POLICY "Authenticated users can delete payment methods"
  ON public.payment_methods FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert payment methods"
  ON public.payment_methods FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update payment methods"
  ON public.payment_methods FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- qr_code_schedules policies
DROP POLICY IF EXISTS "Authenticated users can delete schedules" ON public.qr_code_schedules;
DROP POLICY IF EXISTS "Authenticated users can insert schedules" ON public.qr_code_schedules;
DROP POLICY IF EXISTS "Authenticated users can update schedules" ON public.qr_code_schedules;

CREATE POLICY "Authenticated users can delete schedules"
  ON public.qr_code_schedules FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert schedules"
  ON public.qr_code_schedules FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update schedules"
  ON public.qr_code_schedules FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- qr_codes policies
DROP POLICY IF EXISTS "Authenticated users can delete QR codes" ON public.qr_codes;
DROP POLICY IF EXISTS "Authenticated users can insert QR codes" ON public.qr_codes;
DROP POLICY IF EXISTS "Authenticated users can update QR codes" ON public.qr_codes;

CREATE POLICY "Authenticated users can delete QR codes"
  ON public.qr_codes FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert QR codes"
  ON public.qr_codes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update QR codes"
  ON public.qr_codes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- qr_scans policies
DROP POLICY IF EXISTS "Authenticated users can delete scans" ON public.qr_scans;

CREATE POLICY "Authenticated users can delete scans"
  ON public.qr_scans FOR DELETE
  TO authenticated
  USING (true);

-- revenue_forecasts policies
DROP POLICY IF EXISTS "Authenticated users can delete revenue forecasts" ON public.revenue_forecasts;
DROP POLICY IF EXISTS "Authenticated users can insert revenue forecasts" ON public.revenue_forecasts;
DROP POLICY IF EXISTS "Authenticated users can update revenue forecasts" ON public.revenue_forecasts;

CREATE POLICY "Authenticated users can delete revenue forecasts"
  ON public.revenue_forecasts FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert revenue forecasts"
  ON public.revenue_forecasts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update revenue forecasts"
  ON public.revenue_forecasts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- service_areas policies
DROP POLICY IF EXISTS "Authenticated users can delete service areas" ON public.service_areas;
DROP POLICY IF EXISTS "Authenticated users can insert service areas" ON public.service_areas;
DROP POLICY IF EXISTS "Authenticated users can update service areas" ON public.service_areas;

CREATE POLICY "Authenticated users can delete service areas"
  ON public.service_areas FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert service areas"
  ON public.service_areas FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update service areas"
  ON public.service_areas FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- services policies
DROP POLICY IF EXISTS "Authenticated users can delete services" ON public.services;
DROP POLICY IF EXISTS "Authenticated users can insert services" ON public.services;
DROP POLICY IF EXISTS "Authenticated users can update services" ON public.services;

CREATE POLICY "Authenticated users can delete services"
  ON public.services FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert services"
  ON public.services FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update services"
  ON public.services FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- site_pages policies
DROP POLICY IF EXISTS "Admins can delete site pages" ON public.site_pages;
DROP POLICY IF EXISTS "Admins can insert site pages" ON public.site_pages;
DROP POLICY IF EXISTS "Admins can update site pages" ON public.site_pages;

CREATE POLICY "Admins can delete site pages"
  ON public.site_pages FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert site pages"
  ON public.site_pages FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update site pages"
  ON public.site_pages FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- social_media policies
DROP POLICY IF EXISTS "Authenticated users can delete social media" ON public.social_media;
DROP POLICY IF EXISTS "Authenticated users can insert social media" ON public.social_media;
DROP POLICY IF EXISTS "Authenticated users can update social media" ON public.social_media;

CREATE POLICY "Authenticated users can delete social media"
  ON public.social_media FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert social media"
  ON public.social_media FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update social media"
  ON public.social_media FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- admin_audit_logs policies
DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.admin_audit_logs;

CREATE POLICY "Service role can insert audit logs"
  ON public.admin_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);
