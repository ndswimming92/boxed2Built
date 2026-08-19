-- F11: all four business_balance_snapshots policies were TO authenticated with a
-- literal true predicate, exposing the business's balance history to every signed
-- in account and letting any of them insert or delete snapshots.
DROP POLICY IF EXISTS "Authenticated users can view balance snapshots" ON public.business_balance_snapshots;
DROP POLICY IF EXISTS "Authenticated users can insert balance snapshots" ON public.business_balance_snapshots;
DROP POLICY IF EXISTS "Authenticated users can update balance snapshots" ON public.business_balance_snapshots;
DROP POLICY IF EXISTS "Authenticated users can delete balance snapshots" ON public.business_balance_snapshots;

CREATE POLICY "Admins can view balance snapshots"
  ON public.business_balance_snapshots FOR SELECT TO authenticated
  USING (public.is_platform_admin());

CREATE POLICY "Admins can insert balance snapshots"
  ON public.business_balance_snapshots FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "Admins can update balance snapshots"
  ON public.business_balance_snapshots FOR UPDATE TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "Admins can delete balance snapshots"
  ON public.business_balance_snapshots FOR DELETE TO authenticated
  USING (public.is_platform_admin());
