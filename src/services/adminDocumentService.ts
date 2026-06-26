import { supabase } from '../lib/supabase';

export type AdminDocumentType =
  | 'invoice'
  | 'receipt'
  | 'estimate'
  | 'job_report'
  | 'photo'
  | 'agreement'
  | 'general'
  | 'other';

export interface AdminDocument {
  id: string;
  organization_id: string;
  owner_customer_id: string;
  document_type: AdminDocumentType;
  display_name: string;
  storage_bucket: string;
  storage_path: string;
  related_job_id: string | null;
  related_invoice_id: string | null;
  is_visible_to_customer: boolean;
  is_internal_only: boolean;
  delete_after_at: string | null;
  deleted_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  customer?: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
  };
  related_invoice?: { invoice_number: string } | null;
  related_job?: { job_type: string | null; date_scheduled: string | null } | null;
}

export interface AdminDocumentUploadPayload {
  organizationId: string;
  ownerCustomerId: string;
  documentType: AdminDocumentType;
  displayName: string;
  relatedJobId?: string | null;
  relatedInvoiceId?: string | null;
  isVisibleToCustomer: boolean;
  isInternalOnly: boolean;
  file: File;
}

export interface CustomerOption {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
}

export interface JobOption {
  id: string;
  job_type: string | null;
  job_description: string | null;
  date_scheduled: string | null;
}

export interface InvoiceOption {
  id: string;
  invoice_number: string;
  total_amount: number;
  status: string;
}

const BUCKET = 'portal-document-vault';

export async function getDocumentsForAdmin(organizationId: string): Promise<AdminDocument[]> {
  const { data, error } = await supabase
    .from('portal_documents')
    .select(`
      id,
      organization_id,
      owner_customer_id,
      document_type,
      display_name,
      storage_bucket,
      storage_path,
      related_job_id,
      related_invoice_id,
      is_visible_to_customer,
      is_internal_only,
      delete_after_at,
      deleted_at,
      metadata,
      created_at,
      updated_at,
      customer:customers!owner_customer_id(id, full_name, email, phone),
      related_invoice:invoices!related_invoice_id(invoice_number),
      related_job:jobs!related_job_id(job_type, date_scheduled)
    `)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch documents: ${error.message}`);
  return (data ?? []) as unknown as AdminDocument[];
}

export async function getCustomersForOrg(organizationId: string): Promise<CustomerOption[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('id, full_name, email, phone')
    .eq('organization_id', organizationId)
    .order('full_name', { ascending: true });

  if (error) throw new Error(`Failed to fetch customers: ${error.message}`);
  return (data ?? []) as CustomerOption[];
}

export async function getJobsForCustomer(customerId: string): Promise<JobOption[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('id, job_type, job_description, date_scheduled')
    .eq('customer_id', customerId)
    .order('date_scheduled', { ascending: false, nullsFirst: false });

  if (error) throw new Error(`Failed to fetch jobs: ${error.message}`);
  return (data ?? []) as JobOption[];
}

export async function getInvoicesForCustomer(customerId: string): Promise<InvoiceOption[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, total_amount, status')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch invoices: ${error.message}`);
  return (data ?? []) as InvoiceOption[];
}

export async function uploadDocumentForCustomer(payload: AdminDocumentUploadPayload): Promise<AdminDocument> {
  const safeName = payload.file.name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_');
  const storagePath = `${payload.ownerCustomerId}/${Date.now()}_${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, payload.file, {
      contentType: payload.file.type || `application/octet-stream`,
      upsert: false,
    });

  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const { data, error: insertError } = await supabase
    .from('portal_documents')
    .insert({
      organization_id: payload.organizationId,
      owner_customer_id: payload.ownerCustomerId,
      document_type: payload.documentType,
      display_name: payload.displayName,
      storage_bucket: BUCKET,
      storage_path: storagePath,
      related_job_id: payload.relatedJobId ?? null,
      related_invoice_id: payload.relatedInvoiceId ?? null,
      is_visible_to_customer: payload.isVisibleToCustomer,
      is_internal_only: payload.isInternalOnly,
    })
    .select(`
      id,
      organization_id,
      owner_customer_id,
      document_type,
      display_name,
      storage_bucket,
      storage_path,
      related_job_id,
      related_invoice_id,
      is_visible_to_customer,
      is_internal_only,
      delete_after_at,
      deleted_at,
      metadata,
      created_at,
      updated_at
    `)
    .single();

  if (insertError) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw new Error(`Failed to save document record: ${insertError.message}`);
  }

  return data as AdminDocument;
}

export async function toggleDocumentVisibility(documentId: string, isVisible: boolean): Promise<void> {
  const { error } = await supabase
    .from('portal_documents')
    .update({ is_visible_to_customer: isVisible })
    .eq('id', documentId);

  if (error) throw new Error(`Failed to update visibility: ${error.message}`);
}

export async function softDeleteDocument(documentId: string, storagePath: string): Promise<void> {
  const { error: dbError } = await supabase
    .from('portal_documents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', documentId);

  if (dbError) throw new Error(`Failed to delete document record: ${dbError.message}`);

  await supabase.storage.from(BUCKET).remove([storagePath]);
}

export async function getCustomerIdForClient(
  organizationId: string,
  email: string | null | undefined,
  phone: string | null | undefined
): Promise<string | null> {
  const candidates: Array<{ id: string; auth_user_id: string | null; matchType: 'email' | 'phone' }> = [];

  if (email) {
    const { data } = await supabase
      .from('customers')
      .select('id, auth_user_id')
      .eq('organization_id', organizationId)
      .ilike('email', email.trim());
    for (const row of data ?? []) {
      candidates.push({ id: row.id, auth_user_id: row.auth_user_id, matchType: 'email' });
    }
  }

  if (phone) {
    const normalized = phone.replace(/\D/g, '');
    const { data } = await supabase
      .from('customers')
      .select('id, auth_user_id')
      .eq('organization_id', organizationId)
      .ilike('phone', `%${normalized}%`);
    for (const row of data ?? []) {
      if (!candidates.find((c) => c.id === row.id)) {
        candidates.push({ id: row.id, auth_user_id: row.auth_user_id, matchType: 'phone' });
      }
    }
  }

  if (candidates.length === 0) return null;

  const withAuth = candidates.filter((c) => c.auth_user_id);
  if (withAuth.length > 0) {
    const emailMatch = withAuth.find((c) => c.matchType === 'email');
    return emailMatch ? emailMatch.id : withAuth[0].id;
  }

  const emailMatch = candidates.find((c) => c.matchType === 'email');
  return emailMatch ? emailMatch.id : candidates[0].id;
}

export async function getDocumentsForCustomer(customerId: string): Promise<AdminDocument[]> {
  const { data, error } = await supabase
    .from('portal_documents')
    .select(`
      id,
      organization_id,
      owner_customer_id,
      document_type,
      display_name,
      storage_bucket,
      storage_path,
      related_job_id,
      related_invoice_id,
      is_visible_to_customer,
      is_internal_only,
      delete_after_at,
      deleted_at,
      metadata,
      created_at,
      updated_at,
      related_invoice:invoices!related_invoice_id(invoice_number),
      related_job:jobs!related_job_id(job_type, date_scheduled)
    `)
    .eq('owner_customer_id', customerId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch documents: ${error.message}`);
  return (data ?? []) as unknown as AdminDocument[];
}

export async function getAdminDocumentSignedUrl(storagePath: string, download = false): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 120, { download });

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to create signed URL: ${error?.message ?? 'Unknown error'}`);
  }

  return data.signedUrl;
}
