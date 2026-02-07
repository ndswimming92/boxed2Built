/*
  # Consolidate Duplicate Permissive Policies - Part 3 (Special tables)

  Handles tables with unique policy patterns that don't fit the standard
  admin/member consolidation pattern.

  1. Tables Modified
    - admin_audit_logs: removed redundant ALL and overly permissive SELECT
    - form_inquiries: removed redundant ALL policy
    - saved_requests: removed redundant ALL policy
    - qr_scans: removed redundant ALL policy, added UPDATE for org admins
    - organization_members: consolidated ALL policies into specific per-action
    - organizations: consolidated duplicate SELECT and UPDATE policies
    - clients: removed redundant platform admin SELECT
    - client_notes: removed redundant platform admin SELECT

  2. Security Notes
    - admin_audit_logs: "Authenticated users can read audit logs" (USING true) removed
      as overly permissive; org-scoped SELECT via can_view_org_data remains
    - Always-true INSERT policies on form_inquiries, saved_requests, qr_scans,
      and admin_audit_logs are intentional for public-facing functionality
    - organization_members SELECT consolidated to one policy covering own membership,
      org membership, and platform admin access
    - organizations SELECT consolidated to one policy covering own orgs and platform admin
*/

-- ============================================================
-- admin_audit_logs
-- ============================================================
DROP POLICY IF EXISTS "Platform admins have full access to admin_audit_logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Authenticated users can read audit logs" ON public.admin_audit_logs;

-- Remaining policies after cleanup:
-- SELECT: "Organization members can view their audit logs" (can_view_org_data, includes platform admin)
-- INSERT: "Anyone can create audit logs for form submissions" (true, for anon+authenticated)

-- ============================================================
-- form_inquiries
-- ============================================================
DROP POLICY IF EXISTS "Platform admins have full access to form_inquiries" ON public.form_inquiries;

-- Remaining policies:
-- SELECT: "Organization members can view their form inquiries" (can_view_org_data)
-- INSERT: "Anyone can submit form inquiries" (true, anon+authenticated)
-- UPDATE: "Organization members can manage form inquiries" (has_org_permission)
-- DELETE: "Organization admins can delete form inquiries" (can_manage_org_settings)

-- ============================================================
-- saved_requests
-- ============================================================
DROP POLICY IF EXISTS "Platform admins have full access to saved_requests" ON public.saved_requests;

-- Remaining policies:
-- SELECT: "Organization members can view their saved requests" (can_view_org_data)
-- SELECT: "Anonymous users can view saved requests by code" (anon, is_active = true)
-- INSERT: "Anyone can create saved requests" (true, anon+authenticated)
-- INSERT: "Service role can insert saved requests" (true, service_role)
-- UPDATE: "Organization members can manage saved requests" (has_org_permission)
-- DELETE: "Organization admins can delete saved requests" (can_manage_org_settings)

-- ============================================================
-- qr_scans
-- ============================================================
DROP POLICY IF EXISTS "Platform admins have full access to qr_scans" ON public.qr_scans;

-- Add UPDATE policy since the ALL policy previously covered it
CREATE POLICY "Org admins can update qr scans"
  ON public.qr_scans FOR UPDATE TO authenticated
  USING (can_manage_org_settings(organization_id))
  WITH CHECK (can_manage_org_settings(organization_id));

-- Remaining policies:
-- SELECT: "Organization members can view their qr scans" (can_view_org_data)
-- INSERT: "Anyone can create qr scans" (true, anon+authenticated)
-- UPDATE: new policy above (can_manage_org_settings)
-- DELETE: "Organization admins can delete qr scans" (can_manage_org_settings)

-- ============================================================
-- organization_members
-- ============================================================
DROP POLICY IF EXISTS "Platform admins can manage all members" ON public.organization_members;
DROP POLICY IF EXISTS "Organization admins can manage members" ON public.organization_members;
DROP POLICY IF EXISTS "Users can view organization members" ON public.organization_members;
DROP POLICY IF EXISTS "Users can view own membership" ON public.organization_members;

CREATE POLICY "View org members"
  ON public.organization_members FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR is_organization_member(organization_id)
    OR (select is_platform_admin())
  );

CREATE POLICY "Admins can insert org members"
  ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (
    is_organization_admin(organization_id)
    OR (select is_platform_admin())
  );

CREATE POLICY "Admins can update org members"
  ON public.organization_members FOR UPDATE TO authenticated
  USING (
    is_organization_admin(organization_id)
    OR (select is_platform_admin())
  )
  WITH CHECK (
    is_organization_admin(organization_id)
    OR (select is_platform_admin())
  );

CREATE POLICY "Admins can delete org members"
  ON public.organization_members FOR DELETE TO authenticated
  USING (
    is_organization_admin(organization_id)
    OR (select is_platform_admin())
  );

-- ============================================================
-- organizations
-- ============================================================
DROP POLICY IF EXISTS "Platform admins can view all organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users can view their organizations" ON public.organizations;
DROP POLICY IF EXISTS "Platform admins can update any organization" ON public.organizations;
DROP POLICY IF EXISTS "Organization admins can update their organization" ON public.organizations;

CREATE POLICY "View own or admin view all organizations"
  ON public.organizations FOR SELECT TO authenticated
  USING (
    (select is_platform_admin())
    OR id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = (select auth.uid()) AND is_active = true
    )
  );

CREATE POLICY "Org admins or platform admins can update organizations"
  ON public.organizations FOR UPDATE TO authenticated
  USING (
    (select is_platform_admin())
    OR id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = (select auth.uid())
        AND role IN ('owner', 'admin')
        AND is_active = true
    )
  );

-- ============================================================
-- clients
-- ============================================================
DROP POLICY IF EXISTS "Platform admins can view all clients" ON public.clients;
-- "Org members can view their org clients" uses can_view_org_data which includes platform admin

-- ============================================================
-- client_notes
-- ============================================================
DROP POLICY IF EXISTS "Platform admins can view all client notes" ON public.client_notes;
-- "Org members can view their org client notes" uses can_view_org_data which includes platform admin
