/*
  # Fix invoice payment status trigger

  ## Problem
  The `update_invoice_payment_status` trigger function references a column
  named `amount` when summing payments, but the actual column in
  `invoice_payments` is named `payment_amount`. This causes every payment
  recording attempt to fail with a database error.

  ## Fix
  Update the function to use the correct column name `payment_amount`.
*/

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
  ELSIF CURRENT_DATE > v_due_date THEN
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
