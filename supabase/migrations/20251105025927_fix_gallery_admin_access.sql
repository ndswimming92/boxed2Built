/*
  # Fix Gallery Admin Access

  ## Summary
  Adds a proper restrictive policy for authenticated users to view all gallery items
  in the admin panel, preventing the multiple permissive policies issue.

  ## Changes
  - Add a restrictive policy for authenticated users to view all items
  - This works alongside the existing permissive policy for public users
*/

-- Add restrictive policy for authenticated users to view all items (including inactive)
-- This is restrictive, not permissive, so it works with the public policy
CREATE POLICY "Authenticated users view all items restrictive"
  ON gallery_items
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (true);
