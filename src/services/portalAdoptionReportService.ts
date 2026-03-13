import { supabase } from '../lib/supabase';

export type PortalAdoptionReportRow = {
  organization_id: string;
  customer_id: string;
  full_name: string | null;
  email: string | null;
  invited_at: string | null;
  first_login_at: string | null;
  first_job_view_at: string | null;
  repeat_login_at: string | null;
  funnel_stage: 'invite_sent' | 'login' | 'first_job_view' | 'repeat_login' | 'not_invited';
  login_count: number;
  last_portal_activity_at: string | null;
};

export type PortalInactiveCustomerRow = {
  organization_id: string;
  customer_id: string;
  full_name: string | null;
  email: string | null;
  invited_at: string | null;
  first_login_at: string | null;
  last_portal_activity_at: string | null;
  inactive_days: number;
  inactivity_status: 'invited_never_logged_in' | 'inactive_30_plus_days' | 'active';
};

export async function getPortalAdoptionReport() {
  const { data, error } = await supabase
    .from('portal_adoption_report')
    .select('organization_id, customer_id, full_name, email, invited_at, first_login_at, first_job_view_at, repeat_login_at, funnel_stage, login_count, last_portal_activity_at')
    .order('invited_at', { ascending: false, nullsFirst: false });

  if (error) {
    throw new Error(`Failed to load portal adoption report: ${error.message}`);
  }

  return (data ?? []) as PortalAdoptionReportRow[];
}

export async function getPortalInactiveCustomersReport() {
  const { data, error } = await supabase
    .from('portal_inactive_customers_report')
    .select('organization_id, customer_id, full_name, email, invited_at, first_login_at, last_portal_activity_at, inactive_days, inactivity_status')
    .in('inactivity_status', ['invited_never_logged_in', 'inactive_30_plus_days'])
    .order('inactive_days', { ascending: false });

  if (error) {
    throw new Error(`Failed to load inactive customers report: ${error.message}`);
  }

  return (data ?? []) as PortalInactiveCustomerRow[];
}
