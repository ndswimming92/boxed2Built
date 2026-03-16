/*
  # Job customer action requests with bounded workflows
*/

CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.job_customer_action_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN ('request_reschedule', 'cancel_request', 'add_note')),
  request_message text,
  requested_schedule_date timestamptz,
  request_state text NOT NULL DEFAULT 'pending' CHECK (request_state IN ('pending', 'approved', 'rejected')),
  moderation_note text,
  moderated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  moderated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_reschedule_date_required
    CHECK (action_type <> 'request_reschedule' OR requested_schedule_date IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_job_customer_action_requests_job_created
  ON public.job_customer_action_requests(job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_customer_action_requests_customer_created
  ON public.job_customer_action_requests(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_customer_action_requests_state_created
  ON public.job_customer_action_requests(request_state, created_at DESC);

DROP TRIGGER IF EXISTS trg_job_customer_action_requests_set_updated_at ON public.job_customer_action_requests;
CREATE TRIGGER trg_job_customer_action_requests_set_updated_at
  BEFORE UPDATE ON public.job_customer_action_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE TABLE IF NOT EXISTS public.job_customer_action_request_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES public.job_customer_action_requests(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('customer', 'admin', 'system')),
  event_type text NOT NULL CHECK (event_type IN ('request_submitted', 'request_approved', 'request_rejected')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_customer_action_request_audit_request_created
  ON public.job_customer_action_request_audit_events(request_id, created_at DESC);

ALTER TABLE public.job_customer_action_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_customer_action_request_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customer can view own job action requests" ON public.job_customer_action_requests;
CREATE POLICY "Customer can view own job action requests"
  ON public.job_customer_action_requests FOR SELECT TO authenticated
  USING (customer_id = public.current_customer_id());

DROP POLICY IF EXISTS "Org members can view job action requests" ON public.job_customer_action_requests;
CREATE POLICY "Org members can view job action requests"
  ON public.job_customer_action_requests FOR SELECT TO authenticated
  USING (public.is_organization_member(organization_id));

DROP POLICY IF EXISTS "Org admins can moderate job action requests" ON public.job_customer_action_requests;
CREATE POLICY "Org admins can moderate job action requests"
  ON public.job_customer_action_requests FOR UPDATE TO authenticated
  USING (public.is_organization_admin(organization_id))
  WITH CHECK (public.is_organization_admin(organization_id));

DROP POLICY IF EXISTS "Customer can view own job action request audit events" ON public.job_customer_action_request_audit_events;
CREATE POLICY "Customer can view own job action request audit events"
  ON public.job_customer_action_request_audit_events FOR SELECT TO authenticated
  USING (customer_id = public.current_customer_id());

DROP POLICY IF EXISTS "Org members can view job action request audit events" ON public.job_customer_action_request_audit_events;
CREATE POLICY "Org members can view job action request audit events"
  ON public.job_customer_action_request_audit_events FOR SELECT TO authenticated
  USING (public.is_organization_member(organization_id));

CREATE OR REPLACE FUNCTION public.submit_job_customer_action_request(
  p_job_id uuid,
  p_action_type text,
  p_request_message text DEFAULT NULL,
  p_requested_schedule_date timestamptz DEFAULT NULL
)
RETURNS public.job_customer_action_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid := public.current_customer_id();
  v_job public.jobs%ROWTYPE;
  v_request public.job_customer_action_requests%ROWTYPE;
BEGIN
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Portal access requires an authenticated customer account';
  END IF;

  IF p_action_type NOT IN ('request_reschedule', 'cancel_request', 'add_note') THEN
    RAISE EXCEPTION 'Unsupported action type: %', p_action_type;
  END IF;

  SELECT * INTO v_job FROM public.jobs j WHERE j.id = p_job_id AND j.customer_id = v_customer_id;

  IF v_job.id IS NULL THEN
    RAISE EXCEPTION 'Job not found or inaccessible';
  END IF;

  IF p_action_type = 'request_reschedule' THEN
    IF v_job.job_status <> 'scheduled' THEN
      RAISE EXCEPTION 'Reschedule requests are only allowed for scheduled jobs';
    END IF;
    IF p_requested_schedule_date IS NULL THEN
      RAISE EXCEPTION 'Requested schedule date is required for reschedule requests';
    END IF;
  END IF;

  IF p_action_type = 'cancel_request' THEN
    IF v_job.job_status NOT IN ('quoted', 'accepted', 'scheduled') THEN
      RAISE EXCEPTION 'Cancel requests are only allowed for quoted, accepted, or scheduled jobs';
    END IF;
  END IF;

  IF p_action_type = 'add_note' THEN
    IF v_job.job_status IN ('completed', 'lost', 'cancelled') THEN
      RAISE EXCEPTION 'Notes can only be added to active jobs';
    END IF;
    IF COALESCE(length(btrim(p_request_message)), 0) = 0 THEN
      RAISE EXCEPTION 'A note message is required';
    END IF;
  END IF;

  INSERT INTO public.job_customer_action_requests (
    organization_id, customer_id, job_id, action_type,
    request_message, requested_schedule_date, request_state
  ) VALUES (
    v_job.organization_id, v_customer_id, v_job.id, p_action_type,
    NULLIF(btrim(p_request_message), ''), p_requested_schedule_date, 'pending'
  )
  RETURNING * INTO v_request;

  INSERT INTO public.job_customer_action_request_audit_events (
    organization_id, request_id, job_id, customer_id, actor_user_id, actor_type, event_type, metadata
  ) VALUES (
    v_request.organization_id, v_request.id, v_request.job_id, v_request.customer_id,
    auth.uid(), 'customer', 'request_submitted',
    jsonb_build_object('action_type', v_request.action_type, 'requested_schedule_date', v_request.requested_schedule_date, 'request_message', v_request.request_message)
  );

  RETURN v_request;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_job_customer_action_request(uuid, text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_job_customer_action_request(uuid, text, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_job_customer_action_request(uuid, text, text, timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.moderate_job_customer_action_request(
  p_request_id uuid,
  p_decision text,
  p_moderation_note text DEFAULT NULL
)
RETURNS public.job_customer_action_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.job_customer_action_requests%ROWTYPE;
  v_decision text;
BEGIN
  SELECT * INTO v_request FROM public.job_customer_action_requests r WHERE r.id = p_request_id;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF NOT public.is_organization_admin(v_request.organization_id) THEN
    RAISE EXCEPTION 'Only organization admins can moderate customer action requests';
  END IF;

  IF v_request.request_state <> 'pending' THEN
    RAISE EXCEPTION 'Only pending requests can be moderated';
  END IF;

  v_decision := lower(coalesce(p_decision, ''));
  IF v_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Decision must be approved or rejected';
  END IF;

  UPDATE public.job_customer_action_requests
  SET request_state = v_decision,
      moderation_note = NULLIF(btrim(p_moderation_note), ''),
      moderated_by = auth.uid(),
      moderated_at = now(),
      updated_at = now()
  WHERE id = v_request.id
  RETURNING * INTO v_request;

  INSERT INTO public.job_customer_action_request_audit_events (
    organization_id, request_id, job_id, customer_id, actor_user_id, actor_type, event_type, metadata
  ) VALUES (
    v_request.organization_id, v_request.id, v_request.job_id, v_request.customer_id,
    auth.uid(), 'admin',
    CASE WHEN v_decision = 'approved' THEN 'request_approved' ELSE 'request_rejected' END,
    jsonb_build_object('moderation_note', v_request.moderation_note)
  );

  PERFORM public.enqueue_customer_notification(
    v_request.customer_id,
    CASE WHEN v_decision = 'approved' THEN 'job_action_request_approved' ELSE 'job_action_request_rejected' END,
    jsonb_build_object('request_id', v_request.id, 'job_id', v_request.job_id, 'action_type', v_request.action_type, 'moderation_note', v_request.moderation_note),
    true
  );

  RETURN v_request;
END;
$$;

REVOKE ALL ON FUNCTION public.moderate_job_customer_action_request(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.moderate_job_customer_action_request(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderate_job_customer_action_request(uuid, text, text) TO service_role;

ALTER TABLE public.customer_notifications
  DROP CONSTRAINT IF EXISTS customer_notifications_notification_type_check;

ALTER TABLE public.customer_notifications
  ADD CONSTRAINT customer_notifications_notification_type_check
  CHECK (
    notification_type IN (
      'job_scheduled',
      'job_completed',
      'invoice_issued',
      'invoice_paid',
      'reminder_sent',
      'job_action_request_approved',
      'job_action_request_rejected'
    )
  );
