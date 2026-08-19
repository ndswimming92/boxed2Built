-- F12: email_events was readable by every signed-in account with a literal true
-- predicate, exposing every recipient address, subject and payload the business
-- has ever sent, including other customers' invoices and gift card notices.
DROP POLICY IF EXISTS "Authenticated users can read email events" ON public.email_events;

CREATE POLICY "Admins can read email events"
  ON public.email_events FOR SELECT TO authenticated
  USING (public.is_platform_admin());
