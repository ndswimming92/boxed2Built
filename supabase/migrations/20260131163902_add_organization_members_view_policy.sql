/*
  # Add Policy for Viewing Organization Members

  This migration adds a policy that allows users to view all members
  of organizations they belong to, using the security definer function
  to avoid recursion.
  
  ## Changes
  
  - Adds policy for users to view members of their organizations
  - Uses the is_organization_member helper function
*/

-- Create helper function to check organization membership
CREATE OR REPLACE FUNCTION is_organization_member(org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
    AND user_id = auth.uid()
    AND is_active = true
  );
$$;

-- Users can view members of organizations they belong to
CREATE POLICY "Users can view members of their organizations"
  ON organization_members FOR SELECT
  TO authenticated
  USING (is_organization_member(organization_id));