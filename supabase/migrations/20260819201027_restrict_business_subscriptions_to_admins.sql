-- F10: all four business_subscriptions policies were TO authenticated with a
-- literal true predicate, so any signed-in portal customer could read, alter and
-- delete the business's own subscription records.
DROP POLICY IF EXISTS "Authenticated users can view business subscriptions" ON public.business_subscriptions;
DROP POLICY IF EXISTS "Authenticated users can insert business subscriptions" ON public.business_subscriptions;
DROP POLICY IF EXISTS "Authenticated users can update business subscriptions" ON public.business_subscriptions;
DROP POLICY IF EXISTS "Authenticated users can delete business subscriptions" ON public.business_subscriptions;

CREATE POLICY "Admins can view business subscriptions"
  ON public.business_subscriptions FOR SELECT TO authenticated
  USING (public.is_platform_admin());

CREATE POLICY "Admins can insert business subscriptions"
  ON public.business_subscriptions FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "Admins can update business subscriptions"
  ON public.business_subscriptions FOR UPDATE TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "Admins can delete business subscriptions"
  ON public.business_subscriptions FOR DELETE TO authenticated
  USING (public.is_platform_admin());
