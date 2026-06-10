/*
  # Add Lead Response Time Tracking to Form Inquiries

  ## Overview
  Adds a timestamp column to the form_inquiries table to record the moment
  the admin first reaches out to a lead. The gap between submission_date and
  first_response_at is the "Lead Response Time" (a.k.a. Speed to Lead) metric
  surfaced on the dashboard and in the inquiry detail modal.

  Mirrors the existing first_response_at convention already used by
  portal_support_tickets.

  ## Modified Tables

  ### `form_inquiries`
  - `first_response_at` (timestamptz, nullable) — records the timestamp of the
    FIRST time the admin reached out to this lead. NULL means the lead has not
    been responded to yet. Once set, it is never overwritten (unlike
    last_contact_date, which tracks the most recent contact).

  ## Notes
  1. Column is nullable; existing rows are unaffected (treated as not yet responded).
  2. No RLS change needed — existing authenticated-user policies on form_inquiries cover this column.
  3. Idempotent — safe to re-run if the migration times out.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'form_inquiries' AND column_name = 'first_response_at'
  ) THEN
    ALTER TABLE form_inquiries ADD COLUMN first_response_at timestamptz DEFAULT NULL;
  END IF;
END $$;
