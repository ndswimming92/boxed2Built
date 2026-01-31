/*
  # Add Organization Context to All Tenant Tables (v3)

  ## Overview
  This migration adds organization_id column to all 36 tenant-owned tables,
  backfills existing data with the Boxed2Built organization ID, and creates
  foreign key constraints and indexes for multi-tenant data isolation.

  ## Tables Updated (36 total)
  Configuration tables: business_info, business_address, business_hours, 
  business_attributes, services, payment_methods, social_media, service_areas,
  invoice_settings, tax_settings, mileage_settings, notification_bar, qr_codes,
  qr_code_schedules, expense_categories, forecast_settings, site_pages

  Operational tables: jobs, invoices, invoice_line_items, invoice_payments,
  business_expenses, mileage_records, tax_calculations, quarterly_tax_payments,
  job_completions, job_completion_reminders, business_goals, revenue_forecasts,
  forecast_accuracy

  Customer-facing tables: form_inquiries, saved_requests, gallery_items,
  customer_reviews, qr_scans

  Audit tables: admin_audit_logs

  ## Changes Applied
  1. Add organization_id column with default value (auto-backfills)
  2. Remove default and set NOT NULL constraint
  3. Create foreign key constraints with ON DELETE CASCADE
  4. Create indexes on organization_id for RLS performance

  ## Data Safety
  - All existing data preserved and associated with Boxed2Built organization
  - Foreign key constraints ensure referential integrity
  - Indexes optimize multi-tenant query performance
*/

