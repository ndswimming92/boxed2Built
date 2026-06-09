/*
  # Add Quote Email Tracking to Clients

  ## Overview
  Adds a timestamp column to the clients table to track the last time a
  quote/pricing email was sent to this client. This enables a cooldown UI
  that prevents the same quote from being sent multiple times within a
  short window (matching the pattern of last_followup_email_sent_at and
  last_invoice_email_sent_at).

  ## Modified Tables

  ### `clients`
  - `last_quote_email_sent_at` (timestamptz, nullable) — records the timestamp
    of the most recent quote email send for this client. NULL means no
    quote email has ever been sent.

  ## Notes
  1. Column is nullable; existing rows are unaffected (treated as never sent).
  2. No RLS change needed — existing authenticated-user policies on clients cover this column.
  3. Idempotent — safe to re-run if the migration times out.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'last_quote_email_sent_at'
  ) THEN
    ALTER TABLE clients ADD COLUMN last_quote_email_sent_at timestamptz DEFAULT NULL;
  END IF;
END $$;