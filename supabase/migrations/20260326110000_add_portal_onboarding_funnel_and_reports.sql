/*
  # Portal onboarding funnel, nudges, and admin adoption reports

  ## Summary
  1. Adds portal funnel event tracking for login/job-view/repeat login metrics.
  2. Adds welcome email sequence queue for first-time portal account creation.
  3. Adds RPC helpers for portal event tracking and onboarding walkthrough completion.
  4. Adds admin report views for portal adoption and inactive customers.
*/

CREATE TABLE IF NOT EXISTS public.portal_funnel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('login', 'first_job_view', 'repeat_login', 'walkthrough_completed')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_funnel_events_customer_created
  ON public.portal_funnel_events(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_portal_funnel_events_org_event_created
  ON public.portal_funnel_events(organization_id, event_type, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_portal_funnel_events_one_time_stage
  ON public.portal_funnel_events(customer_id, event_type)
  WHERE event_type IN ('first_job_view', 'walkthrough_completed');

ALTER TABLE public.portal_funnel_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can view own funnel events" ON public.portal_funnel_events;
CREATE POLICY "Customers can view own funnel events"
  ON public.portal_funnel_events
  FOR SELECT
  TO authenticated
  USING (customer_id = public.current_customer_id());

DROP POLICY IF EXISTS "Customers can insert own funnel events" ON public.portal_funnel_events;
CREATE POLICY "Customers can insert own funnel events"
  ON public.portal_funnel_events
  FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = public.current_customer_id());

DROP POLICY IF EXISTS "Org members can view funnel events" ON public.portal_funnel_events;
CREATE POLICY "Org members can view funnel events"
  ON public.portal_funnel_events
  FOR SELECT
  TO authenticated
  USING (public.is_org_member(organization_id));

CREATE TABLE IF NOT EXISTS public.portal_welcome_email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  sequence_step integer NOT NULL CHECK (sequence_step BETWEEN 1 AND 3),
  template_key text NOT NULL,
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  sent_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, sequence_step)
);

CREATE INDEX IF NOT EXISTS idx_portal_welcome_email_queue_status_scheduled
  ON public.portal_welcome_email_queue(status, scheduled_for);

