import { supabase } from '../lib/supabase';
import { PortalServiceError } from './customerPortalService';

export type PrivacyRequestType = 'data_export' | 'account_deletion';
export type PrivacyRequestStatus =
  | 'pending'
  | 'pending_confirmation'
  | 'scheduled'
  | 'processing'
  | 'completed'
  | 'cancelled'
  | 'rejected'
  | 'failed';

export type PrivacyExportJobStatus = 'queued' | 'processing' | 'ready' | 'failed' | 'expired';

export type CustomerPrivacyRequest = {
  id: string;
  customer_id: string;
  organization_id: string;
  request_type: PrivacyRequestType;
  status: PrivacyRequestStatus;
  confirmation_token: string | null;
  requested_at: string;
  confirmed_at: string | null;
  grace_period_ends_at: string | null;
  processed_at: string | null;
  processed_by: string | null;
  admin_notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CustomerPrivacyExportJob = {
  id: string;
  request_id: string;
  customer_id: string;
  organization_id: string;
  status: PrivacyExportJobStatus;
  download_url: string | null;
  file_size_bytes: number | null;
  expires_at: string | null;
  error_message: string | null;
  processed_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomerMarketingConsent = {
  id: string;
  customer_id: string;
  organization_id: string;
  email_marketing_enabled: boolean;
  consent_source: string;
  consented_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PrivacyAuditEvent = {
  id: string;
  organization_id: string;
  customer_id: string | null;
  actor_user_id: string | null;
  actor_type: 'customer' | 'admin' | 'system';
  event_type: string;
  subject_table: string;
  subject_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

const ensureSession = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    throw new PortalServiceError('SESSION_EXPIRED', 'Your session has expired. Please sign in again to continue.');
  }
};

const toError = (error: { message: string }) => new PortalServiceError('UNKNOWN', error.message);

export const privacyPortalService = {
  async getMyPrivacyRequests() {
    await ensureSession();
    const { data, error } = await supabase
      .from('customer_privacy_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw toError(error);
    return (data ?? []) as CustomerPrivacyRequest[];
  },

  async getMyExportJobs() {
    await ensureSession();
    const { data, error } = await supabase
      .from('customer_privacy_export_jobs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw toError(error);
    return (data ?? []) as CustomerPrivacyExportJob[];
  },

  async submitDataExportRequest() {
    await ensureSession();
    const { data, error } = await supabase.rpc('submit_data_export_request');
    if (error) throw toError(error);
    return data as CustomerPrivacyRequest;
  },

  async submitAccountDeletionRequest(gracePeriodDays = 30) {
    await ensureSession();
    const { data, error } = await supabase.rpc('submit_account_deletion_request', {
      p_grace_period_days: gracePeriodDays,
    });

    if (error) throw toError(error);
    return data as CustomerPrivacyRequest;
  },

  async confirmAccountDeletionRequest(requestId: string, confirmationToken: string) {
    await ensureSession();
    const { data, error } = await supabase.rpc('confirm_account_deletion_request', {
      p_request_id: requestId,
      p_confirmation_token: confirmationToken,
    });

    if (error) throw toError(error);
    return data as CustomerPrivacyRequest;
  },

  async getMyMarketingConsent() {
    await ensureSession();

    const { data: customerId, error: customerIdError } = await supabase.rpc('current_customer_id');
    if (customerIdError) throw toError(customerIdError);
    if (!customerId) return null;

    const { data, error } = await supabase
      .from('customer_marketing_consents')
      .select('*')
      .eq('customer_id', customerId)
      .maybeSingle();

    if (error) throw toError(error);
    return (data ?? null) as CustomerMarketingConsent | null;
  },

  async upsertMyMarketingConsent(payload: { emailEnabled: boolean }) {
    await ensureSession();
    const { data, error } = await supabase.rpc('upsert_my_marketing_consent', {
      p_email_marketing_enabled: payload.emailEnabled,
      p_consent_source: 'portal_privacy_center',
    });

    if (error) throw toError(error);
    return data as CustomerMarketingConsent;
  },

  async getAdminPrivacyRequests() {
    const { data, error } = await supabase
      .from('customer_privacy_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw toError(error);
    return (data ?? []) as CustomerPrivacyRequest[];
  },

  async getAdminExportJobs() {
    const { data, error } = await supabase
      .from('customer_privacy_export_jobs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw toError(error);
    return (data ?? []) as CustomerPrivacyExportJob[];
  },

  async getAdminMarketingConsents() {
    const { data, error } = await supabase
      .from('customer_marketing_consents')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw toError(error);
    return (data ?? []) as CustomerMarketingConsent[];
  },

  async getAdminPrivacyAuditTrail(limit = 200) {
    const { data, error } = await supabase
      .from('privacy_audit_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw toError(error);
    return (data ?? []) as PrivacyAuditEvent[];
  },

  async adminUpdateExportJob(jobId: string, status: PrivacyExportJobStatus, options?: { downloadUrl?: string; expiresAt?: string; errorMessage?: string }) {
    const { data, error } = await supabase.rpc('admin_update_privacy_export_job', {
      p_job_id: jobId,
      p_status: status,
      p_download_url: options?.downloadUrl ?? null,
      p_expires_at: options?.expiresAt ?? null,
      p_error_message: options?.errorMessage ?? null,
    });

    if (error) throw toError(error);
    return data as CustomerPrivacyExportJob;
  },

  async adminProcessDeletionRequest(requestId: string, status: 'processing' | 'completed' | 'rejected' | 'cancelled', adminNotes?: string) {
    const { data, error } = await supabase.rpc('admin_process_deletion_request', {
      p_request_id: requestId,
      p_status: status,
      p_admin_notes: adminNotes ?? null,
    });

    if (error) throw toError(error);
    return data as CustomerPrivacyRequest;
  },
};
