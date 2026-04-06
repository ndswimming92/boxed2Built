/*
  # Add Follow-Up Email Tracking to Clients

  ## Overview
  Adds a timestamp column to the clients table to track the last time a
  post-job follow-up email was sent to this client. This enables a cooldown
  UI that prevents the same follow-up from being sent multiple times within
  a short window.

  ## Modified Tables

  ### `clients`
  - `last_followup_email_sent_at` (timestamptz, nullable) — records the timestamp
    of the most recent follow-up email send for this client. NULL means no
    follow-up has ever been sent.

  ## Notes
  1. Column is nullable; existing rows are unaffected (treated as never sent).
  2. No RLS change needed — existing authenticated-user policies on clients cover this column.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'last_followup_email_sent_at'
  ) THEN
    ALTER TABLE clients ADD COLUMN last_followup_email_sent_at timestamptz DEFAULT NULL;
  END IF;
END $$;
