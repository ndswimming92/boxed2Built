/*
  # Fix Security Definer exposure (v2)

  Previous fix migration revoked EXECUTE from anon/authenticated but did NOT
  revoke the default PUBLIC grant, so SECURITY DEFINER functions remained
  callable via PostgREST by any role. Views also still lacked the
  security_invoker reloption.

  1. Views
    - Set `security_invoker = on` on dormant_clients, repeat_customers,
      high_value_clients so they enforce the caller's RLS instead of the
      view owner's privileges.

  2. Trigger-only functions
    - REVOKE EXECUTE FROM PUBLIC and authenticated. These functions only run
      inside trigger contexts; REST callers never need them.

  3. Admin-only SECURITY DEFINER functions
    - REVOKE EXECUTE FROM PUBLIC. Keep GRANT TO authenticated for helpers that
      RLS policies call (org/role checks); internal admin operations still
      rely on RLS inside the function body.

  4. Customer/portal-callable SECURITY DEFINER functions
    - REVOKE EXECUTE FROM PUBLIC, keep explicit grants to anon/authenticated.

  5. Security
    - Default PUBLIC grant removed on every SECURITY DEFINER function.
    - No RLS policies changed.
*/

-- 1. Views: enable security_invoker so the caller's RLS applies
ALTER VIEW IF EXISTS public.dormant_clients SET (security_invoker = on);
ALTER VIEW IF EXISTS public.repeat_customers SET (security_invoker = on);
ALTER VIEW IF EXISTS public.high_value_clients SET (security_invoker = on);

-- 2. Trigger-only functions: revoke from PUBLIC and authenticated
DO $$
DECLARE
  fn text;
  trigger_only text[] := ARRAY[
    'add_referral_credit_on_inquiry_insert',
    'assign_referral_code_on_insert',
    'auto_create_client_from_inquiry',
    'auto_upsert_client_from_job',
    'calculate_goal_progress',
    'calculate_late_fee',
    'calculate_line_item_total',
    'calculate_quarter_from_date',
    'generate_preferences_token',
    'generate_unique_referral_code',
    'refresh_business_total_client_hours_saved',
    'set_expense_calculated_fields',
    'set_invoice_customer_and_client_ids',
    'sync_completion_price_from_job',
    'sync_invoice_payment_from_job',
    'trg_fn_sync_hours_saved',
    'trigger_refresh_metrics_on_followup_email',
    'trigger_update_client_metrics_from_job',
    'update_app_branding_updated_at',
    'update_business_address_updated_at',
    'update_business_attributes_updated_at',
    'update_business_goals_updated_at',
    'update_business_hours_updated_at',
    'update_business_info_updated_at',
    'update_client_metrics',
    'update_customer_reviews_updated_at',
    'update_forecast_settings_updated_at',
    'update_form_inquiries_updated_at',
    'update_gallery_items_updated_at',
    'update_invoice_payment_status',
    'update_invoice_totals',
    'update_job_mileage_totals',
    'update_job_on_completion',
    'update_job_status_timestamp',
    'update_jobs_updated_at',
    'update_mileage_records_updated_at',
    'update_notification_bar_updated_at',
    'update_overdue_goals',
    'update_payment_methods_updated_at',
    'update_qr_code_timestamp',
    'update_quarterly_tax_payments_updated_at',
    'update_revenue_forecasts_updated_at',
    'update_saved_requests_updated_at',
    'update_service_areas_updated_at',
    'update_services_updated_at',
    'update_social_media_updated_at',
    'update_tax_calculations_updated_at',
    'update_tax_settings_updated_at',
    'update_updated_at_column',
    'upsert_client_by_email',
    'upsert_client_by_phone'
  ];
  r record;
BEGIN
  FOREACH fn IN ARRAY trigger_only LOOP
    FOR r IN
      SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn
    LOOP
      EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.sig || ' FROM PUBLIC';
      EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.sig || ' FROM anon';
      EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.sig || ' FROM authenticated';
    END LOOP;
  END LOOP;
END $$;

-- 3. Admin/auth-helper functions: revoke PUBLIC, keep authenticated
DO $$
DECLARE
  fn text;
  admin_fns text[] := ARRAY[
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
  FOREACH fn IN ARRAY admin_fns LOOP
    FOR r IN
      SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn
    LOOP
      EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.sig || ' FROM PUBLIC';
      EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.sig || ' FROM anon';
      EXECUTE 'GRANT EXECUTE ON FUNCTION ' || r.sig || ' TO authenticated';
    END LOOP;
  END LOOP;
END $$;

-- 4. Customer/portal-callable functions: revoke PUBLIC, keep anon + authenticated
DO $$
DECLARE
  fn text;
  portal_fns text[] := ARRAY[
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
    'upsert_my_marketing_consent'
  ];
  r record;
BEGIN
  FOREACH fn IN ARRAY portal_fns LOOP
    FOR r IN
      SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn
    LOOP
      EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.sig || ' FROM PUBLIC';
      EXECUTE 'GRANT EXECUTE ON FUNCTION ' || r.sig || ' TO anon';
      EXECUTE 'GRANT EXECUTE ON FUNCTION ' || r.sig || ' TO authenticated';
    END LOOP;
  END LOOP;
END $$;
