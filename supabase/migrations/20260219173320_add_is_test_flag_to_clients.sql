/*
  # Add is_test flag to clients table

  ## Summary
  Adds a boolean `is_test` column to the `clients` table to mark test/internal
  accounts that should be excluded from metrics, totals, and segment statistics.

  ## Changes
  - `clients` table: new `is_test` column (boolean, default false)

  ## Notes
  - Test clients remain visible in the admin UI with a "Test" badge
  - They are excluded from all stat counts and revenue totals
  - Existing clients default to false (not test)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'is_test'
  ) THEN
    ALTER TABLE clients ADD COLUMN is_test boolean NOT NULL DEFAULT false;
  END IF;
END $$;
