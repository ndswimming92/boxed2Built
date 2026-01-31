/*
  # Fix Infinite Recursion in Organization RLS Policies

  This migration fixes infinite recursion detected in organization policies by
  removing self-referential queries and simplifying the policy logic.
  
  ## Problem
  
  The organization_members table had policies that queried itself, creating
  infinite recursion when trying to check access permissions.
  
  ## Solution
  
  1. Simplify organization_members policies to avoid self-reference
  2. Use direct user_id checks instead of subqueries
  3. Add back platform admin policies for administrative access
  
  ## Changes
  
  - organization_members: Simplified SELECT policy to check user_id directly
  - organizations: Keep existing policy structure
  - Add platform admin policies for full access
*/

-- =====================================================
-- ORGANIZATION MEMBERS - Fix Infinite Recursion
-- =====================================================

-- Drop the recursive policies
DROP POLICY IF EXISTS "Users can view members of their organizations" ON organization_members;
DROP POLICY IF EXISTS "Organization admins can manage members" ON organization_members;

-- Create simple, non-recursive policy for viewing members
-- Users can view their own membership record
CREATE POLICY "Users can view own membership"
  ON organization_members FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Platform admins can view all members
CREATE POLICY "Platform admins can view all members"
  ON organization_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = (SELECT auth.uid())
      AND raw_app_meta_data->>'is_platform_admin' = 'true'
    )
  );

-- Organization owners/admins can manage members of their organization
-- This uses a security definer function to avoid recursion
CREATE OR REPLACE FUNCTION is_organization_admin(org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
    AND is_active = true
  );
$$;

CREATE POLICY "Organization admins can manage members"
  ON organization_members FOR ALL
  TO authenticated
  USING (is_organization_admin(organization_id))
  WITH CHECK (is_organization_admin(organization_id));

-- =====================================================
-- ORGANIZATIONS - Add Platform Admin Policy
-- =====================================================

-- Platform admins can view all organizations
CREATE POLICY "Platform admins can view all organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = (SELECT auth.uid())
      AND raw_app_meta_data->>'is_platform_admin' = 'true'
    )
  );

-- Platform admins can update any organization
CREATE POLICY "Platform admins can update any organization"
  ON organizations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = (SELECT auth.uid())
      AND raw_app_meta_data->>'is_platform_admin' = 'true'
    )
  );

-- Platform admins can delete any organization
CREATE POLICY "Platform admins can delete any organization"
  ON organizations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = (SELECT auth.uid())
      AND raw_app_meta_data->>'is_platform_admin' = 'true'
    )
  );