/*
  # Add Missing Foreign Key Indexes

  ## Summary
  Adds covering indexes for all unindexed foreign key columns across multiple tables.
  This resolves performance warnings where foreign key constraints exist without
  corresponding indexes, which can cause slow lookups during joins and cascades.

  ## Tables Affected
  - business_address (business_id, organization_id)
  - business_attributes (business_id, organization_id)
  - business_expenses (category_id, organization_id)
  - business_goals (organization_id)
  - business_hours (organization_id)
  - business_info (organization_id)
  - client_notes (organization_id)
  - customer_reviews (job_completion_id, organization_id)
  - expense_categories (business_id, organization_id)
  - forecast_accuracy (business_id, organization_id)
  - forecast_settings (organization_id)
  - form_inquiries (organization_id)
  - gallery_items (business_id, organization_id)
  - invoice_line_items (organization_id)
  - invoice_payments (organization_id)
  - invoice_settings (organization_id)
  - invoices (organization_id)
  - job_completion_reminders (completed_by, created_by, job_completion_id, job_id, organization_id)
  - job_completions (completed_by, job_id, organization_id)
  - jobs (completion_id, organization_id)
  - mileage_records (business_id, expense_id, organization_id)
  - mileage_settings (organization_id)
  - notification_bar (organization_id)
  - payment_methods (business_id, organization_id)
  - qr_code_schedules (organization_id)
  - qr_codes (organization_id)
  - qr_scans (organization_id)
  - quarterly_tax_payments (organization_id)
  - saved_requests (business_id, organization_id)
  - service_areas (business_id, organization_id)
  - services (business_id, organization_id)
  - site_pages (organization_id)
  - social_media (business_id, organization_id)
  - tax_calculations (business_id, organization_id)
  - tax_settings (organization_id)
*/

CREATE INDEX IF NOT EXISTS idx_business_address_business_id ON public.business_address(business_id);
CREATE INDEX IF NOT EXISTS idx_business_address_organization_id ON public.business_address(organization_id);

CREATE INDEX IF NOT EXISTS idx_business_attributes_business_id ON public.business_attributes(business_id);
CREATE INDEX IF NOT EXISTS idx_business_attributes_organization_id ON public.business_attributes(organization_id);

CREATE INDEX IF NOT EXISTS idx_business_expenses_category_id ON public.business_expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_business_expenses_organization_id ON public.business_expenses(organization_id);

CREATE INDEX IF NOT EXISTS idx_business_goals_organization_id ON public.business_goals(organization_id);

CREATE INDEX IF NOT EXISTS idx_business_hours_organization_id ON public.business_hours(organization_id);

CREATE INDEX IF NOT EXISTS idx_business_info_organization_id ON public.business_info(organization_id);

CREATE INDEX IF NOT EXISTS idx_client_notes_organization_id ON public.client_notes(organization_id);

CREATE INDEX IF NOT EXISTS idx_customer_reviews_job_completion_id ON public.customer_reviews(job_completion_id);
CREATE INDEX IF NOT EXISTS idx_customer_reviews_organization_id ON public.customer_reviews(organization_id);

CREATE INDEX IF NOT EXISTS idx_expense_categories_business_id ON public.expense_categories(business_id);
CREATE INDEX IF NOT EXISTS idx_expense_categories_organization_id ON public.expense_categories(organization_id);

CREATE INDEX IF NOT EXISTS idx_forecast_accuracy_business_id ON public.forecast_accuracy(business_id);
CREATE INDEX IF NOT EXISTS idx_forecast_accuracy_organization_id ON public.forecast_accuracy(organization_id);

CREATE INDEX IF NOT EXISTS idx_forecast_settings_organization_id ON public.forecast_settings(organization_id);

CREATE INDEX IF NOT EXISTS idx_form_inquiries_organization_id ON public.form_inquiries(organization_id);

CREATE INDEX IF NOT EXISTS idx_gallery_items_business_id ON public.gallery_items(business_id);
CREATE INDEX IF NOT EXISTS idx_gallery_items_organization_id ON public.gallery_items(organization_id);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_organization_id ON public.invoice_line_items(organization_id);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_organization_id ON public.invoice_payments(organization_id);

