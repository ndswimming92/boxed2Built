/*
  # Add Organization Context to Remaining Tables (Part 2)

  ## Overview
  Continues adding organization_id to remaining tables: invoices, taxes, 
  expenses, mileage, QR codes, notifications, forecasting, goals, and audit logs.

  ## Tables Updated
  - invoices, invoice_line_items, invoice_payments, invoice_settings
  - tax_settings, tax_calculations, quarterly_tax_payments
  - business_expenses, expense_categories
  - mileage_records, mileage_settings
  - qr_codes, qr_code_schedules, qr_scans
  - notification_bar, site_pages
  - business_goals, revenue_forecasts, forecast_settings, forecast_accuracy
  - admin_audit_logs
*/

DO $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Get Boxed2Built organization ID
  SELECT id INTO v_org_id FROM organizations WHERE slug = 'boxed2built' LIMIT 1;

  -- Invoices
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'organization_id') THEN
    EXECUTE format('ALTER TABLE invoices ADD COLUMN organization_id uuid DEFAULT %L NOT NULL', v_org_id);
    ALTER TABLE invoices ALTER COLUMN organization_id DROP DEFAULT;
    ALTER TABLE invoices ADD CONSTRAINT invoices_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_invoices_organization_id ON invoices(organization_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoice_line_items' AND column_name = 'organization_id') THEN
    EXECUTE format('ALTER TABLE invoice_line_items ADD COLUMN organization_id uuid DEFAULT %L NOT NULL', v_org_id);
    ALTER TABLE invoice_line_items ALTER COLUMN organization_id DROP DEFAULT;
    ALTER TABLE invoice_line_items ADD CONSTRAINT invoice_line_items_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_invoice_line_items_organization_id ON invoice_line_items(organization_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoice_payments' AND column_name = 'organization_id') THEN
    EXECUTE format('ALTER TABLE invoice_payments ADD COLUMN organization_id uuid DEFAULT %L NOT NULL', v_org_id);
    ALTER TABLE invoice_payments ALTER COLUMN organization_id DROP DEFAULT;
    ALTER TABLE invoice_payments ADD CONSTRAINT invoice_payments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_invoice_payments_organization_id ON invoice_payments(organization_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoice_settings' AND column_name = 'organization_id') THEN
    EXECUTE format('ALTER TABLE invoice_settings ADD COLUMN organization_id uuid DEFAULT %L NOT NULL', v_org_id);
    ALTER TABLE invoice_settings ALTER COLUMN organization_id DROP DEFAULT;
    ALTER TABLE invoice_settings ADD CONSTRAINT invoice_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_invoice_settings_organization_id ON invoice_settings(organization_id);
  END IF;

  -- Tax
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tax_settings' AND column_name = 'organization_id') THEN
    EXECUTE format('ALTER TABLE tax_settings ADD COLUMN organization_id uuid DEFAULT %L NOT NULL', v_org_id);
    ALTER TABLE tax_settings ALTER COLUMN organization_id DROP DEFAULT;
    ALTER TABLE tax_settings ADD CONSTRAINT tax_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_tax_settings_organization_id ON tax_settings(organization_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tax_calculations' AND column_name = 'organization_id') THEN
    EXECUTE format('ALTER TABLE tax_calculations ADD COLUMN organization_id uuid DEFAULT %L NOT NULL', v_org_id);
    ALTER TABLE tax_calculations ALTER COLUMN organization_id DROP DEFAULT;
    ALTER TABLE tax_calculations ADD CONSTRAINT tax_calculations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_tax_calculations_organization_id ON tax_calculations(organization_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quarterly_tax_payments' AND column_name = 'organization_id') THEN
    EXECUTE format('ALTER TABLE quarterly_tax_payments ADD COLUMN organization_id uuid DEFAULT %L NOT NULL', v_org_id);
    ALTER TABLE quarterly_tax_payments ALTER COLUMN organization_id DROP DEFAULT;
    ALTER TABLE quarterly_tax_payments ADD CONSTRAINT quarterly_tax_payments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_quarterly_tax_payments_organization_id ON quarterly_tax_payments(organization_id);
  END IF;

  -- Expenses
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_expenses' AND column_name = 'organization_id') THEN
    EXECUTE format('ALTER TABLE business_expenses ADD COLUMN organization_id uuid DEFAULT %L NOT NULL', v_org_id);
    ALTER TABLE business_expenses ALTER COLUMN organization_id DROP DEFAULT;
    ALTER TABLE business_expenses ADD CONSTRAINT business_expenses_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_business_expenses_organization_id ON business_expenses(organization_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expense_categories' AND column_name = 'organization_id') THEN
    EXECUTE format('ALTER TABLE expense_categories ADD COLUMN organization_id uuid DEFAULT %L NOT NULL', v_org_id);
    ALTER TABLE expense_categories ALTER COLUMN organization_id DROP DEFAULT;
    ALTER TABLE expense_categories ADD CONSTRAINT expense_categories_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_expense_categories_organization_id ON expense_categories(organization_id);
  END IF;

  -- Mileage
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mileage_records' AND column_name = 'organization_id') THEN
    EXECUTE format('ALTER TABLE mileage_records ADD COLUMN organization_id uuid DEFAULT %L NOT NULL', v_org_id);
    ALTER TABLE mileage_records ALTER COLUMN organization_id DROP DEFAULT;
    ALTER TABLE mileage_records ADD CONSTRAINT mileage_records_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_mileage_records_organization_id ON mileage_records(organization_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mileage_settings' AND column_name = 'organization_id') THEN
    EXECUTE format('ALTER TABLE mileage_settings ADD COLUMN organization_id uuid DEFAULT %L NOT NULL', v_org_id);
    ALTER TABLE mileage_settings ALTER COLUMN organization_id DROP DEFAULT;
    ALTER TABLE mileage_settings ADD CONSTRAINT mileage_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_mileage_settings_organization_id ON mileage_settings(organization_id);
  END IF;

  -- QR Codes
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qr_codes' AND column_name = 'organization_id') THEN
    EXECUTE format('ALTER TABLE qr_codes ADD COLUMN organization_id uuid DEFAULT %L NOT NULL', v_org_id);
    ALTER TABLE qr_codes ALTER COLUMN organization_id DROP DEFAULT;
    ALTER TABLE qr_codes ADD CONSTRAINT qr_codes_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_qr_codes_organization_id ON qr_codes(organization_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qr_code_schedules' AND column_name = 'organization_id') THEN
    EXECUTE format('ALTER TABLE qr_code_schedules ADD COLUMN organization_id uuid DEFAULT %L NOT NULL', v_org_id);
    ALTER TABLE qr_code_schedules ALTER COLUMN organization_id DROP DEFAULT;
    ALTER TABLE qr_code_schedules ADD CONSTRAINT qr_code_schedules_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_qr_code_schedules_organization_id ON qr_code_schedules(organization_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qr_scans' AND column_name = 'organization_id') THEN
    EXECUTE format('ALTER TABLE qr_scans ADD COLUMN organization_id uuid DEFAULT %L NOT NULL', v_org_id);
    ALTER TABLE qr_scans ALTER COLUMN organization_id DROP DEFAULT;
    ALTER TABLE qr_scans ADD CONSTRAINT qr_scans_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_qr_scans_organization_id ON qr_scans(organization_id);
  END IF;

  -- Notification & Pages
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_bar' AND column_name = 'organization_id') THEN
    EXECUTE format('ALTER TABLE notification_bar ADD COLUMN organization_id uuid DEFAULT %L NOT NULL', v_org_id);
    ALTER TABLE notification_bar ALTER COLUMN organization_id DROP DEFAULT;
    ALTER TABLE notification_bar ADD CONSTRAINT notification_bar_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_notification_bar_organization_id ON notification_bar(organization_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_pages' AND column_name = 'organization_id') THEN
    EXECUTE format('ALTER TABLE site_pages ADD COLUMN organization_id uuid DEFAULT %L NOT NULL', v_org_id);
    ALTER TABLE site_pages ALTER COLUMN organization_id DROP DEFAULT;
    ALTER TABLE site_pages ADD CONSTRAINT site_pages_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_site_pages_organization_id ON site_pages(organization_id);
  END IF;

  -- Goals & Forecasting
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_goals' AND column_name = 'organization_id') THEN
    EXECUTE format('ALTER TABLE business_goals ADD COLUMN organization_id uuid DEFAULT %L NOT NULL', v_org_id);
    ALTER TABLE business_goals ALTER COLUMN organization_id DROP DEFAULT;
    ALTER TABLE business_goals ADD CONSTRAINT business_goals_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_business_goals_organization_id ON business_goals(organization_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenue_forecasts' AND column_name = 'organization_id') THEN
    EXECUTE format('ALTER TABLE revenue_forecasts ADD COLUMN organization_id uuid DEFAULT %L NOT NULL', v_org_id);
    ALTER TABLE revenue_forecasts ALTER COLUMN organization_id DROP DEFAULT;
    ALTER TABLE revenue_forecasts ADD CONSTRAINT revenue_forecasts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_revenue_forecasts_organization_id ON revenue_forecasts(organization_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'forecast_settings' AND column_name = 'organization_id') THEN
    EXECUTE format('ALTER TABLE forecast_settings ADD COLUMN organization_id uuid DEFAULT %L NOT NULL', v_org_id);
    ALTER TABLE forecast_settings ALTER COLUMN organization_id DROP DEFAULT;
    ALTER TABLE forecast_settings ADD CONSTRAINT forecast_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_forecast_settings_organization_id ON forecast_settings(organization_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'forecast_accuracy' AND column_name = 'organization_id') THEN
    EXECUTE format('ALTER TABLE forecast_accuracy ADD COLUMN organization_id uuid DEFAULT %L NOT NULL', v_org_id);
    ALTER TABLE forecast_accuracy ALTER COLUMN organization_id DROP DEFAULT;
    ALTER TABLE forecast_accuracy ADD CONSTRAINT forecast_accuracy_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_forecast_accuracy_organization_id ON forecast_accuracy(organization_id);
  END IF;

  -- Audit Logs
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_audit_logs' AND column_name = 'organization_id') THEN
    EXECUTE format('ALTER TABLE admin_audit_logs ADD COLUMN organization_id uuid DEFAULT %L NOT NULL', v_org_id);
    ALTER TABLE admin_audit_logs ALTER COLUMN organization_id DROP DEFAULT;
    ALTER TABLE admin_audit_logs ADD CONSTRAINT admin_audit_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_admin_audit_logs_organization_id ON admin_audit_logs(organization_id);
  END IF;

  RAISE NOTICE 'Part 2 complete: All remaining tables processed with organization_id';
END $$;
