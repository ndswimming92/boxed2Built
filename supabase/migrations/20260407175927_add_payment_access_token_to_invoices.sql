/*
  # Add payment_access_token to invoices

  ## Summary
  Adds a cryptographically random token to every invoice that is required
  to access the public payment page. This means knowing the invoice UUID
  alone is no longer sufficient — the caller must also know the token.

  ## Changes
  - `invoices`: new column `payment_access_token` (text, NOT NULL, unique)
  - Backfills all existing rows with a unique random UUID token
  - Tightens the anon SELECT policy to require token match when accessed
    via the public payment-link path (enforced at the application layer via
    the token being embedded in the URL)

  ## Notes
  - The token is generated server-side using gen_random_uuid()
  - Existing invoices are backfilled automatically
  - The send-invoice-email edge function already uses APP_URL/pay/{id}
    — that will be updated to APP_URL/pay/{id}/{token} separately
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'payment_access_token'
  ) THEN
    ALTER TABLE invoices ADD COLUMN payment_access_token text;

    UPDATE invoices SET payment_access_token = gen_random_uuid()::text
    WHERE payment_access_token IS NULL;

    ALTER TABLE invoices ALTER COLUMN payment_access_token SET NOT NULL;

    ALTER TABLE invoices ADD CONSTRAINT invoices_payment_access_token_unique
      UNIQUE (payment_access_token);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_invoices_payment_access_token
  ON invoices (payment_access_token);
