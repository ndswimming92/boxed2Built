/*
  # Consolidate Duplicate RLS Policies

  This migration removes duplicate permissive policies that were creating security gaps
  and performance issues. We keep organization-scoped and platform admin policies while
  removing overly broad "authenticated user" policies that bypassed proper authorization.
  
  ## Changes
  
  ### Removed Policies
  - Removes overly broad "Authenticated users can..." policies
  - Keeps organization-scoped policies for proper multi-tenant isolation
  - Keeps platform admin policies for administrative access
  - Keeps public read policies where appropriate
  
  ### Security Impact
  - Eliminates multiple policy conflicts
  - Ensures proper organization-based access control
  - Prevents unauthorized access across organizations
  - Improves policy evaluation performance
  
  ## Tables Affected
  - All business tables with duplicate policies
*/

-- =====================================================
-- ADMIN AUDIT LOGS
-- Remove duplicate insert policy (keep service role and organization-based)
-- =====================================================

DROP POLICY IF EXISTS "All authenticated users can create audit logs" ON admin_audit_logs;

-- =====================================================
-- BUSINESS ADDRESS
-- Remove overly broad authenticated policies (keep organization-based)
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete business addresses" ON business_address;
DROP POLICY IF EXISTS "Authenticated users can insert business addresses" ON business_address;
DROP POLICY IF EXISTS "Authenticated users can update business addresses" ON business_address;

-- =====================================================
-- BUSINESS ATTRIBUTES
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete business attributes" ON business_attributes;
DROP POLICY IF EXISTS "Authenticated users can insert business attributes" ON business_attributes;
DROP POLICY IF EXISTS "Authenticated users can update business attributes" ON business_attributes;

-- =====================================================
-- BUSINESS EXPENSES
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete business expenses" ON business_expenses;
DROP POLICY IF EXISTS "Authenticated users can insert business expenses" ON business_expenses;
DROP POLICY IF EXISTS "Authenticated users can update business expenses" ON business_expenses;

-- =====================================================
-- BUSINESS GOALS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete goals" ON business_goals;
DROP POLICY IF EXISTS "Authenticated users can insert goals" ON business_goals;
DROP POLICY IF EXISTS "Authenticated users can update goals" ON business_goals;
DROP POLICY IF EXISTS "Authenticated users can view goals" ON business_goals;

-- =====================================================
-- BUSINESS HOURS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete business hours" ON business_hours;
DROP POLICY IF EXISTS "Authenticated users can insert business hours" ON business_hours;
DROP POLICY IF EXISTS "Authenticated users can update business hours" ON business_hours;

-- =====================================================
-- CUSTOMER REVIEWS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete reviews" ON customer_reviews;
DROP POLICY IF EXISTS "Authenticated users can insert reviews" ON customer_reviews;
DROP POLICY IF EXISTS "Authenticated users can update reviews" ON customer_reviews;

-- =====================================================
-- EXPENSE CATEGORIES
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete expense categories" ON expense_categories;
DROP POLICY IF EXISTS "Authenticated users can insert expense categories" ON expense_categories;
DROP POLICY IF EXISTS "Authenticated users can update expense categories" ON expense_categories;

-- =====================================================
-- FORECAST ACCURACY
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete forecast accuracy" ON forecast_accuracy;
DROP POLICY IF EXISTS "Authenticated users can insert forecast accuracy" ON forecast_accuracy;
DROP POLICY IF EXISTS "Authenticated users can update forecast accuracy" ON forecast_accuracy;
DROP POLICY IF EXISTS "Authenticated users can read forecast accuracy" ON forecast_accuracy;

-- =====================================================
-- FORECAST SETTINGS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete forecast settings" ON forecast_settings;
DROP POLICY IF EXISTS "Authenticated users can insert forecast settings" ON forecast_settings;
DROP POLICY IF EXISTS "Authenticated users can update forecast settings" ON forecast_settings;
DROP POLICY IF EXISTS "Authenticated users can read forecast settings" ON forecast_settings;

-- =====================================================
-- FORM INQUIRIES
-- Remove duplicate anonymous policy (keep "Anyone can submit")
-- Remove overly broad authenticated policies (keep organization-based)
-- =====================================================