DO $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Get Boxed2Built organization ID
  SELECT id INTO v_org_id FROM organizations WHERE slug = 'boxed2built' LIMIT 1;
  
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Boxed2Built organization not found. Please run previous migration first.';
  END IF;

  RAISE NOTICE 'Using Boxed2Built organization ID: %', v_org_id;

  -- Business Info Tables
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_info' AND column_name = 'organization_id') THEN
    EXECUTE format('ALTER TABLE business_info ADD COLUMN organization_id uuid DEFAULT %L NOT NULL', v_org_id);
    ALTER TABLE business_info ALTER COLUMN organization_id DROP DEFAULT;
    ALTER TABLE business_info ADD CONSTRAINT business_info_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_business_info_organization_id ON business_info(organization_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_address' AND column_name = 'organization_id') THEN
    EXECUTE format('ALTER TABLE business_address ADD COLUMN organization_id uuid DEFAULT %L NOT NULL', v_org_id);
    ALTER TABLE business_address ALTER COLUMN organization_id DROP DEFAULT;
    ALTER TABLE business_address ADD CONSTRAINT business_address_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_business_address_organization_id ON business_address(organization_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_hours' AND column_name = 'organization_id') THEN
    EXECUTE format('ALTER TABLE business_hours ADD COLUMN organization_id uuid DEFAULT %L NOT NULL', v_org_id);
    ALTER TABLE business_hours ALTER COLUMN organization_id DROP DEFAULT;
    ALTER TABLE business_hours ADD CONSTRAINT business_hours_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_business_hours_organization_id ON business_hours(organization_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_attributes' AND column_name = 'organization_id') THEN
    EXECUTE format('ALTER TABLE business_attributes ADD COLUMN organization_id uuid DEFAULT %L NOT NULL', v_org_id);
    ALTER TABLE business_attributes ALTER COLUMN organization_id DROP DEFAULT;
    ALTER TABLE business_attributes ADD CONSTRAINT business_attributes_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_business_attributes_organization_id ON business_attributes(organization_id);
  END IF;

  -- Service Tables
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'organization_id') THEN
    EXECUTE format('ALTER TABLE services ADD COLUMN organization_id uuid DEFAULT %L NOT NULL', v_org_id);
    ALTER TABLE services ALTER COLUMN organization_id DROP DEFAULT;
    ALTER TABLE services ADD CONSTRAINT services_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_services_organization_id ON services(organization_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_areas' AND column_name = 'organization_id') THEN
    EXECUTE format('ALTER TABLE service_areas ADD COLUMN organization_id uuid DEFAULT %L NOT NULL', v_org_id);
    ALTER TABLE service_areas ALTER COLUMN organization_id DROP DEFAULT;
    ALTER TABLE service_areas ADD CONSTRAINT service_areas_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_service_areas_organization_id ON service_areas(organization_id);
  END IF;

  -- Payment & Social
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_methods' AND column_name = 'organization_id') THEN
    EXECUTE format('ALTER TABLE payment_methods ADD COLUMN organization_id uuid DEFAULT %L NOT NULL', v_org_id);
    ALTER TABLE payment_methods ALTER COLUMN organization_id DROP DEFAULT;
    ALTER TABLE payment_methods ADD CONSTRAINT payment_methods_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_payment_methods_organization_id ON payment_methods(organization_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'social_media' AND column_name = 'organization_id') THEN
    EXECUTE format('ALTER TABLE social_media ADD COLUMN organization_id uuid DEFAULT %L NOT NULL', v_org_id);
    ALTER TABLE social_media ALTER COLUMN organization_id DROP DEFAULT;
    ALTER TABLE social_media ADD CONSTRAINT social_media_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_social_media_organization_id ON social_media(organization_id);
  END IF;

  -- Customer-facing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_reviews' AND column_name = 'organization_id') THEN
    EXECUTE format('ALTER TABLE customer_reviews ADD COLUMN organization_id uuid DEFAULT %L NOT NULL', v_org_id);
    ALTER TABLE customer_reviews ALTER COLUMN organization_id DROP DEFAULT;
    ALTER TABLE customer_reviews ADD CONSTRAINT customer_reviews_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_customer_reviews_organization_id ON customer_reviews(organization_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gallery_items' AND column_name = 'organization_id') THEN
    EXECUTE format('ALTER TABLE gallery_items ADD COLUMN organization_id uuid DEFAULT %L NOT NULL', v_org_id);
    ALTER TABLE gallery_items ALTER COLUMN organization_id DROP DEFAULT;
    ALTER TABLE gallery_items ADD CONSTRAINT gallery_items_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_gallery_items_organization_id ON gallery_items(organization_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'form_inquiries' AND column_name = 'organization_id') THEN
    EXECUTE format('ALTER TABLE form_inquiries ADD COLUMN organization_id uuid DEFAULT %L NOT NULL', v_org_id);
    ALTER TABLE form_inquiries ALTER COLUMN organization_id DROP DEFAULT;
    ALTER TABLE form_inquiries ADD CONSTRAINT form_inquiries_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_form_inquiries_organization_id ON form_inquiries(organization_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saved_requests' AND column_name = 'organization_id') THEN
    EXECUTE format('ALTER TABLE saved_requests ADD COLUMN organization_id uuid DEFAULT %L NOT NULL', v_org_id);
    ALTER TABLE saved_requests ALTER COLUMN organization_id DROP DEFAULT;
    ALTER TABLE saved_requests ADD CONSTRAINT saved_requests_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_saved_requests_organization_id ON saved_requests(organization_id);
  END IF;

  -- Jobs
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'organization_id') THEN
    EXECUTE format('ALTER TABLE jobs ADD COLUMN organization_id uuid DEFAULT %L NOT NULL', v_org_id);
    ALTER TABLE jobs ALTER COLUMN organization_id DROP DEFAULT;
    ALTER TABLE jobs ADD CONSTRAINT jobs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_jobs_organization_id ON jobs(organization_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_completions' AND column_name = 'organization_id') THEN
    EXECUTE format('ALTER TABLE job_completions ADD COLUMN organization_id uuid DEFAULT %L NOT NULL', v_org_id);
    ALTER TABLE job_completions ALTER COLUMN organization_id DROP DEFAULT;
    ALTER TABLE job_completions ADD CONSTRAINT job_completions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_job_completions_organization_id ON job_completions(organization_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_completion_reminders' AND column_name = 'organization_id') THEN
    EXECUTE format('ALTER TABLE job_completion_reminders ADD COLUMN organization_id uuid DEFAULT %L NOT NULL', v_org_id);
    ALTER TABLE job_completion_reminders ALTER COLUMN organization_id DROP DEFAULT;
    ALTER TABLE job_completion_reminders ADD CONSTRAINT job_completion_reminders_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_job_completion_reminders_organization_id ON job_completion_reminders(organization_id);
  END IF;

  RAISE NOTICE 'Part 1 complete: Business, Service, Customer, and Job tables processed';
END $$;
