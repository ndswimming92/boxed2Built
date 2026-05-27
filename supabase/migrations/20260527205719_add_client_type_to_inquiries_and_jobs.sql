/*
  # Add client_type column to form_inquiries and jobs

  1. Modified Tables
    - `form_inquiries`
      - Added `client_type` (text, nullable, default 'residential') — distinguishes residential vs business inquiries
    - `jobs`
      - Added `client_type` (text, nullable, default 'residential') — carries forward from inquiry conversion

  2. Notes
    - Values are constrained to 'residential' or 'business' via CHECK constraint
    - Defaults to 'residential' for all existing and new rows
    - No destructive changes
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'form_inquiries' AND column_name = 'client_type'
  ) THEN
    ALTER TABLE form_inquiries ADD COLUMN client_type text DEFAULT 'residential';
    ALTER TABLE form_inquiries ADD CONSTRAINT form_inquiries_client_type_check
      CHECK (client_type IN ('residential', 'business'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'client_type'
  ) THEN
    ALTER TABLE jobs ADD COLUMN client_type text DEFAULT 'residential';
    ALTER TABLE jobs ADD CONSTRAINT jobs_client_type_check
      CHECK (client_type IN ('residential', 'business'));
  END IF;
END $$;
