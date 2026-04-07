/*
  # Add server-side validation constraints to form_inquiries

  ## Summary
  Adds CHECK constraints to the form_inquiries table to enforce basic data
  integrity at the database level, acting as a backstop to client-side and
  edge-function validation.

  ## Changes
  - `form_inquiries.client_name`: must be between 1 and 200 characters
  - `form_inquiries.client_email`: must match a basic email pattern
  - `form_inquiries.pieces`: must be >= 1 (already numeric, adding lower bound)

  ## Notes
  - These constraints fire before any trigger or RLS check
  - Malformed submissions are rejected with a constraint violation error
    before any email is sent
  - The email pattern check is intentionally simple (contains @ and .) to
    avoid false positives while blocking obviously fake addresses
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'form_inquiries_client_name_length'
  ) THEN
    ALTER TABLE form_inquiries
      ADD CONSTRAINT form_inquiries_client_name_length
      CHECK (char_length(trim(client_name)) BETWEEN 1 AND 200);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'form_inquiries_client_email_format'
  ) THEN
    ALTER TABLE form_inquiries
      ADD CONSTRAINT form_inquiries_client_email_format
      CHECK (client_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'form_inquiries_pieces_positive'
  ) THEN
    ALTER TABLE form_inquiries
      ADD CONSTRAINT form_inquiries_pieces_positive
      CHECK (pieces >= 1);
  END IF;
END $$;
