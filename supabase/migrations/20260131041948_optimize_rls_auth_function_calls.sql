/*
  # Optimize RLS Policies - Auth Function Performance

  This migration optimizes RLS policies by wrapping auth function calls with SELECT
  to prevent re-evaluation for each row, significantly improving query performance.
  
  ## Changes
  
  ### Organizations and Members
  - Optimizes policies on organizations table
  - Optimizes policies on organization_members table
  
  ### Core Business Tables
  - Optimizes policies on business_address
  - Optimizes policies on business_attributes
  - Optimizes policies on business_expenses
  - Optimizes policies on business_goals
  - Optimizes policies on business_hours
  - Optimizes policies on customer_reviews
  - Optimizes policies on expense_categories
  - Optimizes policies on forecast_accuracy
  - Optimizes policies on forecast_settings
  - Optimizes policies on form_inquiries
  - Optimizes policies on gallery_items
  
  ### Invoice and Job Tables
  - Optimizes policies on invoice_line_items
  - Optimizes policies on invoice_payments
  - Optimizes policies on invoice_settings
  - Optimizes policies on invoices
  - Optimizes policies on job_completion_reminders
  - Optimizes policies on job_completions
  - Optimizes policies on jobs
  
  ### Other Tables
  - Optimizes policies on mileage_records
  - Optimizes policies on mileage_settings
  - Optimizes policies on payment_methods
  - Optimizes policies on qr_code_schedules
  - Optimizes policies on qr_codes
  - Optimizes policies on qr_scans
  - Optimizes policies on quarterly_tax_payments
  - Optimizes policies on revenue_forecasts
  - Optimizes policies on service_areas
  - Optimizes policies on services
  - Optimizes policies on site_pages
  - Optimizes policies on social_media
  - Optimizes policies on tax_calculations
  - Optimizes policies on tax_settings
  - Optimizes policies on admin_audit_logs
  
  ## Performance Impact
  - Reduces query execution time by preventing function re-evaluation
  - Improves scalability for tables with many rows
  - Maintains same security guarantees
*/

-- =====================================================
-- ORGANIZATIONS
-- =====================================================

DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;
CREATE POLICY "Users can view their organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = (SELECT auth.uid()) 
      AND is_active = true
    )
  );

DROP POLICY IF EXISTS "Organization admins can update their organization" ON organizations;
CREATE POLICY "Organization admins can update their organization"
  ON organizations FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = (SELECT auth.uid()) 
      AND role IN ('owner', 'admin')
      AND is_active = true
    )
  );

-- =====================================================
-- ORGANIZATION MEMBERS
-- =====================================================

DROP POLICY IF EXISTS "Users can view members of their organizations" ON organization_members;
CREATE POLICY "Users can view members of their organizations"
  ON organization_members FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = (SELECT auth.uid()) 
      AND is_active = true
    )
  );

DROP POLICY IF EXISTS "Organization admins can manage members" ON organization_members;
CREATE POLICY "Organization admins can manage members"
  ON organization_members FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = (SELECT auth.uid()) 
      AND role IN ('owner', 'admin')
      AND is_active = true
    )
  );

-- =====================================================
-- ADMIN AUDIT LOGS
-- =====================================================

DROP POLICY IF EXISTS "Service role can insert audit logs" ON admin_audit_logs;
CREATE POLICY "Service role can insert audit logs"
  ON admin_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.jwt()->>'role') = 'service_role');

-- =====================================================
-- BUSINESS ADDRESS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete business addresses" ON business_address;
CREATE POLICY "Authenticated users can delete business addresses"
  ON business_address FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert business addresses" ON business_address;
CREATE POLICY "Authenticated users can insert business addresses"
  ON business_address FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update business addresses" ON business_address;
CREATE POLICY "Authenticated users can update business addresses"
  ON business_address FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- =====================================================
-- BUSINESS ATTRIBUTES
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete business attributes" ON business_attributes;
CREATE POLICY "Authenticated users can delete business attributes"
  ON business_attributes FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert business attributes" ON business_attributes;
CREATE POLICY "Authenticated users can insert business attributes"
  ON business_attributes FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update business attributes" ON business_attributes;
CREATE POLICY "Authenticated users can update business attributes"
  ON business_attributes FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- =====================================================
