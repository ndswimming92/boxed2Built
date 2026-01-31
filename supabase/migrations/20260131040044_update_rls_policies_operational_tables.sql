/*
  # Update RLS Policies for Operational Tables (Part 3)

  ## Overview
  Updates RLS policies for operational data tables. Members can create and
  manage operational data, admins can do more, and owners have full access.

  ## Tables Updated
  - jobs, job_completions, job_completion_reminders
  - invoices, invoice_line_items, invoice_payments
  - business_expenses, mileage_records
  - tax_calculations, quarterly_tax_payments
  - business_goals, revenue_forecasts, forecast_accuracy

  ## Permission Matrix
  - Platform Admin: Full access
  - Owner/Admin: Full access
  - Member: Can create/edit operational data
  - Viewer: Read-only access
*/

-- jobs
DROP POLICY IF EXISTS "Authenticated users can view jobs" ON jobs;
DROP POLICY IF EXISTS "Authenticated users can manage jobs" ON jobs;

CREATE POLICY "Platform admins have full access to jobs"
  ON jobs FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "Organization members can view their jobs"
  ON jobs FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

CREATE POLICY "Organization members can manage jobs"
  ON jobs FOR ALL
  TO authenticated
  USING (has_org_permission(organization_id, 'member'))
  WITH CHECK (has_org_permission(organization_id, 'member'));

-- job_completions
DROP POLICY IF EXISTS "Authenticated users can view job completions" ON job_completions;
DROP POLICY IF EXISTS "Authenticated users can manage job completions" ON job_completions;

CREATE POLICY "Platform admins have full access to job_completions"
  ON job_completions FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "Organization members can view their job completions"
  ON job_completions FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

CREATE POLICY "Organization members can manage job completions"
  ON job_completions FOR ALL
  TO authenticated
  USING (has_org_permission(organization_id, 'member'))
  WITH CHECK (has_org_permission(organization_id, 'member'));

-- job_completion_reminders
DROP POLICY IF EXISTS "Authenticated users can view job completion reminders" ON job_completion_reminders;
DROP POLICY IF EXISTS "Authenticated users can manage job completion reminders" ON job_completion_reminders;

CREATE POLICY "Platform admins have full access to job_completion_reminders"
  ON job_completion_reminders FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "Organization members can view their job completion reminders"
  ON job_completion_reminders FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

CREATE POLICY "Organization members can manage job completion reminders"
  ON job_completion_reminders FOR ALL
  TO authenticated
  USING (has_org_permission(organization_id, 'member'))
  WITH CHECK (has_org_permission(organization_id, 'member'));

-- invoices
DROP POLICY IF EXISTS "Authenticated users can view invoices" ON invoices;
DROP POLICY IF EXISTS "Authenticated users can manage invoices" ON invoices;

CREATE POLICY "Platform admins have full access to invoices"
  ON invoices FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "Organization members can view their invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

CREATE POLICY "Organization members can manage invoices"
  ON invoices FOR ALL
  TO authenticated
  USING (has_org_permission(organization_id, 'member'))
  WITH CHECK (has_org_permission(organization_id, 'member'));

-- invoice_line_items
DROP POLICY IF EXISTS "Authenticated users can view invoice line items" ON invoice_line_items;
DROP POLICY IF EXISTS "Authenticated users can manage invoice line items" ON invoice_line_items;

CREATE POLICY "Platform admins have full access to invoice_line_items"
  ON invoice_line_items FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "Organization members can view their invoice line items"
  ON invoice_line_items FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

CREATE POLICY "Organization members can manage invoice line items"
  ON invoice_line_items FOR ALL
  TO authenticated
  USING (has_org_permission(organization_id, 'member'))
  WITH CHECK (has_org_permission(organization_id, 'member'));

-- invoice_payments
DROP POLICY IF EXISTS "Authenticated users can view invoice payments" ON invoice_payments;
DROP POLICY IF EXISTS "Authenticated users can manage invoice payments" ON invoice_payments;

CREATE POLICY "Platform admins have full access to invoice_payments"
  ON invoice_payments FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "Organization members can view their invoice payments"
  ON invoice_payments FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

CREATE POLICY "Organization members can manage invoice payments"
  ON invoice_payments FOR ALL
  TO authenticated
  USING (has_org_permission(organization_id, 'member'))
  WITH CHECK (has_org_permission(organization_id, 'member'));