ALTER TABLE public.portal_welcome_email_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can manage welcome queue" ON public.portal_welcome_email_queue;
CREATE POLICY "Org members can manage welcome queue"
  ON public.portal_welcome_email_queue
  FOR ALL
  TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE OR REPLACE FUNCTION public.enqueue_portal_welcome_sequence_for_customer(
  p_customer_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer public.customers%ROWTYPE;
BEGIN
  SELECT * INTO v_customer
  FROM public.customers
  WHERE id = p_customer_id;

  IF v_customer.id IS NULL OR NULLIF(BTRIM(v_customer.email), '') IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.portal_welcome_email_queue (
    organization_id,
    customer_id,
    sequence_step,
    template_key,
    scheduled_for,
    metadata
  ) VALUES
    (v_customer.organization_id, v_customer.id, 1, 'portal_welcome_benefits', now(), jsonb_build_object('email', v_customer.email)),
    (v_customer.organization_id, v_customer.id, 2, 'portal_how_to_use_jobs_invoices_support', now() + interval '2 days', jsonb_build_object('email', v_customer.email)),
    (v_customer.organization_id, v_customer.id, 3, 'portal_complete_profile_contact_preferences', now() + interval '5 days', jsonb_build_object('email', v_customer.email))
  ON CONFLICT (customer_id, sequence_step) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_portal_welcome_sequence_for_customer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_portal_welcome_sequence_for_customer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_portal_welcome_sequence_for_customer(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.handle_portal_welcome_sequence_on_customer_link()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.auth_user_id IS NULL AND NEW.auth_user_id IS NOT NULL THEN
    PERFORM public.enqueue_portal_welcome_sequence_for_customer(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customers_enqueue_portal_welcome_sequence ON public.customers;
CREATE TRIGGER trg_customers_enqueue_portal_welcome_sequence
  AFTER UPDATE OF auth_user_id ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_portal_welcome_sequence_on_customer_link();

CREATE OR REPLACE FUNCTION public.track_portal_funnel_event(
  p_event_type text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_organization_id uuid;
  v_login_count integer;
BEGIN
  v_customer_id := public.current_customer_id();

  IF v_customer_id IS NULL THEN
    RETURN;
  END IF;

  SELECT organization_id INTO v_organization_id
  FROM public.customers
  WHERE id = v_customer_id;

  IF v_organization_id IS NULL THEN
    RETURN;
  END IF;

  IF p_event_type NOT IN ('login', 'first_job_view', 'walkthrough_completed') THEN
    RAISE EXCEPTION 'Unsupported portal funnel event type: %', p_event_type;
  END IF;

  IF p_event_type = 'first_job_view' THEN
    INSERT INTO public.portal_funnel_events (organization_id, customer_id, event_type, metadata)
    VALUES (v_organization_id, v_customer_id, 'first_job_view', COALESCE(p_metadata, '{}'::jsonb))
    ON CONFLICT (customer_id, event_type)
    WHERE event_type IN ('first_job_view', 'walkthrough_completed')
    DO NOTHING;

    RETURN;
  END IF;

  IF p_event_type = 'walkthrough_completed' THEN
    INSERT INTO public.portal_funnel_events (organization_id, customer_id, event_type, metadata)
    VALUES (v_organization_id, v_customer_id, 'walkthrough_completed', COALESCE(p_metadata, '{}'::jsonb))
    ON CONFLICT (customer_id, event_type)
    WHERE event_type IN ('first_job_view', 'walkthrough_completed')
    DO NOTHING;

    RETURN;
  END IF;

  SELECT COUNT(*)::integer INTO v_login_count
  FROM public.portal_funnel_events
  WHERE customer_id = v_customer_id
    AND event_type = 'login';

  INSERT INTO public.portal_funnel_events (organization_id, customer_id, event_type, metadata)
  VALUES (v_organization_id, v_customer_id, 'login', COALESCE(p_metadata, '{}'::jsonb));

  IF v_login_count >= 1 THEN
    INSERT INTO public.portal_funnel_events (organization_id, customer_id, event_type, metadata)
    VALUES (v_organization_id, v_customer_id, 'repeat_login', COALESCE(p_metadata, '{}'::jsonb));
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.track_portal_funnel_event(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_portal_funnel_event(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.track_portal_funnel_event(text, jsonb) TO service_role;

CREATE OR REPLACE VIEW public.portal_adoption_report AS
SELECT
  c.organization_id,
  c.id AS customer_id,
  c.full_name,
  c.email,
  c.invited_at,
  MIN(CASE WHEN e.event_type = 'login' THEN e.created_at END) AS first_login_at,
  MIN(CASE WHEN e.event_type = 'first_job_view' THEN e.created_at END) AS first_job_view_at,
  MIN(CASE WHEN e.event_type = 'repeat_login' THEN e.created_at END) AS repeat_login_at,
  CASE
    WHEN MIN(CASE WHEN e.event_type = 'repeat_login' THEN e.created_at END) IS NOT NULL THEN 'repeat_login'
    WHEN MIN(CASE WHEN e.event_type = 'first_job_view' THEN e.created_at END) IS NOT NULL THEN 'first_job_view'
    WHEN MIN(CASE WHEN e.event_type = 'login' THEN e.created_at END) IS NOT NULL THEN 'login'
    WHEN c.invited_at IS NOT NULL THEN 'invite_sent'
    ELSE 'not_invited'
  END AS funnel_stage,
  COUNT(*) FILTER (WHERE e.event_type = 'login')::integer AS login_count,
  MAX(e.created_at) AS last_portal_activity_at
FROM public.customers c
LEFT JOIN public.portal_funnel_events e ON e.customer_id = c.id
GROUP BY c.organization_id, c.id, c.full_name, c.email, c.invited_at;

CREATE OR REPLACE VIEW public.portal_inactive_customers_report AS
SELECT
  r.organization_id,
  r.customer_id,
  r.full_name,
  r.email,
  r.invited_at,
  r.first_login_at,
  r.last_portal_activity_at,
  GREATEST(0, floor(EXTRACT(epoch FROM (now() - COALESCE(r.last_portal_activity_at, r.invited_at, now()))) / 86400))::integer AS inactive_days,
  CASE
    WHEN r.first_login_at IS NULL AND r.invited_at IS NOT NULL THEN 'invited_never_logged_in'
    WHEN r.last_portal_activity_at < now() - interval '30 days' THEN 'inactive_30_plus_days'
    ELSE 'active'
  END AS inactivity_status
FROM public.portal_adoption_report r;

GRANT SELECT ON public.portal_adoption_report TO authenticated;
GRANT SELECT ON public.portal_inactive_customers_report TO authenticated;
