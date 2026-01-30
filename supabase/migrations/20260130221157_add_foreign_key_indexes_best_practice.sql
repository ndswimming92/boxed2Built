/*
  # Add Foreign Key Indexes - Best Practice
  
  ## Summary
  This migration adds indexes on all foreign key columns as a database best practice.
  While these indexes may not be actively used by current query patterns, they provide:
  
  1. **JOIN Performance**: Optimizes queries when joining related tables
  2. **CASCADE Performance**: Speeds up ON DELETE CASCADE operations
  3. **Referential Integrity Checks**: Improves FK constraint validation
  4. **Future-Proofing**: Ready for when data volume increases
  
  ## Foreign Key Indexes Added
  
  ### Business Tables (7 indexes)
  - business_address.business_id → business_info.id
  - business_attributes.business_id → business_info.id
  - business_expenses.business_id → business_info.id
  - business_expenses.category_id → expense_categories.id
  - expense_categories.business_id → business_info.id
  - payment_methods.business_id → business_info.id
  - social_media.business_id → business_info.id
  
  ### Service & Area Tables (2 indexes)
  - service_areas.business_id → business_info.id
  - services.business_id → business_info.id
  
  ### Gallery & Review Tables (2 indexes)
  - gallery_items.business_id → business_info.id
  - customer_reviews.job_completion_id → job_completions.id
  
  ### Forecast Tables (1 index)
  - forecast_accuracy.business_id → business_info.id
  
  ### Invoice Tables (2 indexes)
  - invoices.inquiry_id → form_inquiries.id
  - invoices.job_id → jobs.id
  
  ### Job Tables (3 indexes)
  - jobs.completion_id → job_completions.id
  - job_completions.job_id → jobs.id
  - job_completions.completed_by → auth.users.id
  
  ### Job Reminder Tables (4 indexes)
  - job_completion_reminders.job_id → jobs.id
  - job_completion_reminders.job_completion_id → job_completions.id
  - job_completion_reminders.created_by → auth.users.id
  - job_completion_reminders.completed_by → auth.users.id
  
  ### Mileage Tables (2 indexes)
  - mileage_records.business_id → business_info.id
  - mileage_records.expense_id → business_expenses.id
  
  ### Saved Request Tables (2 indexes)
  - saved_requests.business_id → business_info.id
  - saved_requests.inquiry_id → form_inquiries.id
  
  ### Tax Tables (1 index)
  - tax_calculations.business_id → business_info.id
  
  ## Performance Impact
  - **Storage**: ~52KB per index (estimate), total ~1.3MB for 26 indexes
  - **Write Performance**: Minimal overhead for small tables
  - **Read Performance**: Significant improvement for JOIN operations
  - **Maintenance**: PostgreSQL auto-maintains indexes
  
  ## Note on RLS Policies
  The "RLS Policy Always True" warnings are intentional and documented in:
  - docs/SECURITY_ARCHITECTURE.md
  
  This is a single-admin application where:
  - Authentication is the primary security boundary (email whitelist)
  - All authenticated users are trusted administrators
  - RLS prevents anonymous users from accessing admin data
  - Public forms (inquiries, QR scans) intentionally allow anonymous INSERT
*/

-- Business table foreign key indexes
CREATE INDEX IF NOT EXISTS idx_business_address_business_id 
  ON public.business_address(business_id);

CREATE INDEX IF NOT EXISTS idx_business_attributes_business_id 
  ON public.business_attributes(business_id);

CREATE INDEX IF NOT EXISTS idx_business_expenses_business_id 
  ON public.business_expenses(business_id);

CREATE INDEX IF NOT EXISTS idx_business_expenses_category_id 
  ON public.business_expenses(category_id);

CREATE INDEX IF NOT EXISTS idx_expense_categories_business_id 
  ON public.expense_categories(business_id);

CREATE INDEX IF NOT EXISTS idx_payment_methods_business_id 
  ON public.payment_methods(business_id);

CREATE INDEX IF NOT EXISTS idx_social_media_business_id 
  ON public.social_media(business_id);

-- Service and area table foreign key indexes
CREATE INDEX IF NOT EXISTS idx_service_areas_business_id 
  ON public.service_areas(business_id);

CREATE INDEX IF NOT EXISTS idx_services_business_id 
  ON public.services(business_id);

-- Gallery and review table foreign key indexes
CREATE INDEX IF NOT EXISTS idx_gallery_items_business_id 
  ON public.gallery_items(business_id);

CREATE INDEX IF NOT EXISTS idx_customer_reviews_job_completion_id 
  ON public.customer_reviews(job_completion_id);

-- Forecast table foreign key indexes
CREATE INDEX IF NOT EXISTS idx_forecast_accuracy_business_id 
  ON public.forecast_accuracy(business_id);

-- Invoice table foreign key indexes
CREATE INDEX IF NOT EXISTS idx_invoices_inquiry_id 
  ON public.invoices(inquiry_id);

CREATE INDEX IF NOT EXISTS idx_invoices_job_id 
  ON public.invoices(job_id);

-- Job table foreign key indexes
CREATE INDEX IF NOT EXISTS idx_jobs_completion_id 
  ON public.jobs(completion_id);

CREATE INDEX IF NOT EXISTS idx_job_completions_job_id 
  ON public.job_completions(job_id);

CREATE INDEX IF NOT EXISTS idx_job_completions_completed_by 
  ON public.job_completions(completed_by);

-- Job reminder table foreign key indexes
CREATE INDEX IF NOT EXISTS idx_job_completion_reminders_job_id 
  ON public.job_completion_reminders(job_id);

CREATE INDEX IF NOT EXISTS idx_job_completion_reminders_job_completion_id 
  ON public.job_completion_reminders(job_completion_id);

CREATE INDEX IF NOT EXISTS idx_job_completion_reminders_created_by 
  ON public.job_completion_reminders(created_by);

CREATE INDEX IF NOT EXISTS idx_job_completion_reminders_completed_by 
  ON public.job_completion_reminders(completed_by);

-- Mileage table foreign key indexes
CREATE INDEX IF NOT EXISTS idx_mileage_records_business_id 
  ON public.mileage_records(business_id);

CREATE INDEX IF NOT EXISTS idx_mileage_records_expense_id 
  ON public.mileage_records(expense_id);

-- Saved request table foreign key indexes
CREATE INDEX IF NOT EXISTS idx_saved_requests_business_id 
  ON public.saved_requests(business_id);

CREATE INDEX IF NOT EXISTS idx_saved_requests_inquiry_id 
  ON public.saved_requests(inquiry_id);

-- Tax table foreign key indexes
CREATE INDEX IF NOT EXISTS idx_tax_calculations_business_id 
  ON public.tax_calculations(business_id);
