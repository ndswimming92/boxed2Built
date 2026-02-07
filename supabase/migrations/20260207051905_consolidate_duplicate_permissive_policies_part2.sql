/*
  # Consolidate Duplicate Permissive Policies - Part 2 (Member-managed tables)

  Continues the consolidation for tables where org members (not just admins)
  can manage data. Same strategy: drop redundant ALL policies, create specific
  per-action policies. The has_org_permission() function already includes
  is_platform_admin() check internally.

  1. Tables Modified (member-level write access)
    - business_expenses, business_goals, forecast_accuracy
    - gallery_items, invoice_line_items, invoice_payments, invoices
    - job_completion_reminders, job_completions, jobs
    - mileage_records, quarterly_tax_payments, revenue_forecasts, tax_calculations

  2. Extra Cleanup
    - gallery_items: also drops overly permissive "Authenticated users view all items restrictive"

  3. Security
    - No change in effective permissions
    - Each action now has exactly one policy per role
*/

-- ============================================================
-- business_expenses
-- ============================================================
DROP POLICY IF EXISTS "Platform admins have full access to business_expenses" ON public.business_expenses;
DROP POLICY IF EXISTS "Organization members can manage business expenses" ON public.business_expenses;

CREATE POLICY "Org members can insert business expenses"
  ON public.business_expenses FOR INSERT TO authenticated
  WITH CHECK (has_org_permission(organization_id, 'member'));

CREATE POLICY "Org members can update business expenses"
  ON public.business_expenses FOR UPDATE TO authenticated
  USING (has_org_permission(organization_id, 'member'))
  WITH CHECK (has_org_permission(organization_id, 'member'));

CREATE POLICY "Org members can delete business expenses"
  ON public.business_expenses FOR DELETE TO authenticated
  USING (has_org_permission(organization_id, 'member'));

-- ============================================================
-- business_goals
-- ============================================================
DROP POLICY IF EXISTS "Platform admins have full access to business_goals" ON public.business_goals;
DROP POLICY IF EXISTS "Organization members can manage business goals" ON public.business_goals;

CREATE POLICY "Org members can insert business goals"
  ON public.business_goals FOR INSERT TO authenticated
  WITH CHECK (has_org_permission(organization_id, 'member'));

CREATE POLICY "Org members can update business goals"
  ON public.business_goals FOR UPDATE TO authenticated
  USING (has_org_permission(organization_id, 'member'))
  WITH CHECK (has_org_permission(organization_id, 'member'));

CREATE POLICY "Org members can delete business goals"
  ON public.business_goals FOR DELETE TO authenticated
  USING (has_org_permission(organization_id, 'member'));

-- ============================================================
-- forecast_accuracy
-- ============================================================
DROP POLICY IF EXISTS "Platform admins have full access to forecast_accuracy" ON public.forecast_accuracy;
DROP POLICY IF EXISTS "Organization members can manage forecast accuracy" ON public.forecast_accuracy;

CREATE POLICY "Org members can insert forecast accuracy"
  ON public.forecast_accuracy FOR INSERT TO authenticated
  WITH CHECK (has_org_permission(organization_id, 'member'));

CREATE POLICY "Org members can update forecast accuracy"
  ON public.forecast_accuracy FOR UPDATE TO authenticated
  USING (has_org_permission(organization_id, 'member'))
  WITH CHECK (has_org_permission(organization_id, 'member'));

CREATE POLICY "Org members can delete forecast accuracy"
  ON public.forecast_accuracy FOR DELETE TO authenticated
  USING (has_org_permission(organization_id, 'member'));

-- ============================================================
-- gallery_items
-- ============================================================
DROP POLICY IF EXISTS "Platform admins have full access to gallery_items" ON public.gallery_items;
DROP POLICY IF EXISTS "Organization members can manage gallery items" ON public.gallery_items;
DROP POLICY IF EXISTS "Authenticated users view all items restrictive" ON public.gallery_items;

CREATE POLICY "Org members can insert gallery items"
  ON public.gallery_items FOR INSERT TO authenticated
  WITH CHECK (has_org_permission(organization_id, 'member'));

CREATE POLICY "Org members can update gallery items"
  ON public.gallery_items FOR UPDATE TO authenticated
  USING (has_org_permission(organization_id, 'member'))
  WITH CHECK (has_org_permission(organization_id, 'member'));

