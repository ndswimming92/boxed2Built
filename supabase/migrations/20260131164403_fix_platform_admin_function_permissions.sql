/*
  # Fix Platform Admin Function Permissions

  The is_platform_admin() function was trying to access auth.users table
  which is forbidden for the authenticated role. This migration fixes it
  by using JWT claims instead.
  
  ## Changes
  
  - Updates is_platform_admin() to use auth.jwt() instead of querying auth.users
  - This avoids the "permission denied for table users" error
*/

-- Recreate the function to use JWT claims instead of querying auth.users
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'is_platform_admin')::boolean,
    false
  );
$$;