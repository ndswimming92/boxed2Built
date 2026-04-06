/*
  # Fix update_invoice_totals trigger function for DELETE operations

  ## Problem
  The `update_invoice_totals` function uses `NEW.invoice_id` to identify which
  invoice to recalculate. On a DELETE operation, `NEW` is null — only `OLD` is
  available. This means deleting a line item never recalculated the invoice
  totals, so the stored subtotal/total remained stale and was reflected in
  emails even after the item was removed.

  ## Fix
  Use `COALESCE(NEW.invoice_id, OLD.invoice_id)` so the correct invoice is
  targeted on INSERT/UPDATE (uses NEW) and on DELETE (falls back to OLD).
*/

CREATE OR REPLACE FUNCTION update_invoice_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id uuid;
  v_subtotal numeric;
  v_tax_amount numeric;
  v_taxable_amount numeric;
  v_total numeric;
  v_invoice RECORD;
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

  SELECT
    business_id,
    tax_rate,
    tax_override,
    late_fee_charged
  INTO v_invoice
  FROM invoices
  WHERE id = v_invoice_id;

  SELECT COALESCE(SUM(quantity * unit_price), 0)
  INTO v_subtotal
  FROM invoice_line_items
  WHERE invoice_id = v_invoice_id;

  IF v_invoice.tax_override THEN
    SELECT tax_amount INTO v_tax_amount
    FROM invoices
    WHERE id = v_invoice_id;
  ELSE
    SELECT COALESCE(SUM(quantity * unit_price), 0)
    INTO v_taxable_amount
    FROM invoice_line_items
    WHERE invoice_id = v_invoice_id AND is_taxable = true;

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
  WHERE id = v_invoice_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;
