/*
  # Fix Security Issues - Remove Unused Indexes and Fix Policies

  1. Overview
    This migration fixes multiple security issues identified in the database:
    - Removes unused indexes that add maintenance overhead without providing value
    - Fixes duplicate permissive policies on saved_requests table
    - Sets proper search_path on functions to prevent injection attacks

  2. Unused Indexes Removed
    The following indexes are removed as they have not been used:
    - idx_gallery_items_business_id
    - idx_invoices_inquiry_id
    - idx_invoices_job_id
    - idx_invoices_status
    - idx_invoices_due_date
    - idx_invoices_client_email
    - idx_invoices_invoice_number
    - idx_forecast_accuracy_business_id
    - idx_saved_requests_inquiry_id
    - idx_saved_requests_business_id
    - idx_business_address_business_id
    - idx_business_attributes_business_id
    - idx_services_business_id
    - idx_payment_methods_business_id
    - idx_service_areas_business_id
    - idx_social_media_business_id
    - idx_customer_reviews_business_id
    - idx_tax_settings_business_id
    - idx_quarterly_tax_payments_business_id
    - idx_tax_calculations_business_id
    - idx_tax_calculations_tax_year
    - idx_tax_calculations_date

  3. Policy Fixes
    - Remove duplicate INSERT policy on saved_requests table

  4. Function Security
    - Add SET search_path to all functions to prevent search path injection
*/

-- Drop unused indexes
DROP INDEX IF EXISTS idx_gallery_items_business_id;
DROP INDEX IF EXISTS idx_invoices_inquiry_id;
DROP INDEX IF EXISTS idx_invoices_job_id;
DROP INDEX IF EXISTS idx_invoices_status;
DROP INDEX IF EXISTS idx_invoices_due_date;
DROP INDEX IF EXISTS idx_invoices_client_email;
DROP INDEX IF EXISTS idx_invoices_invoice_number;
DROP INDEX IF EXISTS idx_forecast_accuracy_business_id;
DROP INDEX IF EXISTS idx_saved_requests_inquiry_id;
DROP INDEX IF EXISTS idx_saved_requests_business_id;
DROP INDEX IF EXISTS idx_business_address_business_id;
DROP INDEX IF EXISTS idx_business_attributes_business_id;
DROP INDEX IF EXISTS idx_services_business_id;
DROP INDEX IF EXISTS idx_payment_methods_business_id;
DROP INDEX IF EXISTS idx_service_areas_business_id;
DROP INDEX IF EXISTS idx_social_media_business_id;
DROP INDEX IF EXISTS idx_customer_reviews_business_id;
DROP INDEX IF EXISTS idx_tax_settings_business_id;
DROP INDEX IF EXISTS idx_quarterly_tax_payments_business_id;
DROP INDEX IF EXISTS idx_tax_calculations_business_id;
DROP INDEX IF EXISTS idx_tax_calculations_tax_year;
DROP INDEX IF EXISTS idx_tax_calculations_date;

-- Fix duplicate permissive policies on saved_requests
DROP POLICY IF EXISTS "Authenticated users can insert saved requests" ON saved_requests;

-- Recreate functions with proper search_path
CREATE OR REPLACE FUNCTION update_invoice_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subtotal numeric;
  v_tax_amount numeric;
  v_taxable_amount numeric;
  v_total numeric;
  v_invoice RECORD;
