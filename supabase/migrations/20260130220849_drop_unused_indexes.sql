/*
  # Drop Unused Foreign Key Indexes
  
  ## Summary
  This migration removes 26 unused indexes that were created for foreign key columns
  but are not being utilized by the database query planner. These indexes consume
  storage space and add overhead to write operations without providing query benefits.
  
  ## Indexes Removed
  All foreign key indexes created in migration 20260130205452 that have not been used:
  
  ### Business Tables
  - idx_business_address_business_id
  - idx_business_attributes_business_id
  - idx_business_expenses_business_id
  - idx_business_expenses_category_id
  
  ### Review & Forecast Tables
  - idx_customer_reviews_job_completion_id
  - idx_expense_categories_business_id
  - idx_forecast_accuracy_business_id
  
  ### Gallery & Invoice Tables
  - idx_gallery_items_business_id
  - idx_invoices_inquiry_id
  - idx_invoices_job_id
  
  ### Job Completion Tables
  - idx_job_completion_reminders_completed_by
  - idx_job_completion_reminders_created_by
  - idx_job_completion_reminders_job_completion_id
  - idx_job_completion_reminders_job_id
  - idx_job_completions_completed_by
  - idx_job_completions_job_id
  - idx_jobs_completion_id
  
  ### Mileage & Payment Tables
  - idx_mileage_records_business_id
  - idx_mileage_records_expense_id
  - idx_payment_methods_business_id
  
  ### Request & Service Tables
  - idx_saved_requests_business_id
  - idx_saved_requests_inquiry_id
  - idx_service_areas_business_id
  - idx_services_business_id
  
  ### Social & Tax Tables
  - idx_social_media_business_id
  - idx_tax_calculations_business_id
  
  ## Performance Impact
  - Reduces storage space consumption
  - Improves INSERT/UPDATE/DELETE performance by removing index maintenance overhead
  - No negative impact on query performance (indexes were unused)
  
  ## Note on RLS Policies
  The "RLS Policy Always True" warnings are intentional design decisions for this
  single-admin application. Security model:
  
  1. Authentication: Only authorized email addresses can sign up/sign in
  2. Authorization: Frontend checks user email against VITE_AUTHORIZED_ADMIN_EMAILS
  3. RLS: Authenticated users get full access; anonymous users can only submit forms
  
  This design is appropriate for single-business admin systems where:
  - There's one business owner/operator
  - All authenticated users are trusted admins
  - Real security boundary is at the authentication level (email whitelist)
  - Anonymous users can only submit public forms (inquiries, QR scans)
*/

-- Drop all unused foreign key indexes
DROP INDEX IF EXISTS idx_business_address_business_id;
DROP INDEX IF EXISTS idx_business_attributes_business_id;
DROP INDEX IF EXISTS idx_business_expenses_business_id;
DROP INDEX IF EXISTS idx_business_expenses_category_id;
DROP INDEX IF EXISTS idx_customer_reviews_job_completion_id;
DROP INDEX IF EXISTS idx_expense_categories_business_id;
DROP INDEX IF EXISTS idx_forecast_accuracy_business_id;
DROP INDEX IF EXISTS idx_gallery_items_business_id;
DROP INDEX IF EXISTS idx_invoices_inquiry_id;
DROP INDEX IF EXISTS idx_invoices_job_id;
DROP INDEX IF EXISTS idx_job_completion_reminders_completed_by;
DROP INDEX IF EXISTS idx_job_completion_reminders_created_by;
DROP INDEX IF EXISTS idx_job_completion_reminders_job_completion_id;
DROP INDEX IF EXISTS idx_job_completion_reminders_job_id;
DROP INDEX IF EXISTS idx_job_completions_completed_by;
DROP INDEX IF EXISTS idx_job_completions_job_id;
DROP INDEX IF EXISTS idx_jobs_completion_id;
DROP INDEX IF EXISTS idx_mileage_records_business_id;
DROP INDEX IF EXISTS idx_mileage_records_expense_id;
DROP INDEX IF EXISTS idx_payment_methods_business_id;
DROP INDEX IF EXISTS idx_saved_requests_business_id;
DROP INDEX IF EXISTS idx_saved_requests_inquiry_id;
DROP INDEX IF EXISTS idx_service_areas_business_id;
DROP INDEX IF EXISTS idx_services_business_id;
DROP INDEX IF EXISTS idx_social_media_business_id;
DROP INDEX IF EXISTS idx_tax_calculations_business_id;