-- BUSINESS EXPENSES
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete business expenses" ON business_expenses;
CREATE POLICY "Authenticated users can delete business expenses"
  ON business_expenses FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert business expenses" ON business_expenses;
CREATE POLICY "Authenticated users can insert business expenses"
  ON business_expenses FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update business expenses" ON business_expenses;
CREATE POLICY "Authenticated users can update business expenses"
  ON business_expenses FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- =====================================================
-- BUSINESS GOALS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete goals" ON business_goals;
CREATE POLICY "Authenticated users can delete goals"
  ON business_goals FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert goals" ON business_goals;
CREATE POLICY "Authenticated users can insert goals"
  ON business_goals FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update goals" ON business_goals;
CREATE POLICY "Authenticated users can update goals"
  ON business_goals FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- =====================================================
-- BUSINESS HOURS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete business hours" ON business_hours;
CREATE POLICY "Authenticated users can delete business hours"
  ON business_hours FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert business hours" ON business_hours;
CREATE POLICY "Authenticated users can insert business hours"
  ON business_hours FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update business hours" ON business_hours;
CREATE POLICY "Authenticated users can update business hours"
  ON business_hours FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- =====================================================
-- CUSTOMER REVIEWS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete reviews" ON customer_reviews;
CREATE POLICY "Authenticated users can delete reviews"
  ON customer_reviews FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert reviews" ON customer_reviews;
CREATE POLICY "Authenticated users can insert reviews"
  ON customer_reviews FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update reviews" ON customer_reviews;
CREATE POLICY "Authenticated users can update reviews"
  ON customer_reviews FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- =====================================================
-- EXPENSE CATEGORIES
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete expense categories" ON expense_categories;
CREATE POLICY "Authenticated users can delete expense categories"
  ON expense_categories FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert expense categories" ON expense_categories;
CREATE POLICY "Authenticated users can insert expense categories"
  ON expense_categories FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update expense categories" ON expense_categories;
CREATE POLICY "Authenticated users can update expense categories"
  ON expense_categories FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- =====================================================
-- FORECAST ACCURACY
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete forecast accuracy" ON forecast_accuracy;
CREATE POLICY "Authenticated users can delete forecast accuracy"
  ON forecast_accuracy FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert forecast accuracy" ON forecast_accuracy;
CREATE POLICY "Authenticated users can insert forecast accuracy"
  ON forecast_accuracy FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update forecast accuracy" ON forecast_accuracy;
CREATE POLICY "Authenticated users can update forecast accuracy"
  ON forecast_accuracy FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- =====================================================
-- FORECAST SETTINGS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete forecast settings" ON forecast_settings;
CREATE POLICY "Authenticated users can delete forecast settings"
  ON forecast_settings FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert forecast settings" ON forecast_settings;
CREATE POLICY "Authenticated users can insert forecast settings"
  ON forecast_settings FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update forecast settings" ON forecast_settings;
CREATE POLICY "Authenticated users can update forecast settings"
  ON forecast_settings FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- =====================================================
-- FORM INQUIRIES
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete inquiries" ON form_inquiries;
CREATE POLICY "Authenticated users can delete inquiries"
  ON form_inquiries FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert inquiries" ON form_inquiries;
CREATE POLICY "Authenticated users can insert inquiries"
  ON form_inquiries FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update inquiries" ON form_inquiries;
CREATE POLICY "Authenticated users can update inquiries"
  ON form_inquiries FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- =====================================================
-- GALLERY ITEMS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can create gallery items" ON gallery_items;
CREATE POLICY "Authenticated users can create gallery items"
  ON gallery_items FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete gallery items" ON gallery_items;
CREATE POLICY "Authenticated users can delete gallery items"
  ON gallery_items FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update gallery items" ON gallery_items;
CREATE POLICY "Authenticated users can update gallery items"
  ON gallery_items FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- =====================================================
-- INVOICE LINE ITEMS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete invoice line items" ON invoice_line_items;
CREATE POLICY "Authenticated users can delete invoice line items"
  ON invoice_line_items FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert invoice line items" ON invoice_line_items;