BEGIN
  SELECT 
    business_id,
    tax_rate,
    tax_override,
    late_fee_charged
  INTO v_invoice
  FROM invoices
  WHERE id = NEW.invoice_id;

  SELECT COALESCE(SUM(quantity * unit_price), 0)
  INTO v_subtotal
  FROM invoice_line_items
  WHERE invoice_id = NEW.invoice_id;

  IF v_invoice.tax_override THEN
    SELECT tax_amount INTO v_tax_amount
    FROM invoices
    WHERE id = NEW.invoice_id;
  ELSE
    SELECT COALESCE(SUM(quantity * unit_price), 0)
    INTO v_taxable_amount
    FROM invoice_line_items
    WHERE invoice_id = NEW.invoice_id AND is_taxable = true;

    v_tax_amount := ROUND(v_taxable_amount * (v_invoice.tax_rate / 100), 2);
  END IF;

  v_total := v_subtotal + v_tax_amount + v_invoice.late_fee_charged;

  UPDATE invoices
  SET
    subtotal = v_subtotal,
    tax_amount = v_tax_amount,
    total_amount = v_total,
    amount_due = v_total - COALESCE(amount_paid, 0),
    updated_at = NOW()
  WHERE id = NEW.invoice_id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION calculate_line_item_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.line_total := NEW.quantity * NEW.unit_price;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_invoice_line_items_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION calculate_late_fee(p_invoice_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
  v_late_fee_amount numeric := 0;
  v_grace_end_date date;
BEGIN
  SELECT 
    id,
    due_date,
    late_fee_enabled,
    late_fee_type,
    late_fee_amount,
    late_fee_grace_days,
    late_fee_charged,
    subtotal,
    status
  INTO v_invoice
  FROM invoices
  WHERE id = p_invoice_id
    AND is_active = true;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  IF NOT v_invoice.late_fee_enabled THEN
    RETURN 0;
  END IF;

  IF v_invoice.late_fee_charged > 0 THEN
    RETURN v_invoice.late_fee_charged;
  END IF;

  IF v_invoice.status IN ('paid', 'cancelled', 'draft') THEN
    RETURN 0;
  END IF;

  v_grace_end_date := v_invoice.due_date + COALESCE(v_invoice.late_fee_grace_days, 0);

  IF CURRENT_DATE <= v_grace_end_date THEN
    RETURN 0;
  END IF;

  IF v_invoice.late_fee_type = 'fixed' THEN
    v_late_fee_amount := COALESCE(v_invoice.late_fee_amount, 0);
  ELSIF v_invoice.late_fee_type = 'percentage' THEN
    v_late_fee_amount := ROUND((v_invoice.subtotal * COALESCE(v_invoice.late_fee_amount, 0) / 100)::numeric, 2);
  END IF;

  RETURN GREATEST(v_late_fee_amount, 0);
END;
$$;

CREATE OR REPLACE FUNCTION apply_late_fees_to_overdue_invoices()
RETURNS TABLE(invoice_id uuid, late_fee_applied numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
  v_calculated_fee numeric;
  v_new_total numeric;
BEGIN
  FOR v_invoice IN
    SELECT 
      id,
      due_date,
      late_fee_enabled,
      late_fee_grace_days,
      late_fee_charged,
      subtotal,
      tax_amount,
      status
    FROM invoices
    WHERE is_active = true
      AND late_fee_enabled = true
      AND late_fee_charged = 0
      AND status IN ('sent', 'partially_paid', 'overdue')
      AND CURRENT_DATE > (due_date + COALESCE(late_fee_grace_days, 0))
  LOOP
    v_calculated_fee := calculate_late_fee(v_invoice.id);

    IF v_calculated_fee > 0 THEN
      v_new_total := v_invoice.subtotal + v_invoice.tax_amount + v_calculated_fee;

      UPDATE invoices
      SET 
        late_fee_charged = v_calculated_fee,
        total_amount = v_new_total,
        amount_due = v_new_total - COALESCE(amount_paid, 0),
        updated_at = NOW()
      WHERE id = v_invoice.id;

      invoice_id := v_invoice.id;
      late_fee_applied := v_calculated_fee;
      RETURN NEXT;
    END IF;
  END LOOP;

  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION manually_adjust_late_fee(
  p_invoice_id uuid,
  p_late_fee_amount numeric,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
  v_new_total numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT 
    id,
    subtotal,
    tax_amount,
    amount_paid,
    late_fee_charged
  INTO v_invoice
  FROM invoices
  WHERE id = p_invoice_id
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  v_new_total := v_invoice.subtotal + v_invoice.tax_amount + GREATEST(p_late_fee_amount, 0);

  UPDATE invoices
  SET 
    late_fee_charged = GREATEST(p_late_fee_amount, 0),
    total_amount = v_new_total,
    amount_due = v_new_total - COALESCE(v_invoice.amount_paid, 0),
    updated_at = NOW()
  WHERE id = p_invoice_id;
END;
$$;
