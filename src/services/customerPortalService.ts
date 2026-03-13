import { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { retryWithBackoff } from '../utils/retry';

export type PortalServiceErrorCode =
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'SESSION_EXPIRED'
  | 'MISCONFIGURED'
  | 'UNKNOWN';

export class PortalServiceError extends Error {
  code: PortalServiceErrorCode;

  constructor(code: PortalServiceErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'PortalServiceError';
  }
}

export type PortalFunnelEventType = 'login' | 'first_job_view' | 'walkthrough_completed';

export type CustomerPortalProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
};

type CustomerPortalProfileUpdatePayload = {
  full_name: string | null;
  phone: string | null;
};

export type CustomerPortalJob = {
  id: string;
  job_type: string | null;
  job_description: string | null;
  date_scheduled: string | null;
  date_completed: string | null;
  job_status: 'quoted' | 'accepted' | 'scheduled' | 'in_progress' | 'completed' | 'lost' | 'cancelled';
  quoted_price: number | null;
  final_price: number | null;
  location_city: string | null;
  created_at: string;
  updated_at: string;
};

export type JobActionRequestType = 'request_reschedule' | 'cancel_request' | 'add_note';
export type JobActionRequestState = 'pending' | 'approved' | 'rejected';

export type CustomerJobActionRequest = {
  id: string;
  job_id: string;
  action_type: JobActionRequestType;
  request_message: string | null;
  requested_schedule_date: string | null;
  request_state: JobActionRequestState;
  moderation_note: string | null;
  moderated_at: string | null;
  created_at: string;
  updated_at: string;
};


export type CustomerPortalDocument = {
  id: string;
  document_type: string;
  display_name: string;
  storage_bucket: string;
  storage_path: string;
  related_job_id: string | null;
  related_invoice_id: string | null;
  metadata: Record<string, unknown>;
  delete_after_at: string | null;
  created_at: string;
};

export type DocumentAccessMode = 'view' | 'download';


export type PortalCheckoutSessionResponse = {
  url: string;
};

export type CustomerPortalInvoice = {
  id: string;
  invoice_number: string;
  invoice_type: 'estimate' | 'deposit' | 'progress' | 'final' | 'general';
  invoice_date: string;
  due_date: string;
  payment_terms: string;
  payment_terms_description: string | null;
  status: 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
};

const normalizePortalError = (error: PostgrestError | null, fallbackMessage: string): PortalServiceError => {
  if (!error) {
    return new PortalServiceError('UNKNOWN', fallbackMessage);
  }

  if (error.code === 'PGRST116') {
    return new PortalServiceError('NOT_FOUND', 'Requested record was not found.');
  }

  if (error.code === '42501') {
    return new PortalServiceError('UNAUTHORIZED', 'You are not authorized to access this resource.');
  }

  const lowerMessage = `${error.message} ${error.details ?? ''}`.toLowerCase();
  if (error.code === '42P01' || error.code === 'PGRST205' || lowerMessage.includes('schema cache') || lowerMessage.includes('could not find the table')) {
    return new PortalServiceError(
      'MISCONFIGURED',
      'Client portal setup is incomplete. The customer database tables are missing in this environment. Run the latest Supabase migrations (for example: `supabase db push`) and refresh the page.'
    );
  }

  return new PortalServiceError('UNKNOWN', fallbackMessage);
};

const ensureAuthenticatedSession = async () => {
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session) {
    throw new PortalServiceError(
      'SESSION_EXPIRED',
      'Your session has expired. Please sign in again to continue.'
    );
  }

  return data.session;
};

