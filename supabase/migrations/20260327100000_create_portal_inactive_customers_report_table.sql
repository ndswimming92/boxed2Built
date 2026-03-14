BEGIN;

DROP VIEW IF EXISTS public.portal_inactive_customers_report;

CREATE TABLE IF NOT EXISTS public.portal_inactive_customers_report (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id uuid PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
  full_name text,
  email text,
  invited_at timestamptz,
  first_login_at timestamptz,
  last_portal_activity_at timestamptz,
  inactive_days integer NOT NULL DEFAULT 0,
  inactivity_status text NOT NULL DEFAULT 'active' CHECK (
    inactivity_status IN ('invited_never_logged_in', 'inactive_30_plus_days', 'active')
  ),
  refreshed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_inactive_customers_report_org_status
  ON public.portal_inactive_customers_report (organization_id, inactivity_status);

CREATE INDEX IF NOT EXISTS idx_portal_inactive_customers_report_inactive_days
  ON public.portal_inactive_customers_report (inactive_days DESC);

INSERT INTO public.portal_inactive_customers_report (
  organization_id,
  customer_id,
  full_name,
  email,
  invited_at,
  first_login_at,
  last_portal_activity_at,
  inactive_days,
  inactivity_status
)
SELECT
  r.organization_id,
  r.customer_id,
  r.full_name,
  r.email,
  r.invited_at,
  r.first_login_at,
  r.last_portal_activity_at,
  GREATEST(
    0,
    floor(
      EXTRACT(epoch FROM (now() - COALESCE(r.last_portal_activity_at, r.invited_at, now()))) / 86400
    )
  )::integer AS inactive_days,
  CASE
    WHEN r.first_login_at IS NULL AND r.invited_at IS NOT NULL THEN 'invited_never_logged_in'
    WHEN r.last_portal_activity_at < now() - interval '30 days' THEN 'inactive_30_plus_days'
    ELSE 'active'
  END AS inactivity_status
FROM public.portal_adoption_report r
ON CONFLICT (customer_id)
DO UPDATE SET
  organization_id = EXCLUDED.organization_id,
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  invited_at = EXCLUDED.invited_at,
  first_login_at = EXCLUDED.first_login_at,
  last_portal_activity_at = EXCLUDED.last_portal_activity_at,
  inactive_days = EXCLUDED.inactive_days,
  inactivity_status = EXCLUDED.inactivity_status,
  refreshed_at = now();

GRANT SELECT ON public.portal_inactive_customers_report TO authenticated;
GRANT ALL ON public.portal_inactive_customers_report TO service_role;

COMMIT;
