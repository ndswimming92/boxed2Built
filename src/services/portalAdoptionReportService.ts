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

export type PortalAccountDeleteResult = {
  customerId: string;
  success: boolean;
  error?: string;
  email?: string | null;
  loginDeleted?: boolean;
  loginKeptReason?: string;
  clientsDeleted?: number;
  filesDeleted?: number;
};

/**
 * Permanently deletes portal accounts: the account, its portal data, uploaded
 * files, login and the CRM record with the same email. Jobs, invoices, bookings
 * and inquiries are kept but unlinked. Returns one result per account so a
 * partial failure in a bulk delete can be reported row by row.
 */
export async function deletePortalAccounts(customerIds: string[]): Promise<PortalAccountDeleteResult[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    throw new Error('You need to be signed in to delete portal accounts.');
  }

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-portal-account`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ customerIds }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!Array.isArray(payload?.results)) {
    throw new Error(typeof payload?.error === 'string' ? payload.error : 'Failed to delete the selected accounts.');
  }

  return payload.results as PortalAccountDeleteResult[];
}
