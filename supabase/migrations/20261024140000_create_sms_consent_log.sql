-- Append-only audit log of SMS consent: every opt-in and every opt-out.
-- Opt-ins are written by the log-sms-consent edge function (service role) so
-- the visitor's IP address and browser can be recorded. Opt-outs are recorded
-- by an admin from the SMS Consent Log page. Rows can never be edited or
-- deleted, even by an admin.
CREATE TABLE IF NOT EXISTS public.sms_consent_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL CHECK (event_type IN ('opt_in', 'opt_out')),
  organization_id uuid,
  business_id uuid,
  inquiry_id uuid,
  confirmation_code text,
  name text,
  email text,
  phone text NOT NULL,
  phone_digits text NOT NULL,
  service_texts boolean NOT NULL DEFAULT false,
  marketing_texts boolean NOT NULL DEFAULT false,
  consent_text text,
  consent_version text,
  consent_given_at timestamptz,
  source_page text,
  ip_address text,
  user_agent text,
  recorded_by text NOT NULL DEFAULT 'website',
  notes text
);

CREATE UNIQUE INDEX IF NOT EXISTS sms_consent_log_one_opt_in_per_inquiry
  ON public.sms_consent_log (inquiry_id) WHERE event_type = 'opt_in' AND inquiry_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sms_consent_log_created_at_idx ON public.sms_consent_log (created_at DESC);
CREATE INDEX IF NOT EXISTS sms_consent_log_phone_digits_idx ON public.sms_consent_log (phone_digits);

ALTER TABLE public.sms_consent_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read SMS consent log"
  ON public.sms_consent_log FOR SELECT TO authenticated
  USING (public.is_platform_admin());

-- Admins may only add opt-out rows by hand; opt-ins come from the edge function.
CREATE POLICY "Admins can record SMS opt-outs"
  ON public.sms_consent_log FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin() AND event_type = 'opt_out');

CREATE OR REPLACE FUNCTION public.sms_consent_log_block_changes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'sms_consent_log is append-only';
END;
$$;

DROP TRIGGER IF EXISTS sms_consent_log_no_update_delete ON public.sms_consent_log;
CREATE TRIGGER sms_consent_log_no_update_delete
  BEFORE UPDATE OR DELETE ON public.sms_consent_log
  FOR EACH ROW EXECUTE FUNCTION public.sms_consent_log_block_changes();
