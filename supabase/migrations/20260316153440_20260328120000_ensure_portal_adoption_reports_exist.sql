/*
  # Ensure portal adoption report relations exist

  Some environments may have missed the original migration that added
  portal adoption reporting views, which causes PostgREST schema-cache
  errors when querying `public.portal_adoption_report`.

  This migration defensively creates the reporting views only when they
  are absent, then reapplies authenticated read grants.
*/

DO $$
BEGIN
  IF to_regclass('public.portal_adoption_report') IS NULL THEN
    EXECUTE $view$
      CREATE VIEW public.portal_adoption_report AS
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
      GROUP BY c.organization_id, c.id, c.full_name, c.email, c.invited_at
    $view$;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('public.portal_inactive_customers_report') IS NULL THEN
    EXECUTE $view$
      CREATE VIEW public.portal_inactive_customers_report AS
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
      FROM public.portal_adoption_report r
    $view$;
  END IF;
END
$$;

GRANT SELECT ON public.portal_adoption_report TO authenticated;
GRANT SELECT ON public.portal_inactive_customers_report TO authenticated;