CREATE POLICY "Org members can delete gallery items"
  ON public.gallery_items FOR DELETE TO authenticated
  USING (has_org_permission(organization_id, 'member'));

-- ============================================================
-- invoice_line_items
-- ============================================================
DROP POLICY IF EXISTS "Platform admins have full access to invoice_line_items" ON public.invoice_line_items;
DROP POLICY IF EXISTS "Organization members can manage invoice line items" ON public.invoice_line_items;

CREATE POLICY "Org members can insert invoice line items"
  ON public.invoice_line_items FOR INSERT TO authenticated
  WITH CHECK (has_org_permission(organization_id, 'member'));

CREATE POLICY "Org members can update invoice line items"
  ON public.invoice_line_items FOR UPDATE TO authenticated
  USING (has_org_permission(organization_id, 'member'))
  WITH CHECK (has_org_permission(organization_id, 'member'));

CREATE POLICY "Org members can delete invoice line items"
  ON public.invoice_line_items FOR DELETE TO authenticated
  USING (has_org_permission(organization_id, 'member'));

-- ============================================================
-- invoice_payments
-- ============================================================
DROP POLICY IF EXISTS "Platform admins have full access to invoice_payments" ON public.invoice_payments;
DROP POLICY IF EXISTS "Organization members can manage invoice payments" ON public.invoice_payments;

CREATE POLICY "Org members can insert invoice payments"
  ON public.invoice_payments FOR INSERT TO authenticated
  WITH CHECK (has_org_permission(organization_id, 'member'));

CREATE POLICY "Org members can update invoice payments"
  ON public.invoice_payments FOR UPDATE TO authenticated
  USING (has_org_permission(organization_id, 'member'))
  WITH CHECK (has_org_permission(organization_id, 'member'));

CREATE POLICY "Org members can delete invoice payments"
  ON public.invoice_payments FOR DELETE TO authenticated
  USING (has_org_permission(organization_id, 'member'));

-- ============================================================
-- invoices
-- ============================================================
DROP POLICY IF EXISTS "Platform admins have full access to invoices" ON public.invoices;
DROP POLICY IF EXISTS "Organization members can manage invoices" ON public.invoices;

CREATE POLICY "Org members can insert invoices"
  ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (has_org_permission(organization_id, 'member'));

CREATE POLICY "Org members can update invoices"
  ON public.invoices FOR UPDATE TO authenticated
  USING (has_org_permission(organization_id, 'member'))
  WITH CHECK (has_org_permission(organization_id, 'member'));

CREATE POLICY "Org members can delete invoices"
  ON public.invoices FOR DELETE TO authenticated
  USING (has_org_permission(organization_id, 'member'));

-- ============================================================
-- job_completion_reminders
-- ============================================================
DROP POLICY IF EXISTS "Platform admins have full access to job_completion_reminders" ON public.job_completion_reminders;
DROP POLICY IF EXISTS "Organization members can manage job completion reminders" ON public.job_completion_reminders;

CREATE POLICY "Org members can insert job completion reminders"
  ON public.job_completion_reminders FOR INSERT TO authenticated
  WITH CHECK (has_org_permission(organization_id, 'member'));

CREATE POLICY "Org members can update job completion reminders"
  ON public.job_completion_reminders FOR UPDATE TO authenticated
  USING (has_org_permission(organization_id, 'member'))
  WITH CHECK (has_org_permission(organization_id, 'member'));

CREATE POLICY "Org members can delete job completion reminders"
  ON public.job_completion_reminders FOR DELETE TO authenticated
  USING (has_org_permission(organization_id, 'member'));

-- ============================================================
-- job_completions
-- ============================================================
DROP POLICY IF EXISTS "Platform admins have full access to job_completions" ON public.job_completions;
DROP POLICY IF EXISTS "Organization members can manage job completions" ON public.job_completions;

CREATE POLICY "Org members can insert job completions"
  ON public.job_completions FOR INSERT TO authenticated
  WITH CHECK (has_org_permission(organization_id, 'member'));

CREATE POLICY "Org members can update job completions"
  ON public.job_completions FOR UPDATE TO authenticated
  USING (has_org_permission(organization_id, 'member'))
  WITH CHECK (has_org_permission(organization_id, 'member'));

CREATE POLICY "Org members can delete job completions"
  ON public.job_completions FOR DELETE TO authenticated
  USING (has_org_permission(organization_id, 'member'));

