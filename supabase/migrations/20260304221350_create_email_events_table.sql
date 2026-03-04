/*
  # Create Email Events Table

  ## Overview
  Stores webhook events received from Resend for email activity tracking.

  ## New Tables

  ### `email_events`
  Persists every event Resend fires for outgoing emails.

  - `id` (uuid, PK) - internal row identifier
  - `resend_event_id` (text, unique) - Resend's unique event ID, used for idempotency
  - `message_id` (text) - Resend message ID, groups all events for a single email send
  - `event_type` (text) - e.g. email.sent, email.delivered, email.opened, email.bounced etc.
  - `recipient` (text) - recipient email address
  - `subject` (text) - email subject line
  - `from_address` (text) - sender address
  - `occurred_at` (timestamptz) - when the event occurred (from Resend payload)
  - `payload` (jsonb) - full raw Resend webhook payload for debugging
  - `created_at` (timestamptz) - row insertion time

  ## Security
  - RLS enabled, locked to authenticated users only
  - INSERT allowed from service role only (edge function uses service role key)
  - SELECT allowed for authenticated users (admin panel reads)

  ## Indexes
  - `message_id` for grouping events per email
  - `event_type` for filtering by status
  - `recipient` for searching by address
  - `occurred_at` for time-range queries
*/

CREATE TABLE IF NOT EXISTS email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resend_event_id text UNIQUE,
  message_id text,
  event_type text NOT NULL,
  recipient text,
  subject text,
  from_address text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_email_events_message_id ON email_events(message_id);
CREATE INDEX IF NOT EXISTS idx_email_events_event_type ON email_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_events_recipient ON email_events(recipient);
CREATE INDEX IF NOT EXISTS idx_email_events_occurred_at ON email_events(occurred_at DESC);

CREATE POLICY "Authenticated users can read email events"
  ON email_events
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can insert email events"
  ON email_events
  FOR INSERT
  TO service_role
  WITH CHECK (true);