CREATE POLICY "Authenticated users can insert invoice line items"
  ON invoice_line_items FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update invoice line items" ON invoice_line_items;
CREATE POLICY "Authenticated users can update invoice line items"
  ON invoice_line_items FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- =====================================================
-- INVOICE PAYMENTS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete invoice payments" ON invoice_payments;
CREATE POLICY "Authenticated users can delete invoice payments"
  ON invoice_payments FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert invoice payments" ON invoice_payments;
CREATE POLICY "Authenticated users can insert invoice payments"
  ON invoice_payments FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update invoice payments" ON invoice_payments;
CREATE POLICY "Authenticated users can update invoice payments"
  ON invoice_payments FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- =====================================================
-- INVOICE SETTINGS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can insert invoice settings" ON invoice_settings;
CREATE POLICY "Authenticated users can insert invoice settings"
  ON invoice_settings FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update invoice settings" ON invoice_settings;
CREATE POLICY "Authenticated users can update invoice settings"
  ON invoice_settings FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- =====================================================
-- INVOICES
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete invoices" ON invoices;
CREATE POLICY "Authenticated users can delete invoices"
  ON invoices FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert invoices" ON invoices;
CREATE POLICY "Authenticated users can insert invoices"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update invoices" ON invoices;
CREATE POLICY "Authenticated users can update invoices"
  ON invoices FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- =====================================================
-- JOB COMPLETION REMINDERS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete reminders" ON job_completion_reminders;
CREATE POLICY "Authenticated users can delete reminders"
  ON job_completion_reminders FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert reminders" ON job_completion_reminders;
CREATE POLICY "Authenticated users can insert reminders"
  ON job_completion_reminders FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update reminders" ON job_completion_reminders;
CREATE POLICY "Authenticated users can update reminders"
  ON job_completion_reminders FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- =====================================================
-- JOB COMPLETIONS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete job completions" ON job_completions;
CREATE POLICY "Authenticated users can delete job completions"
  ON job_completions FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert job completions" ON job_completions;
CREATE POLICY "Authenticated users can insert job completions"
  ON job_completions FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update job completions" ON job_completions;
CREATE POLICY "Authenticated users can update job completions"
  ON job_completions FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- =====================================================
-- JOBS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete jobs" ON jobs;
CREATE POLICY "Authenticated users can delete jobs"
  ON jobs FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert jobs" ON jobs;
CREATE POLICY "Authenticated users can insert jobs"
  ON jobs FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update jobs" ON jobs;
CREATE POLICY "Authenticated users can update jobs"
  ON jobs FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- =====================================================
-- MILEAGE RECORDS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can create mileage records" ON mileage_records;
CREATE POLICY "Authenticated users can create mileage records"
  ON mileage_records FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete mileage records" ON mileage_records;
CREATE POLICY "Authenticated users can delete mileage records"
  ON mileage_records FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update mileage records" ON mileage_records;
CREATE POLICY "Authenticated users can update mileage records"
  ON mileage_records FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- =====================================================
-- MILEAGE SETTINGS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can select mileage settings" ON mileage_settings;
CREATE POLICY "Authenticated users can select mileage settings"
  ON mileage_settings FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert mileage settings" ON mileage_settings;
CREATE POLICY "Authenticated users can insert mileage settings"
  ON mileage_settings FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update mileage settings" ON mileage_settings;
CREATE POLICY "Authenticated users can update mileage settings"
  ON mileage_settings FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete mileage settings" ON mileage_settings;
CREATE POLICY "Authenticated users can delete mileage settings"
  ON mileage_settings FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- =====================================================
-- PAYMENT METHODS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete payment methods" ON payment_methods;
CREATE POLICY "Authenticated users can delete payment methods"
  ON payment_methods FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert payment methods" ON payment_methods;
CREATE POLICY "Authenticated users can insert payment methods"
  ON payment_methods FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update payment methods" ON payment_methods;
CREATE POLICY "Authenticated users can update payment methods"
  ON payment_methods FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- =====================================================
-- QR CODE SCHEDULES
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete schedules" ON qr_code_schedules;
CREATE POLICY "Authenticated users can delete schedules"
  ON qr_code_schedules FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert schedules" ON qr_code_schedules;
