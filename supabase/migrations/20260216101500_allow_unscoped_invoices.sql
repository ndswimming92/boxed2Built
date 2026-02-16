/*
  # Allow invoices to be created without organization linkage

  ## Why
  Some businesses do not have an `organization_id`, and invoice creation should still work
  for authenticated users.

  ## Changes
  - Make `organization_id` nullable on invoices tables
  - Allow authenticated users to read/write invoice records when `organization_id IS NULL`
  - Keep existing org-scoped access rules intact for records that do have an org
*/

-- Allow null org context for standalone invoice workflows
ALTER TABLE public.invoices
  ALTER COLUMN organization_id DROP NOT NULL;

ALTER TABLE public.invoice_line_items
  ALTER COLUMN organization_id DROP NOT NULL;

ALTER TABLE public.invoice_payments
  ALTER COLUMN organization_id DROP NOT NULL;

-- Invoices: permit authenticated access to unscoped records
DROP POLICY IF EXISTS "Org members can insert invoices" ON public.invoices;
DROP POLICY IF EXISTS "Org members can update invoices" ON public.invoices;
DROP POLICY IF EXISTS "Org members can delete invoices" ON public.invoices;
DROP POLICY IF EXISTS "Authenticated users can view unscoped invoices" ON public.invoices;

CREATE POLICY "Org members can insert invoices"
  ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NULL
    OR has_org_permission(organization_id, 'member')
  );

CREATE POLICY "Org members can update invoices"
  ON public.invoices FOR UPDATE TO authenticated
  USING (
    organization_id IS NULL
    OR has_org_permission(organization_id, 'member')
  )
  WITH CHECK (
    organization_id IS NULL
    OR has_org_permission(organization_id, 'member')
  );

CREATE POLICY "Org members can delete invoices"
  ON public.invoices FOR DELETE TO authenticated
  USING (
    organization_id IS NULL
    OR has_org_permission(organization_id, 'member')
  );

CREATE POLICY "Authenticated users can view unscoped invoices"
  ON public.invoices FOR SELECT TO authenticated
  USING (organization_id IS NULL);

-- Invoice line items: mirror unscoped invoice behavior
DROP POLICY IF EXISTS "Org members can insert invoice line items" ON public.invoice_line_items;
DROP POLICY IF EXISTS "Org members can update invoice line items" ON public.invoice_line_items;
DROP POLICY IF EXISTS "Org members can delete invoice line items" ON public.invoice_line_items;
DROP POLICY IF EXISTS "Authenticated users can view unscoped invoice line items" ON public.invoice_line_items;

CREATE POLICY "Org members can insert invoice line items"
  ON public.invoice_line_items FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NULL
    OR has_org_permission(organization_id, 'member')
  );

CREATE POLICY "Org members can update invoice line items"
  ON public.invoice_line_items FOR UPDATE TO authenticated
  USING (
    organization_id IS NULL
    OR has_org_permission(organization_id, 'member')
  )
  WITH CHECK (
    organization_id IS NULL
    OR has_org_permission(organization_id, 'member')
  );

CREATE POLICY "Org members can delete invoice line items"
  ON public.invoice_line_items FOR DELETE TO authenticated
  USING (
    organization_id IS NULL
    OR has_org_permission(organization_id, 'member')
  );

CREATE POLICY "Authenticated users can view unscoped invoice line items"
  ON public.invoice_line_items FOR SELECT TO authenticated
  USING (organization_id IS NULL);

-- Invoice payments: mirror unscoped invoice behavior
DROP POLICY IF EXISTS "Org members can insert invoice payments" ON public.invoice_payments;
DROP POLICY IF EXISTS "Org members can update invoice payments" ON public.invoice_payments;
DROP POLICY IF EXISTS "Org members can delete invoice payments" ON public.invoice_payments;
DROP POLICY IF EXISTS "Authenticated users can view unscoped invoice payments" ON public.invoice_payments;

CREATE POLICY "Org members can insert invoice payments"
  ON public.invoice_payments FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NULL
    OR has_org_permission(organization_id, 'member')
  );

CREATE POLICY "Org members can update invoice payments"
  ON public.invoice_payments FOR UPDATE TO authenticated
  USING (
    organization_id IS NULL
    OR has_org_permission(organization_id, 'member')
  )
  WITH CHECK (
    organization_id IS NULL
    OR has_org_permission(organization_id, 'member')
  );

CREATE POLICY "Org members can delete invoice payments"
  ON public.invoice_payments FOR DELETE TO authenticated
  USING (
    organization_id IS NULL
    OR has_org_permission(organization_id, 'member')
  );

CREATE POLICY "Authenticated users can view unscoped invoice payments"
  ON public.invoice_payments FOR SELECT TO authenticated
  USING (organization_id IS NULL);
