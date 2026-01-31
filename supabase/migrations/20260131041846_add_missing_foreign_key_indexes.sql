/*
  # Add Missing Foreign Key Indexes

  This migration adds covering indexes for all foreign key columns to improve query performance.
  
  ## New Indexes
  
  ### Performance Improvements
  - Adds indexes on all foreign key columns that were missing them
  - Improves JOIN performance across related tables
  - Reduces query execution time for common operations
  
  ## Tables Affected
  - business_address
  - business_attributes
  - business_expenses
  - customer_reviews
  - expense_categories
  - forecast_accuracy
  - gallery_items
  - invoices
  - job_completion_reminders
  - job_completions
  - jobs
  - mileage_records
  - payment_methods
  - saved_requests
  - service_areas
  - services
  - social_media
  - tax_calculations
*/

-- business_address
CREATE INDEX IF NOT EXISTS idx_business_address_business_id 
  ON business_address(business_id);

-- business_attributes
CREATE INDEX IF NOT EXISTS idx_business_attributes_business_id 
  ON business_attributes(business_id);

-- business_expenses
CREATE INDEX IF NOT EXISTS idx_business_expenses_business_id 
  ON business_expenses(business_id);

CREATE INDEX IF NOT EXISTS idx_business_expenses_category_id 
  ON business_expenses(category_id);

-- customer_reviews
CREATE INDEX IF NOT EXISTS idx_customer_reviews_job_completion_id 
  ON customer_reviews(job_completion_id);

-- expense_categories
CREATE INDEX IF NOT EXISTS idx_expense_categories_business_id 
  ON expense_categories(business_id);

-- forecast_accuracy
CREATE INDEX IF NOT EXISTS idx_forecast_accuracy_business_id 
  ON forecast_accuracy(business_id);

-- gallery_items
CREATE INDEX IF NOT EXISTS idx_gallery_items_business_id 
  ON gallery_items(business_id);

-- invoices
CREATE INDEX IF NOT EXISTS idx_invoices_inquiry_id 
  ON invoices(inquiry_id);

CREATE INDEX IF NOT EXISTS idx_invoices_job_id 
  ON invoices(job_id);

-- job_completion_reminders
CREATE INDEX IF NOT EXISTS idx_job_completion_reminders_completed_by 
  ON job_completion_reminders(completed_by);

CREATE INDEX IF NOT EXISTS idx_job_completion_reminders_created_by 
  ON job_completion_reminders(created_by);

CREATE INDEX IF NOT EXISTS idx_job_completion_reminders_job_completion_id 
  ON job_completion_reminders(job_completion_id);

CREATE INDEX IF NOT EXISTS idx_job_completion_reminders_job_id 
  ON job_completion_reminders(job_id);

-- job_completions
CREATE INDEX IF NOT EXISTS idx_job_completions_completed_by 
  ON job_completions(completed_by);

CREATE INDEX IF NOT EXISTS idx_job_completions_job_id 
  ON job_completions(job_id);

-- jobs
CREATE INDEX IF NOT EXISTS idx_jobs_completion_id 
  ON jobs(completion_id);

-- mileage_records
CREATE INDEX IF NOT EXISTS idx_mileage_records_business_id 
  ON mileage_records(business_id);

CREATE INDEX IF NOT EXISTS idx_mileage_records_expense_id 
  ON mileage_records(expense_id);

-- payment_methods
CREATE INDEX IF NOT EXISTS idx_payment_methods_business_id 
  ON payment_methods(business_id);

-- saved_requests
CREATE INDEX IF NOT EXISTS idx_saved_requests_business_id 
  ON saved_requests(business_id);

CREATE INDEX IF NOT EXISTS idx_saved_requests_inquiry_id 
  ON saved_requests(inquiry_id);

-- service_areas
CREATE INDEX IF NOT EXISTS idx_service_areas_business_id 
  ON service_areas(business_id);

-- services
CREATE INDEX IF NOT EXISTS idx_services_business_id 
  ON services(business_id);

-- social_media
CREATE INDEX IF NOT EXISTS idx_social_media_business_id 
  ON social_media(business_id);

-- tax_calculations
CREATE INDEX IF NOT EXISTS idx_tax_calculations_business_id 
  ON tax_calculations(business_id);