/*
  # Fix customer_notifications RLS to support multiple customer records per auth user

  ## Problem
  The SELECT and UPDATE policies on customer_notifications use:
    customer_id = current_customer_id()

  current_customer_id() returns only ONE customer record per auth user (the oldest one).
  If the same person has multiple customer records (different emails, or jobs/notifications
  were created against a different record than the one they log in with), they will see
  nothing.

  ## Fix
  Replace single-value equality with ANY(current_customer_ids()) which checks all
  customer records linked to the current auth user — the same pattern already applied
  to portal_documents.
*/

DROP POLICY IF EXISTS "Customer can view own notifications" ON public.customer_notifications;
CREATE POLICY "Customer can view own notifications"
  ON public.customer_notifications
  FOR SELECT
  TO authenticated
  USING (customer_id = ANY(public.current_customer_ids()));

DROP POLICY IF EXISTS "Customer can update own notifications" ON public.customer_notifications;
CREATE POLICY "Customer can update own notifications"
  ON public.customer_notifications
  FOR UPDATE
  TO authenticated
  USING (customer_id = ANY(public.current_customer_ids()))
  WITH CHECK (customer_id = ANY(public.current_customer_ids()));

-- Apply the same fix to customer_notification_preferences
DROP POLICY IF EXISTS "Customer can view own notification preferences" ON public.customer_notification_preferences;
CREATE POLICY "Customer can view own notification preferences"
  ON public.customer_notification_preferences
  FOR SELECT
  TO authenticated
  USING (customer_id = ANY(public.current_customer_ids()));

DROP POLICY IF EXISTS "Customer can upsert own notification preferences" ON public.customer_notification_preferences;
CREATE POLICY "Customer can upsert own notification preferences"
  ON public.customer_notification_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = ANY(public.current_customer_ids()));

DROP POLICY IF EXISTS "Customer can update own notification preferences" ON public.customer_notification_preferences;
CREATE POLICY "Customer can update own notification preferences"
  ON public.customer_notification_preferences
  FOR UPDATE
  TO authenticated
  USING (customer_id = ANY(public.current_customer_ids()))
  WITH CHECK (customer_id = ANY(public.current_customer_ids()));