DROP POLICY IF EXISTS "Anonymous users can submit inquiries" ON form_inquiries;
DROP POLICY IF EXISTS "Authenticated users can delete inquiries" ON form_inquiries;
DROP POLICY IF EXISTS "Authenticated users can insert inquiries" ON form_inquiries;
DROP POLICY IF EXISTS "Authenticated users can update inquiries" ON form_inquiries;

-- =====================================================
-- GALLERY ITEMS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can create gallery items" ON gallery_items;
DROP POLICY IF EXISTS "Authenticated users can delete gallery items" ON gallery_items;
DROP POLICY IF EXISTS "Authenticated users can update gallery items" ON gallery_items;

-- =====================================================
-- INVOICE LINE ITEMS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete invoice line items" ON invoice_line_items;
DROP POLICY IF EXISTS "Authenticated users can insert invoice line items" ON invoice_line_items;
DROP POLICY IF EXISTS "Authenticated users can update invoice line items" ON invoice_line_items;

-- =====================================================
-- INVOICE PAYMENTS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete invoice payments" ON invoice_payments;
DROP POLICY IF EXISTS "Authenticated users can insert invoice payments" ON invoice_payments;
DROP POLICY IF EXISTS "Authenticated users can update invoice payments" ON invoice_payments;

-- =====================================================
-- INVOICE SETTINGS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can insert invoice settings" ON invoice_settings;
DROP POLICY IF EXISTS "Authenticated users can update invoice settings" ON invoice_settings;

-- =====================================================
-- INVOICES
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete invoices" ON invoices;
DROP POLICY IF EXISTS "Authenticated users can insert invoices" ON invoices;
DROP POLICY IF EXISTS "Authenticated users can update invoices" ON invoices;

-- =====================================================
-- JOB COMPLETION REMINDERS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete reminders" ON job_completion_reminders;
DROP POLICY IF EXISTS "Authenticated users can insert reminders" ON job_completion_reminders;
DROP POLICY IF EXISTS "Authenticated users can update reminders" ON job_completion_reminders;
DROP POLICY IF EXISTS "Authenticated users can view reminders" ON job_completion_reminders;

-- =====================================================
-- JOB COMPLETIONS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete job completions" ON job_completions;
DROP POLICY IF EXISTS "Authenticated users can insert job completions" ON job_completions;
DROP POLICY IF EXISTS "Authenticated users can update job completions" ON job_completions;

-- =====================================================
-- JOBS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete jobs" ON jobs;
DROP POLICY IF EXISTS "Authenticated users can insert jobs" ON jobs;
DROP POLICY IF EXISTS "Authenticated users can update jobs" ON jobs;
DROP POLICY IF EXISTS "Authenticated users can read all jobs" ON jobs;

-- =====================================================
-- MILEAGE RECORDS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can create mileage records" ON mileage_records;
DROP POLICY IF EXISTS "Authenticated users can delete mileage records" ON mileage_records;
DROP POLICY IF EXISTS "Authenticated users can update mileage records" ON mileage_records;

-- =====================================================
-- MILEAGE SETTINGS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can select mileage settings" ON mileage_settings;
DROP POLICY IF EXISTS "Authenticated users can insert mileage settings" ON mileage_settings;
DROP POLICY IF EXISTS "Authenticated users can update mileage settings" ON mileage_settings;
DROP POLICY IF EXISTS "Authenticated users can delete mileage settings" ON mileage_settings;

-- =====================================================
-- NOTIFICATION BAR
-- Remove duplicate public policy (keep "Public can view enabled notifications")
-- Remove overly broad authenticated policies (keep organization-based)
-- =====================================================

DROP POLICY IF EXISTS "Allow public read of enabled notifications and admin read of al" ON notification_bar;
DROP POLICY IF EXISTS "Authenticated users can delete own business notifications" ON notification_bar;
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON notification_bar;
DROP POLICY IF EXISTS "Authenticated users can update own business notifications" ON notification_bar;

-- =====================================================
-- PAYMENT METHODS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete payment methods" ON payment_methods;
DROP POLICY IF EXISTS "Authenticated users can insert payment methods" ON payment_methods;
DROP POLICY IF EXISTS "Authenticated users can update payment methods" ON payment_methods;

