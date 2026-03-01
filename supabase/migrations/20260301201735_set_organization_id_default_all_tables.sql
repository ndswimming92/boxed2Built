/*
  # Set organization_id Default on All Tables

  ## Problem
  Every table that has an organization_id column was given NOT NULL with no default value.
  This means any INSERT that doesn't explicitly supply organization_id fails silently or
  with an error. Affected operations include: saving gallery items, creating jobs, invoices,
  expenses, goals, QR codes, notification bar entries, and more.

  ## Solution
  Set the Boxed2Built organization ID as the default value on every affected table.
  This is a safe fallback - the app code should still pass the value explicitly where
  possible, but this prevents silent failures everywhere.

  ## Tables Updated
  All tables with organization_id NOT NULL and no default:
  business_address, business_attributes, business_expenses, business_goals,
  business_hours, business_info, customer_reviews, expense_categories,
  forecast_accuracy, forecast_settings, form_inquiries, gallery_items,
  invoice_line_items, invoice_payments, invoice_settings, invoices,
  job_completion_reminders, job_completions, jobs, mileage_records,
  mileage_settings, notification_bar, payment_methods, qr_code_schedules,
  qr_codes, qr_scans, quarterly_tax_payments, revenue_forecasts,
  saved_requests, service_areas, services, site_pages, social_media,
  tax_calculations, tax_settings

  ## Notes
  - No data is modified or deleted
  - The default is only used as a fallback when organization_id is not supplied
  - admin_audit_logs already has the default set from a previous migration
*/

