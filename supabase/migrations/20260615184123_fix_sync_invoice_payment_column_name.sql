/*
# Fix sync_invoice_payment_from_job trigger - wrong column name

1. Modified Functions
  - `sync_invoice_payment_from_job()` - Changed `amount` to `payment_amount` in the INSERT INTO invoice_payments statement. The column was renamed at some point but this trigger was never updated.

2. Important Notes
  - This fixes the error: column "amount" of relation "invoice_payments" does not exist
  - The error occurs when updating a job that has a linked invoice and a payment_date is set
*/

CREATE OR REPLACE FUNCTION public.sync_invoice_payment_from_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_invoice_id uuid;
BEGIN
  SELECT id INTO v_invoice_id
  FROM invoices
  WHERE job_id = NEW.id
  LIMIT 1;

  IF v_invoice_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.payment_date IS NOT NULL AND (OLD.payment_date IS NULL OR OLD.payment_date <> NEW.payment_date) THEN
    DELETE FROM invoice_payments
    WHERE invoice_id = v_invoice_id
    AND source = 'job_sync';

    INSERT INTO invoice_payments (invoice_id, payment_amount, payment_date, payment_method, notes, source)
    VALUES (
      v_invoice_id,
      COALESCE(NEW.final_price, 0),
      NEW.payment_date,
      COALESCE(NEW.payment_method, 'other'),
      'Auto-recorded from job payment',
      'job_sync'
    );
  END IF;

  IF NEW.payment_date IS NULL AND OLD.payment_date IS NOT NULL THEN
    DELETE FROM invoice_payments
    WHERE invoice_id = v_invoice_id
    AND source = 'job_sync';
  END IF;

  RETURN NEW;
END;
$function$;