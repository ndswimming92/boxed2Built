/*
  # Add Stripe session tracking to invoices

  ## Summary
  Adds a stripe_session_id column to the invoices table to track Stripe Checkout
  sessions, enabling the system to match incoming Stripe webhook events to the
  correct invoice and automatically update payment status.

  ## Changes
  - invoices: new nullable column `stripe_session_id` (text)

  ## Notes
  - Column is nullable so existing invoices are not affected
  - Indexed for fast webhook lookups by session ID
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'stripe_session_id'
  ) THEN
    ALTER TABLE invoices ADD COLUMN stripe_session_id text DEFAULT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_invoices_stripe_session_id
  ON invoices (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;
