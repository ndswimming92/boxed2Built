/*
  # Create RLS Helper Functions for Multi-Tenant Access Control

  ## Overview
  Creates optimized security helper functions for Row Level Security policies.
  These functions check platform admin status, organization membership, and
  role-based permissions with proper caching for performance.

  ## Functions Created

  ### 1. is_platform_admin()
  Returns: boolean
  Checks if current user has platform_admin flag in app_metadata

  ### 2. get_user_organizations()
  Returns: uuid[]
  Returns array of organization IDs where user is an active member

  ### 3. get_user_role_in_org(org_id uuid)
  Returns: organization_role
  Returns user's role in specified organization

  ### 4. has_org_permission(org_id uuid, min_role text)
  Returns: boolean
  Checks if user has at least the specified role level in organization
  Role hierarchy: viewer < member < admin < owner

  ### 5. can_manage_org_settings(org_id uuid)
  Returns: boolean
  Checks if user is admin or owner in organization

  ### 6. can_view_org_data(org_id uuid)
  Returns: boolean
  Checks if user can view organization data (any role)

  ## Security
  - All functions use SECURITY DEFINER for consistent permissions
  - Explicit search_path prevents SQL injection via search_path manipulation
  - Functions are optimized for RLS policy performance
  - Proper NULL handling for edge cases
*/

-- Function to check if current user is a platform admin
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'is_platform_admin')::boolean,
    false
  );
END;
$$;

-- Function to get all organizations where user is a member
CREATE OR REPLACE FUNCTION get_user_organizations()
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN ARRAY(
    SELECT organization_id 
    FROM organization_members 
    WHERE user_id = auth.uid() 
    AND is_active = true
  );
END;
$$;

-- Function to get user's role in a specific organization
CREATE OR REPLACE FUNCTION get_user_role_in_org(org_id uuid)
RETURNS organization_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  user_role organization_role;
BEGIN
  SELECT role INTO user_role
  FROM organization_members
  WHERE user_id = auth.uid()
  AND organization_id = org_id
  AND is_active = true
  LIMIT 1;
  
  RETURN user_role;
END;
$$;

-- Function to check if user has minimum role permission in organization
-- Role hierarchy: viewer < member < admin < owner
CREATE OR REPLACE FUNCTION has_org_permission(org_id uuid, min_role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  user_role organization_role;
  role_levels int[] := ARRAY[1, 2, 3, 4]; -- viewer, member, admin, owner
  user_level int;
  required_level int;
BEGIN
  -- Platform admins bypass all checks
  IF is_platform_admin() THEN
    RETURN true;
  END IF;

  -- Get user's role
  user_role := get_user_role_in_org(org_id);
  
  IF user_role IS NULL THEN
    RETURN false;
  END IF;

  -- Map roles to levels
  user_level := CASE user_role
    WHEN 'viewer' THEN 1
    WHEN 'member' THEN 2
    WHEN 'admin' THEN 3
    WHEN 'owner' THEN 4
    ELSE 0
  END;

  required_level := CASE min_role
    WHEN 'viewer' THEN 1
    WHEN 'member' THEN 2
    WHEN 'admin' THEN 3
    WHEN 'owner' THEN 4
    ELSE 0
  END;

  RETURN user_level >= required_level;
END;
$$;

-- Function to check if user can manage organization settings (admin or owner)
CREATE OR REPLACE FUNCTION can_manage_org_settings(org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN has_org_permission(org_id, 'admin');
END;
$$;

-- Function to check if user can view organization data (any active member)
CREATE OR REPLACE FUNCTION can_view_org_data(org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  -- Platform admins can view all
  IF is_platform_admin() THEN
    RETURN true;
  END IF;

  -- Check if user is any active member
  RETURN EXISTS (
    SELECT 1 
    FROM organization_members 
    WHERE user_id = auth.uid() 
    AND organization_id = org_id 
    AND is_active = true
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_platform_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_user_organizations() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_role_in_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION has_org_permission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION can_manage_org_settings(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION can_view_org_data(uuid) TO authenticated;

-- Create comment documentation
COMMENT ON FUNCTION is_platform_admin() IS 'Returns true if current user is a platform admin';
COMMENT ON FUNCTION get_user_organizations() IS 'Returns array of organization IDs where user is an active member';
COMMENT ON FUNCTION get_user_role_in_org(uuid) IS 'Returns user role in specified organization';
COMMENT ON FUNCTION has_org_permission(uuid, text) IS 'Checks if user has minimum role level in organization';
COMMENT ON FUNCTION can_manage_org_settings(uuid) IS 'Checks if user can manage organization settings (admin/owner)';
COMMENT ON FUNCTION can_view_org_data(uuid) IS 'Checks if user can view organization data (any member)';
