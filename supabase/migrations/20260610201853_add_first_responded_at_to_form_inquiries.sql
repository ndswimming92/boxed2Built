/*
# Add first_responded_at column to form_inquiries

1. Modified Tables
  - `form_inquiries`
    - `first_responded_at` (timestamptz, nullable) - Timestamp of the admin's first response to this inquiry. Set once and never overwritten, enabling accurate "time to first response" metric calculation.

2. New Indexes
  - `idx_form_inquiries_first_responded_at` on (business_id, first_responded_at) - Enables efficient aggregation queries for average response time calculations on the dashboard.

3. Important Notes
  - This column differs from `last_contact_date` which gets overwritten on every follow-up
  - Used to calculate: first_responded_at - submission_date = response time
  - Only set on the first outreach; subsequent contacts do not overwrite it
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'form_inquiries'
      AND column_name = 'first_responded_at'
  ) THEN
    ALTER TABLE form_inquiries ADD COLUMN first_responded_at timestamptz;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_form_inquiries_first_responded_at
  ON form_inquiries (business_id, first_responded_at)
  WHERE first_responded_at IS NOT NULL AND is_active = true AND is_test = false;