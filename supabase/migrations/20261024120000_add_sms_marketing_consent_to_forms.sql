-- Separate, optional consent for promotional texts (service-text consent is
-- sms_opt_in). sms_consent_text records the exact wording the customer ticked.
ALTER TABLE public.form_inquiries
  ADD COLUMN IF NOT EXISTS sms_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_marketing_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_consent_text text,
  ADD COLUMN IF NOT EXISTS sms_consent_timestamp timestamptz;

ALTER TABLE public.saved_requests
  ADD COLUMN IF NOT EXISTS sms_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_marketing_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_consent_text text,
  ADD COLUMN IF NOT EXISTS sms_consent_timestamp timestamptz;

-- Admin on/off switch for the SMS opt-in checkboxes on the service form.
ALTER TABLE public.business_info
  ADD COLUMN IF NOT EXISTS sms_opt_in_enabled boolean NOT NULL DEFAULT true;