CREATE POLICY "Authenticated users can insert schedules"
  ON qr_code_schedules FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update schedules" ON qr_code_schedules;
CREATE POLICY "Authenticated users can update schedules"
  ON qr_code_schedules FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- =====================================================
-- QR CODES
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete QR codes" ON qr_codes;
CREATE POLICY "Authenticated users can delete QR codes"
  ON qr_codes FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert QR codes" ON qr_codes;
CREATE POLICY "Authenticated users can insert QR codes"
  ON qr_codes FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update QR codes" ON qr_codes;
CREATE POLICY "Authenticated users can update QR codes"
  ON qr_codes FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- =====================================================
-- QR SCANS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete scans" ON qr_scans;
CREATE POLICY "Authenticated users can delete scans"
  ON qr_scans FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- =====================================================
-- QUARTERLY TAX PAYMENTS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete quarterly payments" ON quarterly_tax_payments;
CREATE POLICY "Authenticated users can delete quarterly payments"
  ON quarterly_tax_payments FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert quarterly payments" ON quarterly_tax_payments;
CREATE POLICY "Authenticated users can insert quarterly payments"
  ON quarterly_tax_payments FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update quarterly payments" ON quarterly_tax_payments;
CREATE POLICY "Authenticated users can update quarterly payments"
  ON quarterly_tax_payments FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- =====================================================
-- REVENUE FORECASTS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete revenue forecasts" ON revenue_forecasts;
CREATE POLICY "Authenticated users can delete revenue forecasts"
  ON revenue_forecasts FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert revenue forecasts" ON revenue_forecasts;
CREATE POLICY "Authenticated users can insert revenue forecasts"
  ON revenue_forecasts FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update revenue forecasts" ON revenue_forecasts;
CREATE POLICY "Authenticated users can update revenue forecasts"
  ON revenue_forecasts FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- =====================================================
-- SERVICE AREAS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete service areas" ON service_areas;
CREATE POLICY "Authenticated users can delete service areas"
  ON service_areas FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert service areas" ON service_areas;
CREATE POLICY "Authenticated users can insert service areas"
  ON service_areas FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update service areas" ON service_areas;
CREATE POLICY "Authenticated users can update service areas"
  ON service_areas FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- =====================================================
-- SERVICES
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete services" ON services;
CREATE POLICY "Authenticated users can delete services"
  ON services FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert services" ON services;
CREATE POLICY "Authenticated users can insert services"
  ON services FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update services" ON services;
CREATE POLICY "Authenticated users can update services"
  ON services FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- =====================================================
-- SITE PAGES
-- =====================================================

DROP POLICY IF EXISTS "Admins can delete site pages" ON site_pages;
CREATE POLICY "Admins can delete site pages"
  ON site_pages FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Admins can insert site pages" ON site_pages;
CREATE POLICY "Admins can insert site pages"
  ON site_pages FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Admins can update site pages" ON site_pages;
CREATE POLICY "Admins can update site pages"
  ON site_pages FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- =====================================================
-- SOCIAL MEDIA
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete social media" ON social_media;
CREATE POLICY "Authenticated users can delete social media"
  ON social_media FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert social media" ON social_media;
CREATE POLICY "Authenticated users can insert social media"
  ON social_media FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update social media" ON social_media;
CREATE POLICY "Authenticated users can update social media"
  ON social_media FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- =====================================================
-- TAX CALCULATIONS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete tax calculations" ON tax_calculations;
CREATE POLICY "Authenticated users can delete tax calculations"
  ON tax_calculations FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert tax calculations" ON tax_calculations;
CREATE POLICY "Authenticated users can insert tax calculations"
  ON tax_calculations FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update tax calculations" ON tax_calculations;
CREATE POLICY "Authenticated users can update tax calculations"
  ON tax_calculations FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- =====================================================
-- TAX SETTINGS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete tax settings" ON tax_settings;
CREATE POLICY "Authenticated users can delete tax settings"
  ON tax_settings FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert tax settings" ON tax_settings;
CREATE POLICY "Authenticated users can insert tax settings"
  ON tax_settings FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update tax settings" ON tax_settings;
CREATE POLICY "Authenticated users can update tax settings"
  ON tax_settings FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);