-- business_expenses
DROP POLICY IF EXISTS "Authenticated users can view business expenses" ON business_expenses;
DROP POLICY IF EXISTS "Authenticated users can manage business expenses" ON business_expenses;

CREATE POLICY "Platform admins have full access to business_expenses"
  ON business_expenses FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "Organization members can view their business expenses"
  ON business_expenses FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

CREATE POLICY "Organization members can manage business expenses"
  ON business_expenses FOR ALL
  TO authenticated
  USING (has_org_permission(organization_id, 'member'))
  WITH CHECK (has_org_permission(organization_id, 'member'));

-- mileage_records
DROP POLICY IF EXISTS "Authenticated users can view mileage records" ON mileage_records;
DROP POLICY IF EXISTS "Authenticated users can manage mileage records" ON mileage_records;

CREATE POLICY "Platform admins have full access to mileage_records"
  ON mileage_records FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "Organization members can view their mileage records"
  ON mileage_records FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

CREATE POLICY "Organization members can manage mileage records"
  ON mileage_records FOR ALL
  TO authenticated
  USING (has_org_permission(organization_id, 'member'))
  WITH CHECK (has_org_permission(organization_id, 'member'));

-- tax_calculations
DROP POLICY IF EXISTS "Authenticated users can view tax calculations" ON tax_calculations;
DROP POLICY IF EXISTS "Authenticated users can manage tax calculations" ON tax_calculations;

CREATE POLICY "Platform admins have full access to tax_calculations"
  ON tax_calculations FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "Organization members can view their tax calculations"
  ON tax_calculations FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

CREATE POLICY "Organization members can manage tax calculations"
  ON tax_calculations FOR ALL
  TO authenticated
  USING (has_org_permission(organization_id, 'member'))
  WITH CHECK (has_org_permission(organization_id, 'member'));

-- quarterly_tax_payments
DROP POLICY IF EXISTS "Authenticated users can view quarterly tax payments" ON quarterly_tax_payments;
DROP POLICY IF EXISTS "Authenticated users can manage quarterly tax payments" ON quarterly_tax_payments;

CREATE POLICY "Platform admins have full access to quarterly_tax_payments"
  ON quarterly_tax_payments FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "Organization members can view their quarterly tax payments"
  ON quarterly_tax_payments FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

CREATE POLICY "Organization members can manage quarterly tax payments"
  ON quarterly_tax_payments FOR ALL
  TO authenticated
  USING (has_org_permission(organization_id, 'member'))
  WITH CHECK (has_org_permission(organization_id, 'member'));

-- business_goals
DROP POLICY IF EXISTS "Authenticated users can view business goals" ON business_goals;
DROP POLICY IF EXISTS "Authenticated users can manage business goals" ON business_goals;

CREATE POLICY "Platform admins have full access to business_goals"
  ON business_goals FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "Organization members can view their business goals"
  ON business_goals FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

CREATE POLICY "Organization members can manage business goals"
  ON business_goals FOR ALL
  TO authenticated
  USING (has_org_permission(organization_id, 'member'))
  WITH CHECK (has_org_permission(organization_id, 'member'));

-- revenue_forecasts
DROP POLICY IF EXISTS "Authenticated users can view revenue forecasts" ON revenue_forecasts;
DROP POLICY IF EXISTS "Authenticated users can manage revenue forecasts" ON revenue_forecasts;

CREATE POLICY "Platform admins have full access to revenue_forecasts"
  ON revenue_forecasts FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "Organization members can view their revenue forecasts"
  ON revenue_forecasts FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

CREATE POLICY "Organization members can manage revenue forecasts"
  ON revenue_forecasts FOR ALL
  TO authenticated
  USING (has_org_permission(organization_id, 'member'))
  WITH CHECK (has_org_permission(organization_id, 'member'));

-- forecast_accuracy
DROP POLICY IF EXISTS "Authenticated users can view forecast accuracy" ON forecast_accuracy;
DROP POLICY IF EXISTS "Authenticated users can manage forecast accuracy" ON forecast_accuracy;

CREATE POLICY "Platform admins have full access to forecast_accuracy"
  ON forecast_accuracy FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "Organization members can view their forecast accuracy"
  ON forecast_accuracy FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

CREATE POLICY "Organization members can manage forecast accuracy"
  ON forecast_accuracy FOR ALL
  TO authenticated
  USING (has_org_permission(organization_id, 'member'))
  WITH CHECK (has_org_permission(organization_id, 'member'));
