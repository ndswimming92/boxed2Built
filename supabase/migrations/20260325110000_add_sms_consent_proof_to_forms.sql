-- Track explicit SMS consent and proof-of-consent details for website forms.
ALTER TABLE public.form_inquiries
  ADD COLUMN IF NOT EXISTS sms_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_consent_text text,
  ADD COLUMN IF NOT EXISTS sms_consent_timestamp timestamptz;

ALTER TABLE public.saved_requests
  ADD COLUMN IF NOT EXISTS sms_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_consent_text text,
  ADD COLUMN IF NOT EXISTS sms_consent_timestamp timestamptz;
