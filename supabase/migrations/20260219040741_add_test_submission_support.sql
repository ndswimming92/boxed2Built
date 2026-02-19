/*
  # Add Test Submission Support

  ## Summary
  This migration adds infrastructure to flag and manage test form submissions,
  preventing them from polluting real business metrics and analytics.

  ## Changes

  ### New Tables
  - `test_identifiers`
    - `id` (uuid, primary key)
    - `type` (text) - either 'name' or 'email'
    - `value` (text) - the name or email to match (case-insensitive)
    - `notes` (text, nullable) - optional description/context
    - `created_at` (timestamptz)

  ### Modified Tables
  - `form_inquiries` — adds `is_test` boolean column (default false)
  - `saved_requests` — adds `is_test` boolean column (default false)

  ## Security
  - RLS enabled on `test_identifiers`
  - Only authenticated users can read/manage test identifiers
  - Public cannot access this table

  ## Seed Data
  - Pre-seeds "Nicholas Davidson" as a test name identifier
*/

-- Create test_identifiers table
CREATE TABLE IF NOT EXISTS test_identifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('name', 'email')),
  value text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE test_identifiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read test identifiers"
  ON test_identifiers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert test identifiers"
  ON test_identifiers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete test identifiers"
  ON test_identifiers FOR DELETE
  TO authenticated
  USING (true);

-- Seed initial test identifier
INSERT INTO test_identifiers (type, value, notes)
VALUES ('name', 'Nicholas Davidson', 'Owner/founder - internal testing')
ON CONFLICT DO NOTHING;

-- Add is_test column to form_inquiries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'form_inquiries' AND column_name = 'is_test'
  ) THEN
    ALTER TABLE form_inquiries ADD COLUMN is_test boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Add is_test column to saved_requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saved_requests' AND column_name = 'is_test'
  ) THEN
    ALTER TABLE saved_requests ADD COLUMN is_test boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Index for filtering test vs real submissions efficiently
CREATE INDEX IF NOT EXISTS idx_form_inquiries_is_test ON form_inquiries(is_test);
CREATE INDEX IF NOT EXISTS idx_saved_requests_is_test ON saved_requests(is_test);