CREATE INDEX IF NOT EXISTS idx_invoice_settings_organization_id ON public.invoice_settings(organization_id);

CREATE INDEX IF NOT EXISTS idx_invoices_organization_id ON public.invoices(organization_id);

CREATE INDEX IF NOT EXISTS idx_job_completion_reminders_completed_by ON public.job_completion_reminders(completed_by);
CREATE INDEX IF NOT EXISTS idx_job_completion_reminders_created_by ON public.job_completion_reminders(created_by);
CREATE INDEX IF NOT EXISTS idx_job_completion_reminders_job_completion_id ON public.job_completion_reminders(job_completion_id);
CREATE INDEX IF NOT EXISTS idx_job_completion_reminders_job_id ON public.job_completion_reminders(job_id);
CREATE INDEX IF NOT EXISTS idx_job_completion_reminders_organization_id ON public.job_completion_reminders(organization_id);

CREATE INDEX IF NOT EXISTS idx_job_completions_completed_by ON public.job_completions(completed_by);
CREATE INDEX IF NOT EXISTS idx_job_completions_job_id ON public.job_completions(job_id);
CREATE INDEX IF NOT EXISTS idx_job_completions_organization_id ON public.job_completions(organization_id);

CREATE INDEX IF NOT EXISTS idx_jobs_completion_id ON public.jobs(completion_id);
CREATE INDEX IF NOT EXISTS idx_jobs_organization_id ON public.jobs(organization_id);

CREATE INDEX IF NOT EXISTS idx_mileage_records_business_id ON public.mileage_records(business_id);
CREATE INDEX IF NOT EXISTS idx_mileage_records_expense_id ON public.mileage_records(expense_id);
CREATE INDEX IF NOT EXISTS idx_mileage_records_organization_id ON public.mileage_records(organization_id);

CREATE INDEX IF NOT EXISTS idx_mileage_settings_organization_id ON public.mileage_settings(organization_id);

CREATE INDEX IF NOT EXISTS idx_notification_bar_organization_id ON public.notification_bar(organization_id);

CREATE INDEX IF NOT EXISTS idx_payment_methods_business_id ON public.payment_methods(business_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_organization_id ON public.payment_methods(organization_id);

CREATE INDEX IF NOT EXISTS idx_qr_code_schedules_organization_id ON public.qr_code_schedules(organization_id);

CREATE INDEX IF NOT EXISTS idx_qr_codes_organization_id ON public.qr_codes(organization_id);

CREATE INDEX IF NOT EXISTS idx_qr_scans_organization_id ON public.qr_scans(organization_id);

CREATE INDEX IF NOT EXISTS idx_quarterly_tax_payments_organization_id ON public.quarterly_tax_payments(organization_id);

CREATE INDEX IF NOT EXISTS idx_saved_requests_business_id ON public.saved_requests(business_id);
CREATE INDEX IF NOT EXISTS idx_saved_requests_organization_id ON public.saved_requests(organization_id);

CREATE INDEX IF NOT EXISTS idx_service_areas_business_id ON public.service_areas(business_id);
CREATE INDEX IF NOT EXISTS idx_service_areas_organization_id ON public.service_areas(organization_id);

CREATE INDEX IF NOT EXISTS idx_services_business_id ON public.services(business_id);
CREATE INDEX IF NOT EXISTS idx_services_organization_id ON public.services(organization_id);

CREATE INDEX IF NOT EXISTS idx_site_pages_organization_id ON public.site_pages(organization_id);

CREATE INDEX IF NOT EXISTS idx_social_media_business_id ON public.social_media(business_id);
CREATE INDEX IF NOT EXISTS idx_social_media_organization_id ON public.social_media(organization_id);

CREATE INDEX IF NOT EXISTS idx_tax_calculations_business_id ON public.tax_calculations(business_id);
CREATE INDEX IF NOT EXISTS idx_tax_calculations_organization_id ON public.tax_calculations(organization_id);

CREATE INDEX IF NOT EXISTS idx_tax_settings_organization_id ON public.tax_settings(organization_id);