export const customerPortalService = {
  async getMyJobs(options?: { page?: number; pageSize?: number }): Promise<CustomerPortalJob[]> {
    await ensureAuthenticatedSession();

    const page = options?.page ?? 0;
    const pageSize = options?.pageSize ?? 25;
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await retryWithBackoff(async () =>
      supabase
        .from('jobs')
        .select('id, job_type, job_description, date_scheduled, date_completed, job_status, quoted_price, final_price, location_city, created_at, updated_at')
        .order('date_scheduled', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .range(from, to)
    );

    if (error) {
      throw normalizePortalError(error, `Failed to fetch jobs: ${error.message}`);
    }

    return data ?? [];
  },

  async getMyJobById(jobId: string): Promise<CustomerPortalJob> {
    await ensureAuthenticatedSession();

    const { data, error } = await supabase
      .from('jobs')
      .select('id, job_type, job_description, date_scheduled, date_completed, job_status, quoted_price, final_price, location_city, created_at, updated_at')
      .eq('id', jobId)
      .single();

    if (error) {
      throw normalizePortalError(error, `Failed to fetch job: ${error.message}`);
    }

    return data;
  },

  async getMyJobActionRequests(jobId: string): Promise<CustomerJobActionRequest[]> {
    await ensureAuthenticatedSession();

    const { data, error } = await supabase
      .from('job_customer_action_requests')
      .select('id, job_id, action_type, request_message, requested_schedule_date, request_state, moderation_note, moderated_at, created_at, updated_at')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false });

    if (error) {
      throw normalizePortalError(error, `Failed to fetch job action requests: ${error.message}`);
    }

    return (data ?? []) as CustomerJobActionRequest[];
  },

  async submitJobActionRequest(payload: {
    jobId: string;
    actionType: JobActionRequestType;
    requestMessage?: string | null;
    requestedScheduleDate?: string | null;
  }): Promise<CustomerJobActionRequest> {
    await ensureAuthenticatedSession();

    const { data, error } = await supabase.rpc('submit_job_customer_action_request', {
      p_job_id: payload.jobId,
      p_action_type: payload.actionType,
      p_request_message: payload.requestMessage ?? null,
      p_requested_schedule_date: payload.requestedScheduleDate ?? null,
    });

    if (error) {
      throw normalizePortalError(error, `Failed to submit request: ${error.message}`);
    }

    return data as CustomerJobActionRequest;
  },

  async getMyInvoices(options?: { page?: number; pageSize?: number }): Promise<CustomerPortalInvoice[]> {
    await ensureAuthenticatedSession();

    const page = options?.page ?? 0;
    const pageSize = options?.pageSize ?? 25;
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await retryWithBackoff(async () =>
      supabase
        .from('invoices')
        .select('id, invoice_number, invoice_type, invoice_date, due_date, payment_terms, payment_terms_description, status, subtotal, tax_amount, total_amount, amount_paid, amount_due, sent_at, paid_at, created_at')
        .order('invoice_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to)
    );

    if (error) {
      throw normalizePortalError(error, `Failed to fetch invoices: ${error.message}`);
    }

    return data ?? [];
  },


  async createInvoiceCheckoutSession(invoiceId: string): Promise<string> {
    const session = await ensureAuthenticatedSession();

    const response = await retryWithBackoff(() => fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ invoiceId, source: 'portal' }),
    }));

    const data = (await response.json().catch(() => ({}))) as Partial<PortalCheckoutSessionResponse> & { error?: string };

    if (!response.ok || !data.url) {
      throw new PortalServiceError('UNKNOWN', data.error || 'Unable to start secure checkout session.');
    }

    return data.url;
  },

  async getMyDocuments(): Promise<CustomerPortalDocument[]> {
    await ensureAuthenticatedSession();

    const { data, error } = await supabase
      .from('portal_documents')
      .select('id, document_type, display_name, storage_bucket, storage_path, related_job_id, related_invoice_id, metadata, delete_after_at, created_at')
      .is('deleted_at', null)
      .eq('is_visible_to_customer', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw normalizePortalError(error, `Failed to fetch documents: ${error.message}`);
    }

    return (data ?? []) as CustomerPortalDocument[];
  },

  async getDocumentSignedUrl(documentId: string, mode: DocumentAccessMode): Promise<string> {
    await ensureAuthenticatedSession();

    const { data: documentRow, error: documentError } = await supabase
      .from('portal_documents')
      .select('id, storage_bucket, storage_path')
      .eq('id', documentId)
      .single();

    if (documentError) {
      throw normalizePortalError(documentError, `Failed to locate document: ${documentError.message}`);
    }

    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;

    const { error: auditError } = await supabase.rpc('record_portal_document_access', {
      p_document_id: documentId,
      p_event_type: mode,
      p_user_agent: userAgent,
    });

    if (auditError) {
      throw normalizePortalError(auditError, `Failed to audit document access: ${auditError.message}`);
    }

    const { data, error } = await supabase.storage
      .from(documentRow.storage_bucket)
      .createSignedUrl(documentRow.storage_path, 120, {
        download: mode === 'download',
      });

    if (error || !data?.signedUrl) {
      throw new PortalServiceError('UNKNOWN', `Failed to create secure document URL: ${error?.message ?? 'Unknown storage error.'}`);
    }

    return data.signedUrl;
  },

  async getMyProfile(): Promise<CustomerPortalProfile> {
    await ensureAuthenticatedSession();

    const { data, error } = await supabase
      .from('customers')
      .select('id, full_name, email, phone, created_at, updated_at')
      .single();

    if (error) {
      throw normalizePortalError(error, `Failed to fetch profile: ${error.message}`);
    }

    return data;
  },

  async updateMyProfile(payload: CustomerPortalProfileUpdatePayload): Promise<CustomerPortalProfile> {
    await ensureAuthenticatedSession();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      throw new PortalServiceError(
        'SESSION_EXPIRED',
        'Your session has expired. Please sign in again to continue.'
      );
    }

    const { data, error } = await supabase
      .from('customers')
      .update(payload)
      .eq('auth_user_id', authData.user.id)
      .select('id, full_name, email, phone, created_at, updated_at')
      .single();

    if (error) {
      throw normalizePortalError(error, `Failed to update profile: ${error.message}`);
    }

    return data;
  },

  async trackFunnelEvent(eventType: PortalFunnelEventType, metadata?: Record<string, unknown>) {
    await ensureAuthenticatedSession();

    const { error } = await supabase.rpc('track_portal_funnel_event', {
      p_event_type: eventType,
      p_metadata: metadata ?? {},
    });

    if (error) {
      throw normalizePortalError(error, `Failed to track portal funnel event: ${error.message}`);
    }
  },
};
