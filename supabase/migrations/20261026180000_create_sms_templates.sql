-- Templates submitted to Sent (sent.dm) from Admin > SMS Templates: the exact
-- wording that went to review, the ID Sent gave back, and its last known
-- review status. Rows are written by the manage-sent-templates edge function
-- (service role); admins can only read them.
CREATE TABLE IF NOT EXISTS public.sms_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_by text,
  secret_name text,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('UTILITY', 'MARKETING')),
  body text NOT NULL,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  sent_template_id text NOT NULL UNIQUE,
  sent_status text,
  status_checked_at timestamptz
);

CREATE INDEX IF NOT EXISTS sms_templates_created_at_idx ON public.sms_templates (created_at DESC);

ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read SMS templates"
  ON public.sms_templates FOR SELECT TO authenticated
  USING (public.is_platform_admin());
