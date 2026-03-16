/*
  # Unified customer portal notifications
*/

CREATE TABLE IF NOT EXISTS public.customer_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (
    notification_type IN (
      'job_scheduled',
      'job_completed',
      'invoice_issued',
      'invoice_paid',
      'reminder_sent'
    )
  ),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  is_important boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_notifications_customer_created
  ON public.customer_notifications(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_notifications_customer_unread
  ON public.customer_notifications(customer_id, is_read, created_at DESC);

CREATE TABLE IF NOT EXISTS public.customer_notification_preferences (
  customer_id uuid PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
  email_enabled boolean NOT NULL DEFAULT true,
  important_only boolean NOT NULL DEFAULT true,
  unsubscribe_token text NOT NULL DEFAULT public.generate_preferences_token(),
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_notification_preferences_unsubscribe_token_unique
  ON public.customer_notification_preferences(unsubscribe_token);

CREATE TABLE IF NOT EXISTS public.customer_notification_email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.customer_notifications(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  recipient_email text,
  notification_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_customer_notification_email_queue_status
  ON public.customer_notification_email_queue(status, created_at);

CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customer_notifications_set_updated_at ON public.customer_notifications;
CREATE TRIGGER trg_customer_notifications_set_updated_at
  BEFORE UPDATE ON public.customer_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_customer_notification_preferences_set_updated_at ON public.customer_notification_preferences;
CREATE TRIGGER trg_customer_notification_preferences_set_updated_at
  BEFORE UPDATE ON public.customer_notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE OR REPLACE FUNCTION public.enqueue_customer_notification(
  p_customer_id uuid,
  p_type text,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_is_important boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id uuid;
  v_customer public.customers%ROWTYPE;
  v_pref public.customer_notification_preferences%ROWTYPE;
  v_should_queue_email boolean := false;
BEGIN
  SELECT * INTO v_customer FROM public.customers c WHERE c.id = p_customer_id;
  IF v_customer.id IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.customer_notifications (
    organization_id, customer_id, notification_type, payload, is_important
  ) VALUES (
    v_customer.organization_id, p_customer_id, p_type, COALESCE(p_payload, '{}'::jsonb), p_is_important
  )
  RETURNING id INTO v_notification_id;

  INSERT INTO public.customer_notification_preferences (customer_id)
  VALUES (p_customer_id)
  ON CONFLICT (customer_id) DO NOTHING;

  SELECT * INTO v_pref FROM public.customer_notification_preferences p WHERE p.customer_id = p_customer_id;

  v_should_queue_email :=
    COALESCE(v_pref.email_enabled, true)
    AND v_pref.unsubscribed_at IS NULL
    AND (NOT COALESCE(v_pref.important_only, true) OR p_is_important = true)
    AND NULLIF(BTRIM(v_customer.email), '') IS NOT NULL;

  IF v_should_queue_email THEN
    INSERT INTO public.customer_notification_email_queue (
      notification_id, customer_id, recipient_email, notification_type, payload, status
    ) VALUES (
      v_notification_id, p_customer_id, v_customer.email, p_type, COALESCE(p_payload, '{}'::jsonb), 'pending'
    );
  END IF;

  RETURN v_notification_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_customer_notification(uuid, text, jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_customer_notification(uuid, text, jsonb, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_customer_notification(uuid, text, jsonb, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.produce_customer_notification_on_job_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.customer_id IS NULL THEN RETURN NEW; END IF;

  IF (TG_OP = 'INSERT' AND NEW.job_status = 'scheduled')
     OR (TG_OP = 'UPDATE' AND OLD.job_status IS DISTINCT FROM NEW.job_status AND NEW.job_status = 'scheduled') THEN
    PERFORM public.enqueue_customer_notification(
      NEW.customer_id, 'job_scheduled',
      jsonb_build_object('job_id', NEW.id, 'job_type', NEW.job_type, 'date_scheduled', NEW.date_scheduled, 'job_status', NEW.job_status),
      false
    );
  END IF;

  IF (TG_OP = 'INSERT' AND NEW.job_status = 'completed')
     OR (TG_OP = 'UPDATE' AND OLD.job_status IS DISTINCT FROM NEW.job_status AND NEW.job_status = 'completed') THEN
    PERFORM public.enqueue_customer_notification(
      NEW.customer_id, 'job_completed',
      jsonb_build_object('job_id', NEW.id, 'job_type', NEW.job_type, 'date_completed', NEW.date_completed, 'job_status', NEW.job_status),
      true
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_jobs_customer_notifications ON public.jobs;
CREATE TRIGGER trg_jobs_customer_notifications
  AFTER INSERT OR UPDATE OF job_status ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.produce_customer_notification_on_job_change();

CREATE OR REPLACE FUNCTION public.produce_customer_notification_on_invoice_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_issued boolean := false;
  v_paid boolean := false;
BEGIN
  IF NEW.customer_id IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    v_issued := NEW.sent_at IS NOT NULL OR NEW.status IN ('sent', 'partially_paid', 'paid');
    v_paid := NEW.status = 'paid' OR NEW.paid_at IS NOT NULL;
  ELSE
    v_issued :=
      (OLD.sent_at IS NULL AND NEW.sent_at IS NOT NULL)
      OR (OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('sent', 'partially_paid', 'paid'));
    v_paid :=
      (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'paid')
      OR (OLD.paid_at IS NULL AND NEW.paid_at IS NOT NULL);
  END IF;

  IF v_issued THEN
    PERFORM public.enqueue_customer_notification(
      NEW.customer_id, 'invoice_issued',
      jsonb_build_object('invoice_id', NEW.id, 'invoice_number', NEW.invoice_number, 'status', NEW.status, 'total_amount', NEW.total_amount, 'amount_due', NEW.amount_due, 'due_date', NEW.due_date),
      true
    );
  END IF;

  IF v_paid THEN
    PERFORM public.enqueue_customer_notification(
      NEW.customer_id, 'invoice_paid',
      jsonb_build_object('invoice_id', NEW.id, 'invoice_number', NEW.invoice_number, 'status', NEW.status, 'total_amount', NEW.total_amount, 'paid_at', NEW.paid_at),
      true
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoices_customer_notifications ON public.invoices;
CREATE TRIGGER trg_invoices_customer_notifications
  AFTER INSERT OR UPDATE OF status, sent_at, paid_at ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.produce_customer_notification_on_invoice_change();

CREATE OR REPLACE FUNCTION public.produce_customer_notification_on_reminder_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_customer_id uuid;
BEGIN
  SELECT j.customer_id INTO v_customer_id FROM public.jobs j WHERE j.id = NEW.job_id;
  IF v_customer_id IS NULL THEN RETURN NEW; END IF;

  PERFORM public.enqueue_customer_notification(
    v_customer_id, 'reminder_sent',
    jsonb_build_object('reminder_id', NEW.id, 'job_id', NEW.job_id, 'reminder_type', NEW.reminder_type, 'scheduled_date', NEW.scheduled_date, 'status', NEW.status),
    false
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_completion_reminders_customer_notifications ON public.job_completion_reminders;
CREATE TRIGGER trg_job_completion_reminders_customer_notifications
  AFTER INSERT ON public.job_completion_reminders
  FOR EACH ROW
  EXECUTE FUNCTION public.produce_customer_notification_on_reminder_insert();

ALTER TABLE public.customer_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_notification_email_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customer can view own notifications" ON public.customer_notifications;
CREATE POLICY "Customer can view own notifications"
  ON public.customer_notifications FOR SELECT TO authenticated
  USING (customer_id = public.current_customer_id());

DROP POLICY IF EXISTS "Customer can update own notifications" ON public.customer_notifications;
CREATE POLICY "Customer can update own notifications"
  ON public.customer_notifications FOR UPDATE TO authenticated
  USING (customer_id = public.current_customer_id())
  WITH CHECK (customer_id = public.current_customer_id());

DROP POLICY IF EXISTS "Org admins can manage notification email queue" ON public.customer_notification_email_queue;
CREATE POLICY "Org admins can manage notification email queue"
  ON public.customer_notification_email_queue FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_notification_email_queue.customer_id AND public.can_manage_org_settings(c.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_notification_email_queue.customer_id AND public.can_manage_org_settings(c.organization_id)));

DROP POLICY IF EXISTS "Customer can view own notification preferences" ON public.customer_notification_preferences;
CREATE POLICY "Customer can view own notification preferences"
  ON public.customer_notification_preferences FOR SELECT TO authenticated
  USING (customer_id = public.current_customer_id());

DROP POLICY IF EXISTS "Customer can upsert own notification preferences" ON public.customer_notification_preferences;
CREATE POLICY "Customer can upsert own notification preferences"
  ON public.customer_notification_preferences FOR INSERT TO authenticated
  WITH CHECK (customer_id = public.current_customer_id());

DROP POLICY IF EXISTS "Customer can update own notification preferences" ON public.customer_notification_preferences;
CREATE POLICY "Customer can update own notification preferences"
  ON public.customer_notification_preferences FOR UPDATE TO authenticated
  USING (customer_id = public.current_customer_id())
  WITH CHECK (customer_id = public.current_customer_id());
