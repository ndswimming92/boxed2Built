/*
  # Fix SECURITY DEFINER and Public Execution Exposure

  1. Views with SECURITY DEFINER
    - Recreate `dormant_clients`, `repeat_customers`, `high_value_clients` without SECURITY DEFINER
  
  2. Functions Requiring Authentication
    - Revoke public (anon) EXECUTE on functions that require authentication
  
  3. Security Changes
    - Drop and recreate views without SECURITY DEFINER
    - Revoke unnecessary public execute permissions on admin functions
    - Keep RLS policies as primary access control
*/

DO $$
BEGIN
  -- Drop views that depend on SECURITY DEFINER functions
  DROP VIEW IF EXISTS public.dormant_clients CASCADE;
  DROP VIEW IF EXISTS public.repeat_customers CASCADE;
  DROP VIEW IF EXISTS public.high_value_clients CASCADE;
END $$;

-- Recreate views without SECURITY DEFINER
CREATE OR REPLACE VIEW public.dormant_clients AS
SELECT 
  c.id,
  c.organization_id,
  c.name,
  c.email,
  c.phone,
  c.last_contact_date,
  c.created_at,
  c.client_status,
  COUNT(j.id) as job_count,
  SUM(CASE WHEN j.job_status = 'completed' THEN 1 ELSE 0 END) as completed_jobs
FROM clients c
LEFT JOIN jobs j ON c.id = j.client_id
WHERE c.last_contact_date < NOW() - INTERVAL '90 days'
GROUP BY c.id, c.organization_id, c.name, c.email, c.phone, c.last_contact_date, c.created_at, c.client_status;

CREATE OR REPLACE VIEW public.repeat_customers AS
SELECT 
  c.id,
  c.organization_id,
  c.name,
  c.email,
  c.phone,
  COUNT(j.id) as total_jobs,
  SUM(CASE WHEN j.job_status = 'completed' THEN 1 ELSE 0 END) as completed_jobs,
  MAX(j.created_at) as last_job_date
FROM clients c
LEFT JOIN jobs j ON c.id = j.client_id
GROUP BY c.id, c.organization_id, c.name, c.email, c.phone
HAVING COUNT(j.id) > 1
ORDER BY total_jobs DESC;

CREATE OR REPLACE VIEW public.high_value_clients AS
SELECT 
  c.id,
  c.organization_id,
  c.name,
  c.email,
  c.phone,
  c.client_status,
  COUNT(j.id) as total_jobs,
  SUM(CASE WHEN j.job_status = 'completed' THEN 1 ELSE 0 END) as completed_jobs,
  c.total_revenue as lifetime_value
FROM clients c
LEFT JOIN jobs j ON c.id = j.client_id
WHERE c.total_revenue > 500
GROUP BY c.id, c.organization_id, c.name, c.email, c.phone, c.client_status, c.total_revenue
ORDER BY c.total_revenue DESC;

-- Revoke EXECUTE on internal admin functions from public (anon) role
REVOKE EXECUTE ON FUNCTION public.add_referral_credit_on_inquiry_insert() FROM anon;
REVOKE EXECUTE ON FUNCTION public.add_support_ticket_message(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_add_support_ticket_message(uuid, text, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_process_deletion_request(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_privacy_export_job(uuid, text, text, timestamptz, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_support_ticket_status(uuid, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_late_fees_to_overdue_invoices() FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_portal_document_retention_cleanup() FROM anon;
REVOKE EXECUTE ON FUNCTION public.assign_referral_code_on_insert() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_create_client_from_inquiry() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_upsert_client_from_job() FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_goal_progress() FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_late_fee(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_line_item_total() FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_quarter_from_date(date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_org_settings(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_view_org_data(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_next_invoice_number(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_preferences_token() FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_unique_referral_code(text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_current_mileage_rate(uuid, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_recent_audit_logs(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_total_expenses_by_period(uuid, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_organizations() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role_in_org(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_org_permission(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_organization_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_organization_member(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_platform_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_auth_event() FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_privacy_event(uuid, uuid, text, text, text, uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.manually_adjust_late_fee(uuid, numeric, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.moderate_job_customer_action_request(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.payment_reconciliation_candidates(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_portal_document_access(uuid, text, inet, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.refresh_business_total_client_hours_saved(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_expense_calculated_fields() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_invoice_customer_and_client_ids() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_completion_price_from_job() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_invoice_payment_from_job() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trg_fn_sync_hours_saved() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trigger_refresh_metrics_on_followup_email() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trigger_update_client_metrics_from_job() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_app_branding_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_business_address_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_business_attributes_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_business_goals_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_business_hours_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_business_info_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_client_metrics(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_customer_reviews_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_forecast_settings_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_form_inquiries_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_gallery_items_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_invoice_payment_status() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_invoice_totals() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_job_mileage_totals() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_job_on_completion() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_job_status_timestamp() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_jobs_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_mileage_records_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_notification_bar_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_overdue_goals() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_payment_methods_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_qr_code_timestamp() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_quarterly_tax_payments_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_revenue_forecasts_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_saved_requests_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_service_areas_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_services_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_social_media_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_tax_calculations_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_tax_settings_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon;
REVOKE EXECUTE ON FUNCTION public.upsert_client_by_email(uuid, text, text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.upsert_client_by_phone(uuid, text, text, text) FROM anon;

-- Grant to authenticated role for admin functions
GRANT EXECUTE ON FUNCTION public.add_referral_credit_on_inquiry_insert() TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_support_ticket_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_support_ticket_message(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_process_deletion_request(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_privacy_export_job(uuid, text, text, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_support_ticket_status(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_late_fees_to_overdue_invoices() TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_portal_document_retention_cleanup() TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_referral_code_on_insert() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_create_client_from_inquiry() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_upsert_client_from_job() TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_goal_progress() TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_late_fee(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_line_item_total() TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_quarter_from_date(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_org_settings(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_org_data(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_next_invoice_number(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_preferences_token() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_unique_referral_code(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_mileage_rate(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recent_audit_logs(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_total_expenses_by_period(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_organizations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role_in_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_permission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_organization_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_organization_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_auth_event() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_privacy_event(uuid, uuid, text, text, text, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manually_adjust_late_fee(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderate_job_customer_action_request(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.payment_reconciliation_candidates(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_portal_document_access(uuid, text, inet, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_business_total_client_hours_saved(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_expense_calculated_fields() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_invoice_customer_and_client_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_completion_price_from_job() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_invoice_payment_from_job() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trg_fn_sync_hours_saved() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_refresh_metrics_on_followup_email() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_update_client_metrics_from_job() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_app_branding_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_business_address_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_business_attributes_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_business_goals_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_business_hours_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_business_info_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_client_metrics(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_customer_reviews_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_forecast_settings_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_form_inquiries_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_gallery_items_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_invoice_payment_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_invoice_totals() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_job_mileage_totals() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_job_on_completion() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_job_status_timestamp() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_jobs_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_mileage_records_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_notification_bar_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_overdue_goals() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_payment_methods_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_qr_code_timestamp() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_quarterly_tax_payments_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_revenue_forecasts_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_saved_requests_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_service_areas_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_services_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_social_media_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_tax_calculations_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_tax_settings_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_client_by_email(uuid, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_client_by_phone(uuid, text, text, text) TO authenticated;
