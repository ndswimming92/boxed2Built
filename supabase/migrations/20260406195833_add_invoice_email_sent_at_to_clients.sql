/*
  # Add last_invoice_email_sent_at to clients

  1. Changes
    - `clients` table: adds `last_invoice_email_sent_at` (timestamptz, nullable)
      Tracks when an invoice email was last sent to this client so a 10-minute
      cooldown can be enforced from both the edge function and the UI.

  2. Notes
    - Nullable so existing clients are unaffected.
    - No RLS changes needed — this column is only written by service-role.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'last_invoice_email_sent_at'
  ) THEN
    ALTER TABLE clients ADD COLUMN last_invoice_email_sent_at timestamptz;
  END IF;
END $$;
