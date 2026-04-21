/*
  # Remove SMS Marketing Features

  1. Changes
    - Drop views that reference marketing_sms_opt_in (dormant_clients, high_value_clients, repeat_customers)
    - Drop marketing_sms_opt_in column from clients
    - Drop sms_marketing_enabled column from customer_marketing_consents
    - Recreate views without SMS column
    - Replace upsert_my_marketing_consent function to remove sms parameter

  2. Notes
    - SMS/text messaging is being removed from the product entirely.
*/

DROP VIEW IF EXISTS public.dormant_clients;
DROP VIEW IF EXISTS public.high_value_clients;
DROP VIEW IF EXISTS public.repeat_customers;

DROP FUNCTION IF EXISTS public.upsert_my_marketing_consent(boolean, boolean, text);

ALTER TABLE public.clients DROP COLUMN IF EXISTS marketing_sms_opt_in;
ALTER TABLE public.customer_marketing_consents DROP COLUMN IF EXISTS sms_marketing_enabled;

CREATE OR REPLACE VIEW public.dormant_clients AS
SELECT id, organization_id, name, email, phone, address, client_status, client_value_tier,
  marketing_email_opt_in, opt_in_date, opt_out_date, last_campaign_date,
  first_contact_date, last_contact_date, last_job_date, total_revenue, job_count,
  average_job_value, source, tags, preferences_token, created_at, updated_at,
  EXTRACT(days FROM now() - last_contact_date)::integer AS days_since_contact
FROM clients c
WHERE last_contact_date < (now() - '90 days'::interval)
   OR (last_contact_date IS NULL AND created_at < (now() - '90 days'::interval));

CREATE OR REPLACE VIEW public.high_value_clients AS
SELECT id, organization_id, name, email, phone, address, client_status, client_value_tier,
  marketing_email_opt_in, opt_in_date, opt_out_date, last_campaign_date,
  first_contact_date, last_contact_date, last_job_date, total_revenue, job_count,
  average_job_value, source, tags, preferences_token, created_at, updated_at
FROM clients
WHERE client_value_tier = ANY (ARRAY['high_value'::client_value_tier, 'vip'::client_value_tier]);

CREATE OR REPLACE VIEW public.repeat_customers AS
SELECT id, organization_id, name, email, phone, address, client_status, client_value_tier,
  marketing_email_opt_in, opt_in_date, opt_out_date, last_campaign_date,
  first_contact_date, last_contact_date, last_job_date, total_revenue, job_count,
  average_job_value, source, tags, preferences_token, created_at, updated_at
FROM clients
WHERE job_count >= 2;

CREATE OR REPLACE FUNCTION public.upsert_my_marketing_consent(
  p_email_marketing_enabled boolean,
  p_consent_source text DEFAULT 'portal_privacy'::text
)
RETURNS customer_marketing_consents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_customer_id uuid := public.current_customer_id();
  v_org_id uuid;
  v_consent public.customer_marketing_consents;
BEGIN
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'No linked customer account found.';
  END IF;

  SELECT organization_id INTO v_org_id FROM public.customers WHERE id = v_customer_id;

  INSERT INTO public.customer_marketing_consents (
    customer_id, organization_id, email_marketing_enabled, consent_source, consented_at, revoked_at
  )
  VALUES (
    v_customer_id,
    v_org_id,
    COALESCE(p_email_marketing_enabled, false),
    COALESCE(NULLIF(BTRIM(p_consent_source), ''), 'portal_privacy'),
    CASE WHEN COALESCE(p_email_marketing_enabled, false) THEN now() ELSE NULL END,
    CASE WHEN NOT COALESCE(p_email_marketing_enabled, false) THEN now() ELSE NULL END
  )
  ON CONFLICT (customer_id) DO UPDATE SET
    email_marketing_enabled = EXCLUDED.email_marketing_enabled,
    consent_source = EXCLUDED.consent_source,
    consented_at = CASE WHEN EXCLUDED.email_marketing_enabled THEN now() ELSE public.customer_marketing_consents.consented_at END,
    revoked_at = CASE WHEN NOT EXCLUDED.email_marketing_enabled THEN now() ELSE NULL END
  RETURNING * INTO v_consent;

  PERFORM public.log_privacy_event(
    v_org_id, v_customer_id, 'customer', 'marketing_consent_updated',
    'customer_marketing_consents', v_consent.id,
    jsonb_build_object(
      'email_marketing_enabled', v_consent.email_marketing_enabled,
      'consent_source', v_consent.consent_source
    )
  );
  RETURN v_consent;
END;
$function$;