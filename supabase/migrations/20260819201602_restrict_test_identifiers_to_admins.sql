-- F20: test identifiers drive test-mode payment routing, so only platform admins
-- may read or change them. Previously any signed-in account could.
DROP POLICY IF EXISTS "Authenticated users can read test identifiers" ON public.test_identifiers;
DROP POLICY IF EXISTS "Authenticated users can insert test identifiers" ON public.test_identifiers;
DROP POLICY IF EXISTS "Authenticated users can delete test identifiers" ON public.test_identifiers;

CREATE POLICY "Admins can read test identifiers"
  ON public.test_identifiers FOR SELECT
  TO authenticated
  USING (public.is_platform_admin());

CREATE POLICY "Admins can insert test identifiers"
  ON public.test_identifiers FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "Admins can update test identifiers"
  ON public.test_identifiers FOR UPDATE
  TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "Admins can delete test identifiers"
  ON public.test_identifiers FOR DELETE
  TO authenticated
  USING (public.is_platform_admin());
