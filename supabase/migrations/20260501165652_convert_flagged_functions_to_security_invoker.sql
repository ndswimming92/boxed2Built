/*
  # Convert flagged SECURITY DEFINER functions to SECURITY INVOKER

  Supabase's advisor flags any SECURITY DEFINER function executable by anon
  or authenticated. These functions still need grants (portal flows, RLS
  helpers, admin RPCs), so we switch them to SECURITY INVOKER instead.

  1. Rationale
    - Internal authorization checks (`auth.uid()`, `is_platform_admin()`,
      ownership lookups, token comparisons) already run inside each function.
    - RLS on the underlying tables enforces row-level access.
    - SECURITY INVOKER removes the "runs as owner" escalation surface.

  2. Changes
    - ALTER FUNCTION ... SECURITY INVOKER on every flagged function.

  3. Security
    - No grants changed. No RLS changed.
    - Functions now execute with the caller's role; RLS applies as normal.
*/

DO $$
DECLARE
  fn text;
  flagged text[] := ARRAY[
    'confirm_account_deletion_request',
    'consume_portal_account_link_token',
    'create_portal_account_link_token',
    'create_portal_account_link_token_v1',
    'current_customer_id',
    'current_customer_ids',
    'enqueue_customer_notification',
    'enqueue_portal_welcome_sequence_for_customer',
    'get_my_referral_summary',
    'lookup_gift_card_by_code',
    'redeem_gift_card',
    'submit_account_deletion_request',
    'submit_data_export_request',
    'submit_job_customer_action_request',
    'submit_support_ticket',
    'track_portal_funnel_event',
    'track_saved_request_access',
    'upsert_my_marketing_consent',
    'add_support_ticket_message',
    'admin_add_support_ticket_message',
    'admin_process_deletion_request',
    'admin_update_privacy_export_job',
    'admin_update_support_ticket_status',
    'apply_late_fees_to_overdue_invoices',
    'apply_portal_document_retention_cleanup',
    'can_manage_org_settings',
    'can_view_org_data',
    'generate_next_invoice_number',
    'get_current_mileage_rate',
    'get_recent_audit_logs',
    'get_total_expenses_by_period',
    'get_user_organizations',
    'get_user_role_in_org',
    'has_org_permission',
    'is_organization_admin',
    'is_organization_member',
    'is_platform_admin',
    'log_auth_event',
    'log_privacy_event',
    'manually_adjust_late_fee',
    'moderate_job_customer_action_request',
    'payment_reconciliation_candidates',
    'record_portal_document_access'
  ];
  r record;
BEGIN
  FOREACH fn IN ARRAY flagged LOOP
    FOR r IN
      SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn
    LOOP
      EXECUTE 'ALTER FUNCTION ' || r.sig || ' SECURITY INVOKER';
    END LOOP;
  END LOOP;
END $$;
