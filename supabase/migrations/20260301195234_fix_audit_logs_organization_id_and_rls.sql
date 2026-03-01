/*
  # Fix Audit Logs: Organization ID Default and RLS Policies

  ## Problem
  The admin_audit_logs table has organization_id as NOT NULL with no default,
  causing every insert to fail silently since the application code was not
  supplying this value. As a result, zero logs were being recorded.

  The SELECT RLS policy also blocked reading if the user was not in organization_members,
  even for platform admins viewing the page directly.

  ## Changes
  1. Adds a default value for organization_id (the Boxed2Built org) as a fallback
     for any inserts that still don't provide it explicitly
  2. Rebuilds the SELECT policy to properly allow platform admins unrestricted access
     and org members scoped access
  3. Updates the INSERT policy to allow the organization_id column to be supplied
     by the application (already being handled in code fix)

  ## Notes
  - No data is destroyed; this is additive/corrective only
  - The application code fix in auditLogService.ts is the primary fix;
    this migration provides a safety net default value
*/

DO $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM organizations WHERE slug = 'boxed2built' LIMIT 1;

  IF v_org_id IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE admin_audit_logs ALTER COLUMN organization_id SET DEFAULT %L',
      v_org_id
    );
  END IF;
END $$;

DROP POLICY IF EXISTS "Organization members can view their audit logs" ON admin_audit_logs;
DROP POLICY IF EXISTS "Anyone can create audit logs for form submissions" ON admin_audit_logs;

CREATE POLICY "Org members and platform admins can view audit logs"
  ON admin_audit_logs FOR SELECT
  TO authenticated
  USING (can_view_org_data(organization_id));

CREATE POLICY "Authenticated and public users can create audit logs"
  ON admin_audit_logs FOR INSERT
  TO authenticated, anon
  WITH CHECK (
    (action_type IS NOT NULL) AND (table_name IS NOT NULL)
  );