-- ============================================================
-- jobs
-- ============================================================
DROP POLICY IF EXISTS "Platform admins have full access to jobs" ON public.jobs;
DROP POLICY IF EXISTS "Organization members can manage jobs" ON public.jobs;

CREATE POLICY "Org members can insert jobs"
  ON public.jobs FOR INSERT TO authenticated
  WITH CHECK (has_org_permission(organization_id, 'member'));

CREATE POLICY "Org members can update jobs"
  ON public.jobs FOR UPDATE TO authenticated
  USING (has_org_permission(organization_id, 'member'))
  WITH CHECK (has_org_permission(organization_id, 'member'));

CREATE POLICY "Org members can delete jobs"
  ON public.jobs FOR DELETE TO authenticated
  USING (has_org_permission(organization_id, 'member'));

-- ============================================================
-- mileage_records
-- ============================================================
DROP POLICY IF EXISTS "Platform admins have full access to mileage_records" ON public.mileage_records;
DROP POLICY IF EXISTS "Organization members can manage mileage records" ON public.mileage_records;

CREATE POLICY "Org members can insert mileage records"
  ON public.mileage_records FOR INSERT TO authenticated
  WITH CHECK (has_org_permission(organization_id, 'member'));

CREATE POLICY "Org members can update mileage records"
  ON public.mileage_records FOR UPDATE TO authenticated
  USING (has_org_permission(organization_id, 'member'))
  WITH CHECK (has_org_permission(organization_id, 'member'));

CREATE POLICY "Org members can delete mileage records"
  ON public.mileage_records FOR DELETE TO authenticated
  USING (has_org_permission(organization_id, 'member'));

-- ============================================================
-- quarterly_tax_payments
-- ============================================================
DROP POLICY IF EXISTS "Platform admins have full access to quarterly_tax_payments" ON public.quarterly_tax_payments;
DROP POLICY IF EXISTS "Organization members can manage quarterly tax payments" ON public.quarterly_tax_payments;

CREATE POLICY "Org members can insert quarterly tax payments"
  ON public.quarterly_tax_payments FOR INSERT TO authenticated
  WITH CHECK (has_org_permission(organization_id, 'member'));

CREATE POLICY "Org members can update quarterly tax payments"
  ON public.quarterly_tax_payments FOR UPDATE TO authenticated
  USING (has_org_permission(organization_id, 'member'))
  WITH CHECK (has_org_permission(organization_id, 'member'));

CREATE POLICY "Org members can delete quarterly tax payments"
  ON public.quarterly_tax_payments FOR DELETE TO authenticated
  USING (has_org_permission(organization_id, 'member'));

-- ============================================================
-- revenue_forecasts
-- ============================================================
DROP POLICY IF EXISTS "Platform admins have full access to revenue_forecasts" ON public.revenue_forecasts;
DROP POLICY IF EXISTS "Organization members can manage revenue forecasts" ON public.revenue_forecasts;

CREATE POLICY "Org members can insert revenue forecasts"
  ON public.revenue_forecasts FOR INSERT TO authenticated
  WITH CHECK (has_org_permission(organization_id, 'member'));

CREATE POLICY "Org members can update revenue forecasts"
  ON public.revenue_forecasts FOR UPDATE TO authenticated
  USING (has_org_permission(organization_id, 'member'))
  WITH CHECK (has_org_permission(organization_id, 'member'));

CREATE POLICY "Org members can delete revenue forecasts"
  ON public.revenue_forecasts FOR DELETE TO authenticated
  USING (has_org_permission(organization_id, 'member'));

-- ============================================================
-- tax_calculations
-- ============================================================
DROP POLICY IF EXISTS "Platform admins have full access to tax_calculations" ON public.tax_calculations;
DROP POLICY IF EXISTS "Organization members can manage tax calculations" ON public.tax_calculations;

CREATE POLICY "Org members can insert tax calculations"
  ON public.tax_calculations FOR INSERT TO authenticated
  WITH CHECK (has_org_permission(organization_id, 'member'));

CREATE POLICY "Org members can update tax calculations"
  ON public.tax_calculations FOR UPDATE TO authenticated
  USING (has_org_permission(organization_id, 'member'))
  WITH CHECK (has_org_permission(organization_id, 'member'));

CREATE POLICY "Org members can delete tax calculations"
  ON public.tax_calculations FOR DELETE TO authenticated
  USING (has_org_permission(organization_id, 'member'));
