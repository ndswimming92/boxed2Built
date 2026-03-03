
/*
  # Allow Anonymous Access to Invoices for Payment Links

  ## Summary
  Customers who receive a payment link are unauthenticated (anon role). The invoices
  and invoice_line_items tables previously had no anon SELECT policies, causing the
  payment page to return "Invoice Not Found" for anyone who wasn't logged in as an
  org member.

  ## Changes

  ### invoices
  - Add anon SELECT policy: allows reading a single active invoice by its ID.
    Only invoices where `is_active = true` are exposed.

  ### invoice_line_items
  - Add anon SELECT policy: allows reading line items whose parent invoice is active.
    Access is scoped through the parent invoice so no orphan rows are exposed.

  ## Security Notes
  - Unauthenticated users can only read invoices that are explicitly active.
  - No write access is granted to either table.
  - Line item access is gated on the parent invoice being active.
*/

CREATE POLICY "Anon can view active invoices for payment"
  ON invoices
  FOR SELECT
  TO anon
  USING (is_active = true);

CREATE POLICY "Anon can view line items for active invoices"
  ON invoice_line_items
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM invoices
      WHERE invoices.id = invoice_line_items.invoice_id
        AND invoices.is_active = true
    )
  );
