/*
# Create admin_notifications table

1. New Tables
  - `admin_notifications`
    - `id` (uuid, primary key)
    - `organization_id` (uuid, FK to organizations)
    - `type` (text) — e.g. 'shop_order', 'inquiry', etc.
    - `title` (text) — short summary shown in the bell dropdown
    - `body` (text) — longer detail text
    - `link` (text, nullable) — admin route to navigate to
    - `metadata` (jsonb, nullable) — arbitrary structured data (order_id, etc.)
    - `is_read` (boolean, default false) — whether admin has seen it
    - `created_at` (timestamptz)

2. Security
  - RLS enabled. Only authenticated org members can read/update/delete.
  - Insert restricted to service_role (edge functions).

3. Indexes
  - Index on (organization_id, is_read, created_at DESC) for fast unread queries.
*/

CREATE TABLE IF NOT EXISTS admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'general',
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  link text,
  metadata jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_admin_notifications_org_unread
  ON admin_notifications (organization_id, is_read, created_at DESC);

DROP POLICY IF EXISTS "select_own_org_notifications" ON admin_notifications;
CREATE POLICY "select_own_org_notifications" ON admin_notifications FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "service_role_insert_notifications" ON admin_notifications;
CREATE POLICY "service_role_insert_notifications" ON admin_notifications FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "update_own_org_notifications" ON admin_notifications;
CREATE POLICY "update_own_org_notifications" ON admin_notifications FOR UPDATE
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

DROP POLICY IF EXISTS "delete_own_org_notifications" ON admin_notifications;
CREATE POLICY "delete_own_org_notifications" ON admin_notifications FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );
