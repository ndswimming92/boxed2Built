/*
  # Privacy portal tooling
*/

CREATE TABLE IF NOT EXISTS public.customer_privacy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK (request_type IN ('data_export', 'account_deletion')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'pending_confirmation', 'scheduled', 'processing', 'completed', 'cancelled', 'rejected', 'failed')),
  confirmation_token text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  grace_period_ends_at timestamptz,
  processed_at timestamptz,
  processed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_privacy_requests_customer_created
  ON public.customer_privacy_requests(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_privacy_requests_org_status
  ON public.customer_privacy_requests(organization_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.customer_privacy_export_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE REFERENCES public.customer_privacy_requests(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'ready', 'failed', 'expired')),
  download_url text,
  file_size_bytes bigint,
  expires_at timestamptz,
  error_message text,
  processed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_privacy_export_jobs_org_status
  ON public.customer_privacy_export_jobs(organization_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.customer_marketing_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL UNIQUE REFERENCES public.customers(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email_marketing_enabled boolean NOT NULL DEFAULT false,
  sms_marketing_enabled boolean NOT NULL DEFAULT false,
  consent_source text NOT NULL DEFAULT 'portal_privacy',
  consented_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_marketing_consents_org
  ON public.customer_marketing_consents(organization_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.privacy_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('customer', 'admin', 'system')),
  event_type text NOT NULL,
  subject_table text NOT NULL,
  subject_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_privacy_audit_events_org_created
  ON public.privacy_audit_events(organization_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_privacy_portal_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_customer_privacy_requests_updated_at ON public.customer_privacy_requests;
CREATE TRIGGER trg_customer_privacy_requests_updated_at
  BEFORE UPDATE ON public.customer_privacy_requests FOR EACH ROW
  EXECUTE FUNCTION public.set_privacy_portal_updated_at();

DROP TRIGGER IF EXISTS trg_customer_privacy_export_jobs_updated_at ON public.customer_privacy_export_jobs;
CREATE TRIGGER trg_customer_privacy_export_jobs_updated_at
  BEFORE UPDATE ON public.customer_privacy_export_jobs FOR EACH ROW
  EXECUTE FUNCTION public.set_privacy_portal_updated_at();

DROP TRIGGER IF EXISTS trg_customer_marketing_consents_updated_at ON public.customer_marketing_consents;
CREATE TRIGGER trg_customer_marketing_consents_updated_at
  BEFORE UPDATE ON public.customer_marketing_consents FOR EACH ROW
  EXECUTE FUNCTION public.set_privacy_portal_updated_at();

CREATE OR REPLACE FUNCTION public.prevent_privacy_audit_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'privacy_audit_events is immutable'; END; $$;

DROP TRIGGER IF EXISTS trg_privacy_audit_events_no_update ON public.privacy_audit_events;
CREATE TRIGGER trg_privacy_audit_events_no_update
  BEFORE UPDATE ON public.privacy_audit_events FOR EACH ROW
  EXECUTE FUNCTION public.prevent_privacy_audit_mutation();

DROP TRIGGER IF EXISTS trg_privacy_audit_events_no_delete ON public.privacy_audit_events;
CREATE TRIGGER trg_privacy_audit_events_no_delete
  BEFORE DELETE ON public.privacy_audit_events FOR EACH ROW
  EXECUTE FUNCTION public.prevent_privacy_audit_mutation();

CREATE OR REPLACE FUNCTION public.log_privacy_event(
  p_organization_id uuid, p_customer_id uuid, p_actor_type text,
  p_event_type text, p_subject_table text, p_subject_id uuid, p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.privacy_audit_events (organization_id, customer_id, actor_user_id, actor_type, event_type, subject_table, subject_id, details)
  VALUES (p_organization_id, p_customer_id, auth.uid(), p_actor_type, p_event_type, p_subject_table, p_subject_id, COALESCE(p_details, '{}'::jsonb));
END; $$;

CREATE OR REPLACE FUNCTION public.submit_data_export_request()
RETURNS public.customer_privacy_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_customer_id uuid := public.current_customer_id();
  v_request public.customer_privacy_requests;
BEGIN
  IF v_customer_id IS NULL THEN RAISE EXCEPTION 'No linked customer account found.'; END IF;

  INSERT INTO public.customer_privacy_requests (customer_id, organization_id, request_type, status, metadata)
  SELECT c.id, c.organization_id, 'data_export', 'pending', jsonb_build_object('channel', 'portal_privacy')
  FROM public.customers c WHERE c.id = v_customer_id
  RETURNING * INTO v_request;

  INSERT INTO public.customer_privacy_export_jobs (request_id, customer_id, organization_id, status)
  VALUES (v_request.id, v_request.customer_id, v_request.organization_id, 'queued');

  PERFORM public.log_privacy_event(v_request.organization_id, v_request.customer_id, 'customer', 'export_requested', 'customer_privacy_requests', v_request.id, jsonb_build_object('request_type', v_request.request_type));
  RETURN v_request;
END; $$;

CREATE OR REPLACE FUNCTION public.submit_account_deletion_request(p_grace_period_days integer DEFAULT 30)
RETURNS public.customer_privacy_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_customer_id uuid := public.current_customer_id();
  v_request public.customer_privacy_requests;
BEGIN
  IF v_customer_id IS NULL THEN RAISE EXCEPTION 'No linked customer account found.'; END IF;

  INSERT INTO public.customer_privacy_requests (customer_id, organization_id, request_type, status, confirmation_token, grace_period_ends_at, metadata)
  SELECT c.id, c.organization_id, 'account_deletion', 'pending_confirmation',
    encode(gen_random_bytes(16), 'hex'),
    now() + make_interval(days => GREATEST(1, COALESCE(p_grace_period_days, 30))),
    jsonb_build_object('channel', 'portal_privacy', 'grace_period_days', GREATEST(1, COALESCE(p_grace_period_days, 30)))
  FROM public.customers c WHERE c.id = v_customer_id
  RETURNING * INTO v_request;

  PERFORM public.log_privacy_event(v_request.organization_id, v_request.customer_id, 'customer', 'deletion_requested', 'customer_privacy_requests', v_request.id, jsonb_build_object('status', v_request.status, 'grace_period_ends_at', v_request.grace_period_ends_at));
  RETURN v_request;
END; $$;

CREATE OR REPLACE FUNCTION public.confirm_account_deletion_request(p_request_id uuid, p_confirmation_token text)
RETURNS public.customer_privacy_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_customer_id uuid := public.current_customer_id();
  v_request public.customer_privacy_requests;
BEGIN
  UPDATE public.customer_privacy_requests r
  SET status = 'scheduled', confirmed_at = now(), metadata = r.metadata || jsonb_build_object('confirmed_via', 'portal')
  WHERE r.id = p_request_id AND r.customer_id = v_customer_id AND r.request_type = 'account_deletion'
    AND r.status = 'pending_confirmation' AND r.confirmation_token = p_confirmation_token
  RETURNING r.* INTO v_request;

  IF v_request.id IS NULL THEN RAISE EXCEPTION 'Invalid request confirmation details.'; END IF;

  PERFORM public.log_privacy_event(v_request.organization_id, v_request.customer_id, 'customer', 'deletion_confirmed', 'customer_privacy_requests', v_request.id, jsonb_build_object('confirmed_at', v_request.confirmed_at));
  RETURN v_request;
END; $$;

CREATE OR REPLACE FUNCTION public.upsert_my_marketing_consent(p_email_marketing_enabled boolean, p_sms_marketing_enabled boolean, p_consent_source text DEFAULT 'portal_privacy')
RETURNS public.customer_marketing_consents LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_customer_id uuid := public.current_customer_id();
  v_org_id uuid;
  v_consent public.customer_marketing_consents;
BEGIN
  IF v_customer_id IS NULL THEN RAISE EXCEPTION 'No linked customer account found.'; END IF;

  SELECT organization_id INTO v_org_id FROM public.customers WHERE id = v_customer_id;

  INSERT INTO public.customer_marketing_consents (customer_id, organization_id, email_marketing_enabled, sms_marketing_enabled, consent_source, consented_at, revoked_at)
  VALUES (v_customer_id, v_org_id, COALESCE(p_email_marketing_enabled, false), COALESCE(p_sms_marketing_enabled, false),
    COALESCE(NULLIF(BTRIM(p_consent_source), ''), 'portal_privacy'),
    CASE WHEN COALESCE(p_email_marketing_enabled, false) OR COALESCE(p_sms_marketing_enabled, false) THEN now() ELSE NULL END,
    CASE WHEN NOT COALESCE(p_email_marketing_enabled, false) AND NOT COALESCE(p_sms_marketing_enabled, false) THEN now() ELSE NULL END)
  ON CONFLICT (customer_id) DO UPDATE SET
    email_marketing_enabled = EXCLUDED.email_marketing_enabled,
    sms_marketing_enabled = EXCLUDED.sms_marketing_enabled,
    consent_source = EXCLUDED.consent_source,
    consented_at = CASE WHEN EXCLUDED.email_marketing_enabled OR EXCLUDED.sms_marketing_enabled THEN now() ELSE public.customer_marketing_consents.consented_at END,
    revoked_at = CASE WHEN NOT EXCLUDED.email_marketing_enabled AND NOT EXCLUDED.sms_marketing_enabled THEN now() ELSE NULL END
  RETURNING * INTO v_consent;

  PERFORM public.log_privacy_event(v_org_id, v_customer_id, 'customer', 'marketing_consent_updated', 'customer_marketing_consents', v_consent.id, jsonb_build_object('email_marketing_enabled', v_consent.email_marketing_enabled, 'sms_marketing_enabled', v_consent.sms_marketing_enabled, 'consent_source', v_consent.consent_source));
  RETURN v_consent;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_update_privacy_export_job(p_job_id uuid, p_status text, p_download_url text DEFAULT NULL, p_expires_at timestamptz DEFAULT NULL, p_error_message text DEFAULT NULL)
RETURNS public.customer_privacy_export_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_job public.customer_privacy_export_jobs;
  v_request_id uuid;
BEGIN
  UPDATE public.customer_privacy_export_jobs j
  SET status = p_status, download_url = COALESCE(p_download_url, j.download_url),
    expires_at = COALESCE(p_expires_at, j.expires_at), error_message = p_error_message,
    processed_by = auth.uid(),
    started_at = CASE WHEN p_status = 'processing' AND j.started_at IS NULL THEN now() ELSE j.started_at END,
    completed_at = CASE WHEN p_status IN ('ready', 'failed', 'expired') THEN now() ELSE j.completed_at END
  WHERE j.id = p_job_id AND public.can_manage_org_settings(j.organization_id)
  RETURNING j.* INTO v_job;

  IF v_job.id IS NULL THEN RAISE EXCEPTION 'Export job not found or access denied.'; END IF;

  UPDATE public.customer_privacy_requests
  SET status = CASE WHEN p_status = 'ready' THEN 'completed' WHEN p_status = 'failed' THEN 'failed' WHEN p_status = 'processing' THEN 'processing' ELSE status END,
    processed_at = CASE WHEN p_status IN ('ready', 'failed') THEN now() ELSE processed_at END,
    processed_by = auth.uid()
  WHERE id = v_job.request_id;

  PERFORM public.log_privacy_event(v_job.organization_id, v_job.customer_id, 'admin', 'export_job_updated', 'customer_privacy_export_jobs', v_job.id, jsonb_build_object('status', v_job.status, 'expires_at', v_job.expires_at));
  RETURN v_job;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_process_deletion_request(p_request_id uuid, p_status text, p_admin_notes text DEFAULT NULL)
RETURNS public.customer_privacy_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_request public.customer_privacy_requests;
BEGIN
  IF p_status NOT IN ('processing', 'completed', 'rejected', 'cancelled') THEN RAISE EXCEPTION 'Unsupported status transition.'; END IF;

  UPDATE public.customer_privacy_requests r
  SET status = p_status, admin_notes = COALESCE(p_admin_notes, r.admin_notes),
    processed_at = CASE WHEN p_status IN ('completed', 'rejected', 'cancelled') THEN now() ELSE r.processed_at END,
    processed_by = auth.uid()
  WHERE r.id = p_request_id AND r.request_type = 'account_deletion' AND public.can_manage_org_settings(r.organization_id)
    AND (p_status <> 'completed' OR (r.confirmed_at IS NOT NULL AND r.grace_period_ends_at IS NOT NULL AND now() >= r.grace_period_ends_at))
  RETURNING r.* INTO v_request;

  IF v_request.id IS NULL THEN RAISE EXCEPTION 'Deletion request not found, not eligible, or access denied.'; END IF;

  PERFORM public.log_privacy_event(v_request.organization_id, v_request.customer_id, 'admin', 'deletion_request_updated', 'customer_privacy_requests', v_request.id, jsonb_build_object('status', v_request.status, 'processed_at', v_request.processed_at));
  RETURN v_request;
END; $$;

ALTER TABLE public.customer_privacy_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_privacy_export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_marketing_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customer can view own privacy requests" ON public.customer_privacy_requests;
CREATE POLICY "Customer can view own privacy requests"
  ON public.customer_privacy_requests FOR SELECT TO authenticated
  USING (customer_id = public.current_customer_id());

DROP POLICY IF EXISTS "Org admins can manage privacy requests" ON public.customer_privacy_requests;
CREATE POLICY "Org admins can manage privacy requests"
  ON public.customer_privacy_requests FOR ALL TO authenticated
  USING (public.can_manage_org_settings(organization_id))
  WITH CHECK (public.can_manage_org_settings(organization_id));

DROP POLICY IF EXISTS "Customer can view own export jobs" ON public.customer_privacy_export_jobs;
CREATE POLICY "Customer can view own export jobs"
  ON public.customer_privacy_export_jobs FOR SELECT TO authenticated
  USING (customer_id = public.current_customer_id());

DROP POLICY IF EXISTS "Org admins can manage export jobs" ON public.customer_privacy_export_jobs;
CREATE POLICY "Org admins can manage export jobs"
  ON public.customer_privacy_export_jobs FOR ALL TO authenticated
  USING (public.can_manage_org_settings(organization_id))
  WITH CHECK (public.can_manage_org_settings(organization_id));

DROP POLICY IF EXISTS "Customer can view own marketing consents" ON public.customer_marketing_consents;
CREATE POLICY "Customer can view own marketing consents"
  ON public.customer_marketing_consents FOR SELECT TO authenticated
  USING (customer_id = public.current_customer_id());

DROP POLICY IF EXISTS "Customer can update own marketing consents" ON public.customer_marketing_consents;
CREATE POLICY "Customer can update own marketing consents"
  ON public.customer_marketing_consents FOR ALL TO authenticated
  USING (customer_id = public.current_customer_id())
  WITH CHECK (customer_id = public.current_customer_id());

DROP POLICY IF EXISTS "Org admins can view marketing consents" ON public.customer_marketing_consents;
CREATE POLICY "Org admins can view marketing consents"
  ON public.customer_marketing_consents FOR SELECT TO authenticated
  USING (public.can_view_org_data(organization_id));

DROP POLICY IF EXISTS "Customer and admins can view privacy audit events" ON public.privacy_audit_events;
CREATE POLICY "Customer and admins can view privacy audit events"
  ON public.privacy_audit_events FOR SELECT TO authenticated
  USING (customer_id = public.current_customer_id() OR public.can_view_org_data(organization_id));

REVOKE INSERT, UPDATE, DELETE ON public.privacy_audit_events FROM authenticated;
GRANT SELECT ON public.privacy_audit_events TO authenticated;

GRANT EXECUTE ON FUNCTION public.submit_data_export_request() TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_account_deletion_request(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_account_deletion_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_my_marketing_consent(boolean, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_privacy_export_job(uuid, text, text, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_process_deletion_request(uuid, text, text) TO authenticated;

COMMENT ON TABLE public.privacy_audit_events IS 'Immutable audit log for privacy portal actions.';
