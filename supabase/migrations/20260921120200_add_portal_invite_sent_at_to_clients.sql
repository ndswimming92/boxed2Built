/*
  # Add Portal Invite Tracking to Clients

  ## Overview
  Adds a timestamp column to the clients table recording the last time an
  "Invite to portal" email was sent. This backs the server-side cooldown in the
  send-portal-invite-email edge function and the "Sent {date}" badge on the
  admin Clients page.

  ## Modified Tables

  ### `clients`
  - `last_portal_invite_sent_at` (timestamptz, nullable) — timestamp of the most
    recent portal invite for this client. NULL means never invited.

  ## Notes
  1. Column is nullable; existing rows are unaffected (treated as never invited).
  2. No RLS change needed — existing authenticated-user policies on clients cover this column.
  3. This is deliberately separate from `customers.invited_at`, which already
     exists and drives `portal_adoption_report.funnel_stage = 'invite_sent'`.
     The two answer different questions: this column gates resends against a
     client record that may have no customer row yet; `invited_at` reports
     adoption. The invite function writes both.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'last_portal_invite_sent_at'
  ) THEN
    ALTER TABLE clients ADD COLUMN last_portal_invite_sent_at timestamptz DEFAULT NULL;
  END IF;
END $$;
