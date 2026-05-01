/*
  # Restore RPC functions to SECURITY DEFINER

  These functions are called via PostgREST RPC endpoints and need SECURITY DEFINER
  because they read from or write to RLS-protected tables. Each function already
  contains internal authorization checks (auth.uid(), ownership verification,
  is_platform_admin() checks, etc.) and has SET search_path for safety.

  1. Public-facing functions (gift cards, portal linking, saved requests)
    - lookup_gift_card_by_code, redeem_gift_card
    - consume_portal_account_link_token, create_portal_account_link_token,
      create_portal_account_link_token_v1
    - track_saved_request_access (both overloads)
    - confirm_account_deletion_request

  2. Authenticated portal functions (customer self-service)
    - submit_account_deletion_request, submit_data_export_request
    - submit_job_customer_action_request, submit_support_ticket
    - add_support_ticket_message, track_portal_funnel_event
    - upsert_my_marketing_consent, get_my_referral_summary
    - record_portal_document_access

  3. Admin-only functions (internal checks for platform admin)
    - admin_add_support_ticket_message, admin_process_deletion_request
    - admin_update_privacy_export_job, admin_update_support_ticket_status
    - apply_late_fees_to_overdue_invoices, apply_portal_document_retention_cleanup
    - generate_next_invoice_number, get_current_mileage_rate
    - get_recent_audit_logs, get_total_expenses_by_period
    - manually_adjust_late_fee, moderate_job_customer_action_request
    - payment_reconciliation_candidates

  4. Security
    - All functions retain SET search_path = 'public'
    - All functions contain internal authorization logic
    - No new grants added
*/

DO $$
DECLARE
  fn text;
  fns_to_restore text[] := ARRAY[
    'lookup_gift_card_by_code',
    'redeem_gift_card',
    'consume_portal_account_link_token',
    'create_portal_account_link_token',
    'create_portal_account_link_token_v1',
    'track_saved_request_access',
    'confirm_account_deletion_request',
    'submit_account_deletion_request',
    'submit_data_export_request',
    'submit_job_customer_action_request',
    'submit_support_ticket',
    'add_support_ticket_message',
    'track_portal_funnel_event',
    'upsert_my_marketing_consent',
    'get_my_referral_summary',
    'record_portal_document_access',
    'admin_add_support_ticket_message',
    'admin_process_deletion_request',
    'admin_update_privacy_export_job',
    'admin_update_support_ticket_status',
    'apply_late_fees_to_overdue_invoices',
    'apply_portal_document_retention_cleanup',
    'generate_next_invoice_number',
    'get_current_mileage_rate',
    'get_recent_audit_logs',
    'get_total_expenses_by_period',
    'manually_adjust_late_fee',
    'moderate_job_customer_action_request',
    'payment_reconciliation_candidates'
  ];
  r record;
BEGIN
  FOREACH fn IN ARRAY fns_to_restore LOOP
    FOR r IN
      SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn
    LOOP
      EXECUTE 'ALTER FUNCTION ' || r.sig || ' SECURITY DEFINER';
    END LOOP;
  END LOOP;
END $$;
