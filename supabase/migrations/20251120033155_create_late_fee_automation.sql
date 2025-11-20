/*
  # Late Fee Automation System

  1. Overview
    This migration creates an automated late fee calculation and application system for invoices.
    Late fees are calculated based on invoice settings and applied automatically when invoices
    become overdue beyond their grace period.

  2. New Functions
    - `calculate_late_fee` - Calculates the late fee amount for an overdue invoice
    - `apply_late_fees_to_overdue_invoices` - Batch processes all eligible overdue invoices
    - `manually_adjust_late_fee` - Allows admins to manually adjust or waive late fees

  3. Business Logic
    - Late fees are only applied if `late_fee_enabled` is true
    - Grace period must pass before fees apply (current_date > due_date + grace_days)
    - Late fees apply only once (not compounding)
    - Fixed amount or percentage-based calculation supported
    - When applied, `late_fee_charged` is updated and totals are recalculated

  4. Security
    - Functions use SECURITY DEFINER to run with elevated privileges
    - Only authenticated users can manually adjust late fees
    - Automatic application runs with system privileges
*/

-- Function to calculate late fee for a single invoice
CREATE OR REPLACE FUNCTION calculate_late_fee(p_invoice_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Function to apply late fees to all eligible overdue invoices
CREATE OR REPLACE FUNCTION apply_late_fees_to_overdue_invoices()
RETURNS TABLE(invoice_id uuid, late_fee_applied numeric)
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Function to manually adjust late fee (for admin use)
CREATE OR REPLACE FUNCTION manually_adjust_late_fee(
  p_invoice_id uuid,
  p_late_fee_amount numeric,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION calculate_late_fee TO authenticated;
GRANT EXECUTE ON FUNCTION apply_late_fees_to_overdue_invoices TO authenticated;
GRANT EXECUTE ON FUNCTION manually_adjust_late_fee TO authenticated;
