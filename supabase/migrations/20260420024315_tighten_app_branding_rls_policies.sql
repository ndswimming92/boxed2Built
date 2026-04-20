/*
  # Tighten app_branding RLS Policies

  1. Problem
    - The initial policies granted INSERT/UPDATE/DELETE to any authenticated user
      via `USING (true)` / `WITH CHECK (true)`, effectively bypassing RLS.

  2. Changes
    - Drop the permissive authenticated INSERT/UPDATE/DELETE policies.
    - Recreate them restricted to platform admins only (using the existing
      `public.is_platform_admin()` helper function that checks the JWT
      `app_metadata.is_platform_admin` claim which can only be set server-side).
    - Keep public SELECT so the unauthenticated manifest bootstrap can still
      read branding during "Add to Home Screen".

  3. Security Notes
    - `is_platform_admin()` reads from `auth.users.raw_app_meta_data`, which
      is not editable by the user and requires the service role to modify.
    - Only platform admins can now write to `app_branding`.
*/

-- Drop the always-true policies
DROP POLICY IF EXISTS "Authenticated users can insert branding" ON app_branding;
DROP POLICY IF EXISTS "Authenticated users can update branding" ON app_branding;
DROP POLICY IF EXISTS "Authenticated users can delete branding" ON app_branding;

-- Restrict writes to platform admins only
CREATE POLICY "Platform admins can insert branding"
  ON app_branding
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "Platform admins can update branding"
  ON app_branding
  FOR UPDATE
  TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "Platform admins can delete branding"
  ON app_branding
  FOR DELETE
  TO authenticated
  USING (public.is_platform_admin());
