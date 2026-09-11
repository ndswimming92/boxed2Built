/*
  # Estimates have no due date

  ## Problem
  `invoices.due_date` is NOT NULL, so every invoice — estimates included — has
  to carry a payment deadline. An estimate is a quote, not a bill: nothing is
  owed yet, so a line like "Due Date: September 26, 2026" on a quote (and in
  the email the customer receives) is wrong.

  ## Changes
  1. `invoices.due_date` becomes nullable so an estimate can be stored without
     one.
  2. Existing estimates have their due date cleared.
  3. `update_invoice_payment_status` and `calculate_late_fee` are made explicit
     about a missing due date: an invoice without one can never be overdue and
     never accrues a late fee.

  ## Notes
  - Every other invoice type is unchanged and still gets a due date from the
    application.
  - `apply_late_fees_to_overdue_invoices` already skips rows with no due date
    (its WHERE clause compares against `due_date`), so it needs no change.
  - The backfill touches only `due_date`, and
    `trg_invoices_customer_notifications` fires on status/sent_at/paid_at, so
    no customer notifications are produced by this migration.
*/

ALTER TABLE invoices ALTER COLUMN due_date DROP NOT NULL;

UPDATE invoices
SET due_date = NULL
WHERE invoice_type = 'estimate'
  AND due_date IS NOT NULL;

-- An invoice with no due date can never be past due.
CREATE OR REPLACE FUNCTION public.update_invoice_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_total_paid numeric;
  v_invoice_total numeric;
  v_new_status text;
  v_due_date date;
BEGIN
  SELECT
    COALESCE(SUM(payment_amount), 0)
  INTO v_total_paid
  FROM invoice_payments
  WHERE invoice_id = NEW.invoice_id;

  SELECT total_amount, due_date
  INTO v_invoice_total, v_due_date
  FROM invoices
  WHERE id = NEW.invoice_id;

  IF v_total_paid >= v_invoice_total THEN
    v_new_status := 'paid';
  ELSIF v_total_paid > 0 THEN
    v_new_status := 'partially_paid';
  ELSIF v_due_date IS NOT NULL AND CURRENT_DATE > v_due_date THEN
    v_new_status := 'overdue';
  ELSE
    v_new_status := 'sent';
  END IF;

  UPDATE invoices
  SET
    amount_paid = v_total_paid,
    amount_due = v_invoice_total - v_total_paid,
    status = v_new_status,
    updated_at = now()
  WHERE id = NEW.invoice_id;

  RETURN NEW;
END;
$function$;

-- Without a due date there is no grace period to run out, so no late fee.
CREATE OR REPLACE FUNCTION public.calculate_late_fee(p_invoice_id uuid)
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

  IF v_invoice.due_date IS NULL THEN
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
