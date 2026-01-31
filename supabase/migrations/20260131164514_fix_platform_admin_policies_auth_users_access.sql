/*
  # Fix Platform Admin Policies - Remove auth.users Access

  This migration fixes the platform admin policies that were trying to
  access the auth.users table, which causes "permission denied" errors.
  
  ## Problem
  
  The platform admin policies were using:
  ```sql
  EXISTS (SELECT 1 FROM auth.users WHERE ...)
  ```
  
  But the authenticated role doesn't have permission to query auth.users.
  
  ## Solution
  
  Replace these policies to use the is_platform_admin() function which
  uses JWT claims instead of querying the auth.users table.
  
  ## Changes
  
  - Drop old platform admin policies on organizations
  - Create new policies using is_platform_admin() function
*/

-- Drop the problematic policies
DROP POLICY IF EXISTS "Platform admins can view all organizations" ON organizations;
DROP POLICY IF EXISTS "Platform admins can update any organization" ON organizations;
DROP POLICY IF EXISTS "Platform admins can delete any organization" ON organizations;

-- Recreate using the fixed is_platform_admin() function
CREATE POLICY "Platform admins can view all organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (is_platform_admin());

CREATE POLICY "Platform admins can update any organization"
  ON organizations FOR UPDATE
  TO authenticated
  USING (is_platform_admin());

CREATE POLICY "Platform admins can delete any organization"
  ON organizations FOR DELETE
  TO authenticated
  USING (is_platform_admin());