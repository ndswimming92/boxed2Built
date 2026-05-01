/*
  # Restore RLS helper functions to SECURITY DEFINER

  The previous migration converted all flagged functions to SECURITY INVOKER.
  However, functions called from within RLS policies MUST be SECURITY DEFINER
  because the calling role cannot access the tables these functions query
  (organization_members, customers, auth.users) without triggering infinite
  recursion or permission errors in RLS evaluation.

  1. Functions restored to SECURITY DEFINER
    - Organization RLS helpers: can_view_org_data, can_manage_org_settings,
      is_organization_member, is_organization_admin, is_platform_admin,
      has_org_permission, get_user_organizations, get_user_role_in_org
    - Customer portal RLS helpers: current_customer_id, current_customer_ids
    - Functions called from triggers that write across tables:
      enqueue_customer_notification, enqueue_portal_welcome_sequence_for_customer,
      log_auth_event, log_privacy_event

  2. Functions that remain SECURITY INVOKER
    - All other portal/admin RPCs that already have internal auth checks
    - Trigger-only functions already had all grants revoked in earlier migration

  3. Security
    - PUBLIC execute was already revoked by earlier migration.
    - These functions only have grants to authenticated (+ service_role).
*/

ALTER FUNCTION public.can_view_org_data(uuid) SECURITY DEFINER;
ALTER FUNCTION public.can_manage_org_settings(uuid) SECURITY DEFINER;
ALTER FUNCTION public.is_organization_member(uuid) SECURITY DEFINER;
ALTER FUNCTION public.is_organization_admin(uuid) SECURITY DEFINER;
ALTER FUNCTION public.is_platform_admin() SECURITY DEFINER;
ALTER FUNCTION public.has_org_permission(uuid, text) SECURITY DEFINER;
ALTER FUNCTION public.get_user_organizations() SECURITY DEFINER;
ALTER FUNCTION public.get_user_role_in_org(uuid) SECURITY DEFINER;
ALTER FUNCTION public.current_customer_id() SECURITY DEFINER;
ALTER FUNCTION public.current_customer_ids() SECURITY DEFINER;
ALTER FUNCTION public.enqueue_customer_notification(uuid, text, jsonb, boolean) SECURITY DEFINER;
ALTER FUNCTION public.enqueue_portal_welcome_sequence_for_customer(uuid) SECURITY DEFINER;
ALTER FUNCTION public.log_auth_event() SECURITY DEFINER;
ALTER FUNCTION public.log_privacy_event(uuid, uuid, text, text, text, uuid, jsonb) SECURITY DEFINER;
