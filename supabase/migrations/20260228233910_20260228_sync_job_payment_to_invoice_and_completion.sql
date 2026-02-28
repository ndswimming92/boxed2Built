/*
  # Sync Job Payment to Invoice and Completion

  ## Summary
  When a job is marked as paid (payment_date set), automatically record the
  payment on the linked invoice so the invoice flips to "paid" status. Also
  keep job_completions.final_price in sync with the job's final_price.

  ## Changes

  ### Modified Tables
  - `invoice_payments` — adds nullable `source` text column to distinguish
    auto-synced rows (value = 'job_sync') from manually entered payments

  ### New Triggers
  1. `trg_sync_invoice_payment_from_job` on `jobs` (AFTER UPDATE)
     - When payment_date is newly set: inserts a 'job_sync' row into
       invoice_payments for the linked invoice using job.final_price,
       job.payment_date, and job.payment_method.
     - When payment_date is cleared: deletes any 'job_sync' invoice_payment
       rows tied to that invoice so the status reverts automatically.
  2. `trg_sync_completion_price_from_job` on `jobs` (AFTER UPDATE)
     - When final_price changes and the job has a linked completion, updates
       job_completions.final_price to match.

  ## Security
  - Functions are SECURITY DEFINER so they can write to invoice_payments
    regardless of RLS.
  - search_path is locked to pg_catalog,public for safety.

  ## Notes
  - Existing `update_invoice_payment_status` trigger on invoice_payments
    handles the cascade to flip invoice.status, paid_at, amount_due — no
    changes needed there.
*/

-- 1. Add source column to invoice_payments
ALTER TABLE invoice_payments
  ADD COLUMN IF NOT EXISTS source text;

-- 2. Trigger function: sync invoice payment from job payment_date
CREATE OR REPLACE FUNCTION sync_invoice_payment_from_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_invoice_id uuid;
BEGIN
  -- Find the linked invoice for this job
  SELECT id INTO v_invoice_id
  FROM invoices
  WHERE job_id = NEW.id
  LIMIT 1;

  IF v_invoice_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Payment date newly set (job marked paid)
  IF NEW.payment_date IS NOT NULL AND (OLD.payment_date IS NULL OR OLD.payment_date <> NEW.payment_date) THEN
    -- Remove any previous job_sync row for this invoice to avoid duplicates
    DELETE FROM invoice_payments
    WHERE invoice_id = v_invoice_id
      AND source = 'job_sync';

    -- Insert the synced payment row
    INSERT INTO invoice_payments (invoice_id, amount, payment_date, payment_method, notes, source)
    VALUES (
      v_invoice_id,
      COALESCE(NEW.final_price, 0),
      NEW.payment_date,
      COALESCE(NEW.payment_method, 'other'),
      'Auto-recorded from job payment',
      'job_sync'
    );
  END IF;

  -- Payment date cleared (job payment reversed)
  IF NEW.payment_date IS NULL AND OLD.payment_date IS NOT NULL THEN
    DELETE FROM invoice_payments
    WHERE invoice_id = v_invoice_id
      AND source = 'job_sync';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_invoice_payment_from_job ON jobs;
CREATE TRIGGER trg_sync_invoice_payment_from_job
  AFTER UPDATE OF payment_date, payment_method, final_price
  ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION sync_invoice_payment_from_job();

-- 3. Trigger function: keep completion final_price in sync with job
CREATE OR REPLACE FUNCTION sync_completion_price_from_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.final_price IS DISTINCT FROM OLD.final_price AND NEW.completion_id IS NOT NULL THEN
    UPDATE job_completions
    SET final_price = NEW.final_price
    WHERE id = NEW.completion_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_completion_price_from_job ON jobs;
CREATE TRIGGER trg_sync_completion_price_from_job
  AFTER UPDATE OF final_price
  ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION sync_completion_price_from_job();
