import { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type PortalServiceErrorCode =
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'SESSION_EXPIRED'
  | 'UNKNOWN';

export class PortalServiceError extends Error {
  code: PortalServiceErrorCode;

  constructor(code: PortalServiceErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'PortalServiceError';
  }
}

export type CustomerPortalProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
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
  async getMyJobs(): Promise<CustomerPortalJob[]> {
    await ensureAuthenticatedSession();

    const { data, error } = await supabase
      .from('jobs')
      .select('id, job_type, job_description, date_scheduled, date_completed, job_status, quoted_price, final_price, location_city, created_at, updated_at')
      .order('created_at', { ascending: false });

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

  async getMyInvoices(): Promise<CustomerPortalInvoice[]> {
    await ensureAuthenticatedSession();

    const { data, error } = await supabase
      .from('invoices')
      .select('id, invoice_number, invoice_type, invoice_date, due_date, payment_terms, payment_terms_description, status, subtotal, tax_amount, total_amount, amount_paid, amount_due, sent_at, paid_at, created_at')
      .order('invoice_date', { ascending: false });

    if (error) {
      throw normalizePortalError(error, `Failed to fetch invoices: ${error.message}`);
    }

    return data ?? [];
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
};