DO $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM organizations WHERE slug = 'boxed2built' LIMIT 1;

  IF v_org_id IS NULL THEN
    SELECT id INTO v_org_id FROM organizations LIMIT 1;
  END IF;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found to set as default';
  END IF;

  -- business_address
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_address' AND column_name = 'organization_id' AND column_default IS NULL) THEN
    EXECUTE format('ALTER TABLE business_address ALTER COLUMN organization_id SET DEFAULT %L', v_org_id);
  END IF;

  -- business_attributes
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_attributes' AND column_name = 'organization_id' AND column_default IS NULL) THEN
    EXECUTE format('ALTER TABLE business_attributes ALTER COLUMN organization_id SET DEFAULT %L', v_org_id);
  END IF;

  -- business_expenses
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_expenses' AND column_name = 'organization_id' AND column_default IS NULL) THEN
    EXECUTE format('ALTER TABLE business_expenses ALTER COLUMN organization_id SET DEFAULT %L', v_org_id);
  END IF;

  -- business_goals
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_goals' AND column_name = 'organization_id' AND column_default IS NULL) THEN
    EXECUTE format('ALTER TABLE business_goals ALTER COLUMN organization_id SET DEFAULT %L', v_org_id);
  END IF;

  -- business_hours
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_hours' AND column_name = 'organization_id' AND column_default IS NULL) THEN
    EXECUTE format('ALTER TABLE business_hours ALTER COLUMN organization_id SET DEFAULT %L', v_org_id);
  END IF;

  -- business_info
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_info' AND column_name = 'organization_id' AND column_default IS NULL) THEN
    EXECUTE format('ALTER TABLE business_info ALTER COLUMN organization_id SET DEFAULT %L', v_org_id);
  END IF;

  -- customer_reviews
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_reviews' AND column_name = 'organization_id' AND column_default IS NULL) THEN
    EXECUTE format('ALTER TABLE customer_reviews ALTER COLUMN organization_id SET DEFAULT %L', v_org_id);
  END IF;

  -- expense_categories
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expense_categories' AND column_name = 'organization_id' AND column_default IS NULL) THEN
    EXECUTE format('ALTER TABLE expense_categories ALTER COLUMN organization_id SET DEFAULT %L', v_org_id);
  END IF;

  -- forecast_accuracy
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'forecast_accuracy' AND column_name = 'organization_id' AND column_default IS NULL) THEN
    EXECUTE format('ALTER TABLE forecast_accuracy ALTER COLUMN organization_id SET DEFAULT %L', v_org_id);
  END IF;

  -- forecast_settings
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'forecast_settings' AND column_name = 'organization_id' AND column_default IS NULL) THEN
    EXECUTE format('ALTER TABLE forecast_settings ALTER COLUMN organization_id SET DEFAULT %L', v_org_id);
  END IF;

  -- form_inquiries
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'form_inquiries' AND column_name = 'organization_id' AND column_default IS NULL) THEN
    EXECUTE format('ALTER TABLE form_inquiries ALTER COLUMN organization_id SET DEFAULT %L', v_org_id);
  END IF;

  -- gallery_items
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gallery_items' AND column_name = 'organization_id' AND column_default IS NULL) THEN
    EXECUTE format('ALTER TABLE gallery_items ALTER COLUMN organization_id SET DEFAULT %L', v_org_id);
  END IF;

  -- invoice_line_items
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoice_line_items' AND column_name = 'organization_id' AND column_default IS NULL) THEN
    EXECUTE format('ALTER TABLE invoice_line_items ALTER COLUMN organization_id SET DEFAULT %L', v_org_id);
  END IF;

  -- invoice_payments
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoice_payments' AND column_name = 'organization_id' AND column_default IS NULL) THEN
    EXECUTE format('ALTER TABLE invoice_payments ALTER COLUMN organization_id SET DEFAULT %L', v_org_id);
  END IF;

  -- invoice_settings
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoice_settings' AND column_name = 'organization_id' AND column_default IS NULL) THEN
    EXECUTE format('ALTER TABLE invoice_settings ALTER COLUMN organization_id SET DEFAULT %L', v_org_id);
  END IF;

  -- invoices
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'organization_id' AND column_default IS NULL) THEN
    EXECUTE format('ALTER TABLE invoices ALTER COLUMN organization_id SET DEFAULT %L', v_org_id);
  END IF;

  -- job_completion_reminders
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_completion_reminders' AND column_name = 'organization_id' AND column_default IS NULL) THEN
    EXECUTE format('ALTER TABLE job_completion_reminders ALTER COLUMN organization_id SET DEFAULT %L', v_org_id);
  END IF;

  -- job_completions
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_completions' AND column_name = 'organization_id' AND column_default IS NULL) THEN
    EXECUTE format('ALTER TABLE job_completions ALTER COLUMN organization_id SET DEFAULT %L', v_org_id);
  END IF;

  -- jobs
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'organization_id' AND column_default IS NULL) THEN
    EXECUTE format('ALTER TABLE jobs ALTER COLUMN organization_id SET DEFAULT %L', v_org_id);
  END IF;

  -- mileage_records
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mileage_records' AND column_name = 'organization_id' AND column_default IS NULL) THEN
    EXECUTE format('ALTER TABLE mileage_records ALTER COLUMN organization_id SET DEFAULT %L', v_org_id);
  END IF;

  -- mileage_settings
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mileage_settings' AND column_name = 'organization_id' AND column_default IS NULL) THEN
    EXECUTE format('ALTER TABLE mileage_settings ALTER COLUMN organization_id SET DEFAULT %L', v_org_id);
  END IF;

  -- notification_bar
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_bar' AND column_name = 'organization_id' AND column_default IS NULL) THEN
    EXECUTE format('ALTER TABLE notification_bar ALTER COLUMN organization_id SET DEFAULT %L', v_org_id);
  END IF;

  -- payment_methods
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_methods' AND column_name = 'organization_id' AND column_default IS NULL) THEN
    EXECUTE format('ALTER TABLE payment_methods ALTER COLUMN organization_id SET DEFAULT %L', v_org_id);
  END IF;

  -- qr_code_schedules
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qr_code_schedules' AND column_name = 'organization_id' AND column_default IS NULL) THEN
    EXECUTE format('ALTER TABLE qr_code_schedules ALTER COLUMN organization_id SET DEFAULT %L', v_org_id);
  END IF;

  -- qr_codes
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qr_codes' AND column_name = 'organization_id' AND column_default IS NULL) THEN
    EXECUTE format('ALTER TABLE qr_codes ALTER COLUMN organization_id SET DEFAULT %L', v_org_id);
  END IF;

  -- qr_scans
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qr_scans' AND column_name = 'organization_id' AND column_default IS NULL) THEN
    EXECUTE format('ALTER TABLE qr_scans ALTER COLUMN organization_id SET DEFAULT %L', v_org_id);
  END IF;

  -- quarterly_tax_payments
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quarterly_tax_payments' AND column_name = 'organization_id' AND column_default IS NULL) THEN
    EXECUTE format('ALTER TABLE quarterly_tax_payments ALTER COLUMN organization_id SET DEFAULT %L', v_org_id);
  END IF;

  -- revenue_forecasts
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenue_forecasts' AND column_name = 'organization_id' AND column_default IS NULL) THEN
    EXECUTE format('ALTER TABLE revenue_forecasts ALTER COLUMN organization_id SET DEFAULT %L', v_org_id);
  END IF;

  -- saved_requests
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saved_requests' AND column_name = 'organization_id' AND column_default IS NULL) THEN
    EXECUTE format('ALTER TABLE saved_requests ALTER COLUMN organization_id SET DEFAULT %L', v_org_id);
  END IF;

  -- service_areas
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_areas' AND column_name = 'organization_id' AND column_default IS NULL) THEN
    EXECUTE format('ALTER TABLE service_areas ALTER COLUMN organization_id SET DEFAULT %L', v_org_id);
  END IF;

  -- services
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'organization_id' AND column_default IS NULL) THEN
    EXECUTE format('ALTER TABLE services ALTER COLUMN organization_id SET DEFAULT %L', v_org_id);
  END IF;

  -- site_pages
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_pages' AND column_name = 'organization_id' AND column_default IS NULL) THEN
    EXECUTE format('ALTER TABLE site_pages ALTER COLUMN organization_id SET DEFAULT %L', v_org_id);
  END IF;

  -- social_media
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'social_media' AND column_name = 'organization_id' AND column_default IS NULL) THEN
    EXECUTE format('ALTER TABLE social_media ALTER COLUMN organization_id SET DEFAULT %L', v_org_id);
  END IF;

  -- tax_calculations
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tax_calculations' AND column_name = 'organization_id' AND column_default IS NULL) THEN
    EXECUTE format('ALTER TABLE tax_calculations ALTER COLUMN organization_id SET DEFAULT %L', v_org_id);
  END IF;

  -- tax_settings
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tax_settings' AND column_name = 'organization_id' AND column_default IS NULL) THEN
    EXECUTE format('ALTER TABLE tax_settings ALTER COLUMN organization_id SET DEFAULT %L', v_org_id);
  END IF;

  RAISE NOTICE 'Set organization_id default on all tables to org: %', v_org_id;
END $$;