-- =====================================================
-- QR CODE SCHEDULES
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete schedules" ON qr_code_schedules;
DROP POLICY IF EXISTS "Authenticated users can insert schedules" ON qr_code_schedules;
DROP POLICY IF EXISTS "Authenticated users can update schedules" ON qr_code_schedules;
DROP POLICY IF EXISTS "Authenticated users can view schedules" ON qr_code_schedules;

-- =====================================================
-- QR CODES
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete QR codes" ON qr_codes;
DROP POLICY IF EXISTS "Authenticated users can insert QR codes" ON qr_codes;
DROP POLICY IF EXISTS "Authenticated users can update QR codes" ON qr_codes;
DROP POLICY IF EXISTS "Authenticated users can view QR codes" ON qr_codes;

-- =====================================================
-- QR SCANS
-- Remove duplicate anonymous policy (keep "Anyone can create qr scans")
-- Remove overly broad authenticated policies (keep organization-based)
-- =====================================================

DROP POLICY IF EXISTS "Anonymous users can insert scan records" ON qr_scans;
DROP POLICY IF EXISTS "Authenticated users can delete scans" ON qr_scans;
DROP POLICY IF EXISTS "Authenticated users can view all scans" ON qr_scans;

-- =====================================================
-- QUARTERLY TAX PAYMENTS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete quarterly payments" ON quarterly_tax_payments;
DROP POLICY IF EXISTS "Authenticated users can insert quarterly payments" ON quarterly_tax_payments;
DROP POLICY IF EXISTS "Authenticated users can update quarterly payments" ON quarterly_tax_payments;
DROP POLICY IF EXISTS "Authenticated users can view quarterly payments" ON quarterly_tax_payments;

-- =====================================================
-- REVENUE FORECASTS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete revenue forecasts" ON revenue_forecasts;
DROP POLICY IF EXISTS "Authenticated users can insert revenue forecasts" ON revenue_forecasts;
DROP POLICY IF EXISTS "Authenticated users can update revenue forecasts" ON revenue_forecasts;
DROP POLICY IF EXISTS "Authenticated users can read revenue forecasts" ON revenue_forecasts;

-- =====================================================
-- SAVED REQUESTS
-- Remove duplicate anonymous policy (keep "Anyone can create saved requests")
-- =====================================================

DROP POLICY IF EXISTS "Anonymous users can create saved requests" ON saved_requests;

-- =====================================================
-- SERVICE AREAS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete service areas" ON service_areas;
DROP POLICY IF EXISTS "Authenticated users can insert service areas" ON service_areas;
DROP POLICY IF EXISTS "Authenticated users can update service areas" ON service_areas;

-- =====================================================
-- SERVICES
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete services" ON services;
DROP POLICY IF EXISTS "Authenticated users can insert services" ON services;
DROP POLICY IF EXISTS "Authenticated users can update services" ON services;

-- =====================================================
-- SITE PAGES
-- Remove duplicate public policy (keep "Public can view active site pages")
-- =====================================================

DROP POLICY IF EXISTS "Users can view site pages" ON site_pages;
DROP POLICY IF EXISTS "Admins can delete site pages" ON site_pages;
DROP POLICY IF EXISTS "Admins can insert site pages" ON site_pages;
DROP POLICY IF EXISTS "Admins can update site pages" ON site_pages;

-- =====================================================
-- SOCIAL MEDIA
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete social media" ON social_media;
DROP POLICY IF EXISTS "Authenticated users can insert social media" ON social_media;
DROP POLICY IF EXISTS "Authenticated users can update social media" ON social_media;

-- =====================================================
-- TAX CALCULATIONS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete tax calculations" ON tax_calculations;
DROP POLICY IF EXISTS "Authenticated users can insert tax calculations" ON tax_calculations;
DROP POLICY IF EXISTS "Authenticated users can update tax calculations" ON tax_calculations;

-- =====================================================
-- TAX SETTINGS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete tax settings" ON tax_settings;
DROP POLICY IF EXISTS "Authenticated users can insert tax settings" ON tax_settings;
DROP POLICY IF EXISTS "Authenticated users can update tax settings" ON tax_settings;