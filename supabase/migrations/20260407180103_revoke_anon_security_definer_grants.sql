/*
  # Revoke anon EXECUTE on SECURITY DEFINER helper functions

  ## Summary
  Tightens function-level permissions so that unauthenticated (anon) callers
  cannot invoke sensitive SECURITY DEFINER functions that bypass RLS.

  ## Changes
  - Revokes EXECUTE on `is_platform_admin()` from the `anon` role
  - Revokes EXECUTE on `get_user_organization_role()` from the `anon` role
    (if it exists) since it reads org membership data
  - Grants remain for the `authenticated` role where needed

  ## Notes
  - These functions use SECURITY DEFINER which means they run with elevated
    privileges. Exposing them to anon allows unauthenticated probing of the
    auth.users and organization_members tables.
  - This is safe because no public-facing feature requires anon callers to
    invoke these functions.
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_platform_admin'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.is_platform_admin() FROM anon;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_user_organization_role'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.get_user_organization_role(uuid) FROM anon;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_my_organization_id'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.get_my_organization_id() FROM anon;
  END IF;
END $$;
