/*
  # Rebuild Organization Policies with Fixed Functions

  This migration completely rebuilds the organization RLS policies with
  properly configured security definer functions that bypass RLS to prevent
  infinite recursion.
  
  ## Changes
  
  1. Drop all existing policies
  2. Recreate security definer functions with RLS bypass
  3. Recreate policies using the fixed functions
*/

-- =====================================================
-- Step 1: Drop all policies
-- =====================================================

DROP POLICY IF EXISTS "Users can view own membership" ON organization_members;
DROP POLICY IF EXISTS "Platform admins can view all members" ON organization_members;
DROP POLICY IF EXISTS "Organization admins can manage members" ON organization_members;
DROP POLICY IF EXISTS "Users can view members of their organizations" ON organization_members;

-- =====================================================
-- Step 2: Recreate functions with RLS bypass
-- =====================================================

DROP FUNCTION IF EXISTS is_organization_member(uuid) CASCADE;
DROP FUNCTION IF EXISTS is_organization_admin(uuid) CASCADE;

-- Function to check if user is a member of an organization
-- Uses SECURITY DEFINER to bypass RLS and prevent recursion
CREATE OR REPLACE FUNCTION is_organization_member(org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  result boolean;
  current_user_id uuid;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Check membership directly without triggering RLS
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
    AND user_id = current_user_id
    AND is_active = true
  ) INTO result;
  
  RETURN COALESCE(result, false);
END;
$$;

-- Function to check if user is an admin of an organization
CREATE OR REPLACE FUNCTION is_organization_admin(org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  result boolean;
  current_user_id uuid;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Check admin role directly without triggering RLS
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
    AND user_id = current_user_id
    AND role IN ('owner', 'admin')
    AND is_active = true
  ) INTO result;
  
  RETURN COALESCE(result, false);
END;
$$;

-- Function to check if user is a platform admin
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT raw_app_meta_data->>'is_platform_admin' = 'true'
     FROM auth.users
     WHERE id = auth.uid()),
    false
  );
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_organization_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_organization_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_platform_admin() TO authenticated;

-- =====================================================
-- Step 3: Recreate policies using the fixed functions
-- =====================================================

-- Policy: Users can view their own membership record
CREATE POLICY "Users can view own membership"
  ON organization_members FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Policy: Users can view all members of organizations they belong to
CREATE POLICY "Users can view organization members"
  ON organization_members FOR SELECT
  TO authenticated
  USING (is_organization_member(organization_id));

-- Policy: Organization admins can manage members
CREATE POLICY "Organization admins can manage members"
  ON organization_members FOR ALL
  TO authenticated
  USING (is_organization_admin(organization_id))
  WITH CHECK (is_organization_admin(organization_id));

-- Policy: Platform admins have full access
CREATE POLICY "Platform admins can manage all members"
  ON organization_members FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());