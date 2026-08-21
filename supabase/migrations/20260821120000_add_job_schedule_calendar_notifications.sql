/*
# Job schedule calendar notifications

1. Changes to `jobs`
  - `schedule_notified_for` (date) — the `date_scheduled` value the last calendar
    email covered. Re-sending only happens when this stops matching
    `date_scheduled`, so editing an unrelated field on an already-scheduled job
    does not send a duplicate.
  - `schedule_notified_at` (timestamptz) — when that email went out.
  - `schedule_ics_sequence` (integer) — ICS SEQUENCE counter. Calendar apps key
    off UID + SEQUENCE to decide whether an incoming .ics replaces an event they
    already hold, so a reschedule only overwrites the old entry if this rises.

2. New Tables
  - `calendar_feed_tokens` — opaque tokens for the subscribable job calendar
    feed. Google and Apple Calendar fetch a feed URL without an Authorization
    header, so the token in the query string is the only credential; each row is
    revocable on its own and records when it was last read.

3. Security
  - RLS on `calendar_feed_tokens`: org members manage their own org's tokens.
  - No anon access. The feed edge function resolves tokens with the service role,
    which bypasses RLS, so the token never has to be readable by anon.

4. Indexes
  - Partial index on `jobs (date_scheduled)` for upcoming-job feed queries.
  - Unique index on the token value for O(1) feed lookups.
*/

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS schedule_notified_for date;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS schedule_notified_at timestamptz;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS schedule_ics_sequence integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN jobs.schedule_notified_for IS
  'date_scheduled value covered by the last calendar email; NULL means never notified.';
COMMENT ON COLUMN jobs.schedule_ics_sequence IS
  'ICS SEQUENCE for this job event. Must increase on every reschedule so calendar apps replace rather than duplicate.';

-- Feed queries only ever ask for jobs that have a scheduled date, so keep the
-- index off the (many) rows that never will.
CREATE INDEX IF NOT EXISTS idx_jobs_date_scheduled_active
  ON jobs (organization_id, date_scheduled)
  WHERE date_scheduled IS NOT NULL AND is_active = true;

CREATE TABLE IF NOT EXISTS calendar_feed_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token text NOT NULL,
  label text NOT NULL DEFAULT 'Job schedule',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_accessed_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_feed_tokens_token
  ON calendar_feed_tokens (token);

CREATE INDEX IF NOT EXISTS idx_calendar_feed_tokens_org
  ON calendar_feed_tokens (organization_id, is_active);

ALTER TABLE calendar_feed_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_org_calendar_tokens" ON calendar_feed_tokens;
CREATE POLICY "select_own_org_calendar_tokens" ON calendar_feed_tokens FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_own_org_calendar_tokens" ON calendar_feed_tokens;
CREATE POLICY "insert_own_org_calendar_tokens" ON calendar_feed_tokens FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_own_org_calendar_tokens" ON calendar_feed_tokens;
CREATE POLICY "update_own_org_calendar_tokens" ON calendar_feed_tokens FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_own_org_calendar_tokens" ON calendar_feed_tokens;
CREATE POLICY "delete_own_org_calendar_tokens" ON calendar_feed_tokens FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );
