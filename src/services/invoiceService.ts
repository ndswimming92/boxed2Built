import { supabase, Invoice, InvoiceLineItem, InvoicePayment, InvoiceSettings, FormInquiry, Job } from '../lib/supabase';
import { logCommunication } from './inquiryService';

export interface CreateInvoiceData {
  business_id: string;
  inquiry_id?: string;
  job_id?: string;
  invoice_type: 'estimate' | 'deposit' | 'progress' | 'final' | 'general';
  client_name: string;
  client_email?: string;
  client_phone?: string;
  client_address?: string;
  invoice_date: string;
  due_date: string;
  payment_terms: string;
  payment_terms_description?: string;
  tax_rate?: number;
  notes?: string;
  internal_notes?: string;
  late_fee_enabled?: boolean;
  late_fee_type?: 'fixed' | 'percentage';
  late_fee_amount?: number;
  late_fee_grace_days?: number;
}

export interface UpdateInvoiceData {
  invoice_type?: 'estimate' | 'deposit' | 'progress' | 'final' | 'general';
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  client_address?: string;
  invoice_date?: string;
  due_date?: string;
  payment_terms?: string;
  payment_terms_description?: string;
  status?: 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';
  tax_rate?: number;
  tax_override?: boolean;
  tax_amount?: number;
  notes?: string;
  internal_notes?: string;
  late_fee_enabled?: boolean;
  late_fee_type?: 'fixed' | 'percentage';
  late_fee_amount?: number;
  late_fee_grace_days?: number;
}

export interface CreateLineItemData {
  invoice_id: string;
  item_type: 'labor' | 'material' | 'other' | 'discount';
  description: string;
  quantity: number;
  unit_price: number;
  is_taxable: boolean;
  display_order?: number;
}

export interface CreatePaymentData {
  invoice_id: string;
  payment_date: string;
  payment_amount: number;
  payment_method: string;
  payment_reference?: string;
  notes?: string;
  recorded_by?: string;
}

export interface InvoiceWithDetails extends Invoice {
  lineItems: InvoiceLineItem[];
  payments: InvoicePayment[];
}

export interface InvoiceStats {
  total: number;
  draft: number;
  sent: number;
  partiallyPaid: number;
  paid: number;
  overdue: number;
  totalOutstanding: number;
  totalDraft: number;
  totalPaid: number;
  avgInvoiceAmount: number;
}

async function resolveCustomerAndClientIds(
  organizationId: string | null,
  clientEmail: string | undefined
): Promise<{ customer_id: string | null; client_id: string | null }> {
  if (!organizationId || !clientEmail?.trim()) {
    return { customer_id: null, client_id: null };
  }

  const [customerResult, clientResult] = await Promise.all([
    supabase
      .from('customers')
      .select('id')
      .eq('organization_id', organizationId)
      .ilike('email', clientEmail.trim())
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('clients')
      .select('id')
      .eq('organization_id', organizationId)
      .ilike('email', clientEmail.trim())
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    customer_id: customerResult.data?.id ?? null,
    client_id: clientResult.data?.id ?? null,
  };
}

async function getBusinessOrganizationId(businessId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('business_info')
    .select('organization_id')
    .eq('id', businessId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching business organization:', error);
    throw new Error(`Failed to fetch business organization: ${error.message}`);
  }

  return data?.organization_id ?? null;
}

async function getInvoiceOrganizationId(invoiceId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('invoices')
    .select('organization_id')
    .eq('id', invoiceId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching invoice organization:', error);
    throw new Error(`Failed to fetch invoice organization: ${error.message}`);
  }

  return data?.organization_id ?? null;
}

export async function generateInvoiceNumber(businessId: string): Promise<string> {
  const { data, error } = await supabase.rpc('generate_next_invoice_number', {
    p_business_id: businessId,
  });

  if (error) {
    console.error('Error generating invoice number:', error);
    throw new Error(`Failed to generate invoice number: ${error.message}`);
  }

  return data;
}

export async function getInvoiceSettings(businessId: string): Promise<InvoiceSettings | null> {
  const { data, error } = await supabase
    .from('invoice_settings')
    .select('*')
    .eq('business_id', businessId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching invoice settings:', error);
    throw new Error(`Failed to fetch invoice settings: ${error.message}`);
  }

  return data;
}

export async function updateInvoiceSettings(
  businessId: string,
  settings: Partial<InvoiceSettings>
): Promise<InvoiceSettings> {
  const organizationId = await getBusinessOrganizationId(businessId);

  const { data, error } = await supabase
    .from('invoice_settings')
    .upsert(
      {
        business_id: businessId,
        organization_id: organizationId,
        ...settings,
      },
      {
        onConflict: 'business_id',
      }
    )
    .select()
    .single();

  if (error) {
    console.error('Error updating invoice settings:', error);
    throw new Error(`Failed to update invoice settings: ${error.message}`);
  }

  return data;
}

export async function createInvoice(data: CreateInvoiceData): Promise<Invoice> {
  const invoiceNumber = await generateInvoiceNumber(data.business_id);
  const organizationId = await getBusinessOrganizationId(data.business_id);

  const settings = await getInvoiceSettings(data.business_id);
  const taxRate = data.tax_rate !== undefined ? data.tax_rate : settings?.default_tax_rate || 0;

  const { customer_id, client_id } = await resolveCustomerAndClientIds(organizationId, data.client_email);

  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      organization_id: organizationId,
      business_id: data.business_id,
      inquiry_id: data.inquiry_id || null,
      job_id: data.job_id || null,
      invoice_number: invoiceNumber,
      invoice_type: data.invoice_type,
      client_name: data.client_name,
      client_email: data.client_email,
      client_phone: data.client_phone || null,
      client_address: data.client_address || null,
      customer_id,
      client_id,
      invoice_date: data.invoice_date,
      due_date: data.due_date,
      payment_terms: data.payment_terms,
      payment_terms_description: data.payment_terms_description || null,
      tax_rate: taxRate,
      notes: data.notes || null,
      internal_notes: data.internal_notes || null,
      late_fee_enabled: data.late_fee_enabled || false,
      late_fee_type: data.late_fee_type || null,
      late_fee_amount: data.late_fee_amount || null,
      late_fee_grace_days: data.late_fee_grace_days || null,
      status: 'draft',
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating invoice:', error);
    throw new Error(`Failed to create invoice: ${error.message}`);
  }

  return invoice;
}

export async function getInvoice(invoiceId: string): Promise<InvoiceWithDetails | null> {
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .eq('is_active', true)
    .maybeSingle();

  if (invoiceError) {
    console.error('Error fetching invoice:', invoiceError);
    throw new Error(`Failed to fetch invoice: ${invoiceError.message}`);
  }

  if (!invoice) return null;

  const { data: lineItems, error: lineItemsError } = await supabase
    .from('invoice_line_items')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('display_order', { ascending: true });

  if (lineItemsError) {
    console.error('Error fetching line items:', lineItemsError);
    throw new Error(`Failed to fetch line items: ${lineItemsError.message}`);
  }

  const { data: payments, error: paymentsError } = await supabase
    .from('invoice_payments')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('payment_date', { ascending: true });

  if (paymentsError) {
    console.error('Error fetching payments:', paymentsError);
    throw new Error(`Failed to fetch payments: ${paymentsError.message}`);
  }

  return {
    ...invoice,
    lineItems: lineItems || [],
    payments: payments || [],
  };
}

export async function getAllInvoices(businessId: string): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching invoices:', error);
    throw new Error(`Failed to fetch invoices: ${error.message}`);
  }

  return data || [];
}

export async function getInvoicesByInquiry(inquiryId: string): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('inquiry_id', inquiryId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching invoices by inquiry:', error);
    throw new Error(`Failed to fetch invoices: ${error.message}`);
  }

  return data || [];
}

export async function getInvoicesByCustomer(businessId: string, email: string): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('business_id', businessId)
    .eq('client_email', email)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching customer invoices:', error);
    throw new Error(`Failed to fetch customer invoices: ${error.message}`);
  }

  return data || [];
}

export async function getInvoicesByJob(jobId: string): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('job_id', jobId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching job invoices:', error);
    throw new Error(`Failed to fetch job invoices: ${error.message}`);
  }

  return data || [];
}

export async function attachInvoiceToJob(invoiceId: string, jobId: string): Promise<void> {
  const { error } = await supabase
    .from('invoices')
    .update({ job_id: jobId })
    .eq('id', invoiceId);

  if (error) {
    console.error('Error attaching invoice to job:', error);
    throw new Error(`Failed to attach invoice: ${error.message}`);
  }
}

export async function detachInvoiceFromJob(invoiceId: string): Promise<void> {
  const { error } = await supabase
    .from('invoices')
    .update({ job_id: null })
    .eq('id', invoiceId);

  if (error) {
    console.error('Error detaching invoice from job:', error);
    throw new Error(`Failed to detach invoice: ${error.message}`);
  }
}

export async function getUnattachedInvoices(businessId: string): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('business_id', businessId)
    .is('job_id', null)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching unattached invoices:', error);
    throw new Error(`Failed to fetch unattached invoices: ${error.message}`);
  }

  return data || [];
}

export async function updateInvoice(invoiceId: string, updates: UpdateInvoiceData): Promise<Invoice> {
  const { data, error } = await supabase
    .from('invoices')
    .update(updates)
    .eq('id', invoiceId)
    .select()
    .single();

  if (error) {
    console.error('Error updating invoice:', error);
    throw new Error(`Failed to update invoice: ${error.message}`);
  }

  return data;
}

export async function deleteInvoice(invoiceId: string): Promise<void> {
  const { error } = await supabase
    .from('invoices')
    .update({ is_active: false })
    .eq('id', invoiceId);

  if (error) {
    console.error('Error deleting invoice:', error);
    throw new Error(`Failed to delete invoice: ${error.message}`);
  }
}

export async function addLineItem(data: CreateLineItemData): Promise<InvoiceLineItem> {
  const organizationId = await getInvoiceOrganizationId(data.invoice_id);

  const { data: lineItem, error } = await supabase
    .from('invoice_line_items')
    .insert({
      organization_id: organizationId,
      invoice_id: data.invoice_id,
      item_type: data.item_type,
      description: data.description,
      quantity: data.quantity,
      unit_price: data.unit_price,
      is_taxable: data.is_taxable,
      display_order: data.display_order || 0,
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding line item:', error);
    throw new Error(`Failed to add line item: ${error.message}`);
  }

  return lineItem;
}

export async function updateLineItem(
  lineItemId: string,
  updates: Partial<CreateLineItemData>
): Promise<InvoiceLineItem> {
  const { data, error } = await supabase
    .from('invoice_line_items')
    .update(updates)
    .eq('id', lineItemId)
    .select()
    .single();

  if (error) {
    console.error('Error updating line item:', error);
    throw new Error(`Failed to update line item: ${error.message}`);
  }

  return data;
}

export async function deleteLineItem(lineItemId: string): Promise<void> {
  const { error } = await supabase.from('invoice_line_items').delete().eq('id', lineItemId);

  if (error) {
    console.error('Error deleting line item:', error);
    throw new Error(`Failed to delete line item: ${error.message}`);
  }
}

export async function recordPayment(data: CreatePaymentData): Promise<InvoicePayment> {
  const organizationId = await getInvoiceOrganizationId(data.invoice_id);

  const { data: payment, error } = await supabase
    .from('invoice_payments')
    .insert({
      organization_id: organizationId,
      invoice_id: data.invoice_id,
      payment_date: data.payment_date,
      payment_amount: data.payment_amount,
      payment_method: data.payment_method,
      payment_reference: data.payment_reference || null,
      notes: data.notes || null,
      recorded_by: data.recorded_by || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error recording payment:', error);
    throw new Error(`Failed to record payment: ${error.message}`);
  }

  return payment;
}

export async function getPayments(invoiceId: string): Promise<InvoicePayment[]> {
  const { data, error } = await supabase
    .from('invoice_payments')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('payment_date', { ascending: true });

  if (error) {
    console.error('Error fetching payments:', error);
    throw new Error(`Failed to fetch payments: ${error.message}`);
  }

  return data || [];
}

export async function deletePayment(paymentId: string): Promise<void> {
  const { error } = await supabase.from('invoice_payments').delete().eq('id', paymentId);

  if (error) {
    console.error('Error deleting payment:', error);
    throw new Error(`Failed to delete payment: ${error.message}`);
  }
}

export async function markInvoiceAsSent(invoiceId: string): Promise<void> {
  const { error } = await supabase
    .from('invoices')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
    .eq('id', invoiceId);

  if (error) {
    console.error('Error marking invoice as sent:', error);
    throw new Error(`Failed to mark invoice as sent: ${error.message}`);
  }
}

export async function logInvoiceCommunication(
  invoiceId: string,
  method: 'email' | 'phone',
  notes?: string
): Promise<Invoice> {
  const invoice = await getInvoice(invoiceId);
  if (!invoice) {
    throw new Error('Invoice not found');
  }

  const timestamp = new Date().toLocaleString();
  const newInternalNotes = notes
    ? invoice.internal_notes
      ? `${invoice.internal_notes}\n\n[${timestamp}] ${method.toUpperCase()}: ${notes}`
      : `[${timestamp}] ${method.toUpperCase()}: ${notes}`
    : invoice.internal_notes;

  const { data, error } = await supabase
    .from('invoices')
    .update({ internal_notes: newInternalNotes })
    .eq('id', invoiceId)
    .select()
    .single();

  if (error) {
    console.error('Error logging invoice communication:', error);
    throw new Error(`Failed to log invoice communication: ${error.message}`);
  }

  if (invoice.inquiry_id) {
    await logCommunication(invoice.inquiry_id, method, notes);
  }

  return data;
}

export async function markInvoiceAsPaid(invoiceId: string): Promise<void> {
  const invoice = await getInvoice(invoiceId);
  if (!invoice) throw new Error('Invoice not found');

  const remainingAmount = invoice.amount_due;

  if (remainingAmount > 0) {
    await recordPayment({
      invoice_id: invoiceId,
      payment_date: new Date().toISOString().split('T')[0],
      payment_amount: remainingAmount,
      payment_method: 'other',
      notes: 'Marked as paid by admin',
    });
  }
}

export async function getInvoiceStats(businessId: string): Promise<InvoiceStats> {
  const invoices = await getAllInvoices(businessId);

  const total = invoices.length;
  const draft = invoices.filter((i) => i.status === 'draft').length;
  const sent = invoices.filter((i) => i.status === 'sent').length;
  const partiallyPaid = invoices.filter((i) => i.status === 'partially_paid').length;
  const paid = invoices.filter((i) => i.status === 'paid').length;
  const overdue = invoices.filter((i) => i.status === 'overdue').length;

  const totalOutstanding = invoices
    .filter((i) => ['sent', 'partially_paid', 'overdue'].includes(i.status))
    .reduce((sum, i) => sum + i.amount_due, 0);

  const totalDraft = invoices
    .filter((i) => i.status === 'draft')
    .reduce((sum, i) => sum + i.total_amount, 0);

  const totalPaid = invoices.reduce((sum, i) => sum + i.amount_paid, 0);

  const avgInvoiceAmount = total > 0 ? invoices.reduce((sum, i) => sum + i.total_amount, 0) / total : 0;

  return {
    total,
    draft,
    sent,
    partiallyPaid,
    paid,
    overdue,
    totalOutstanding: Math.round(totalOutstanding * 100) / 100,
    totalDraft: Math.round(totalDraft * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    avgInvoiceAmount: Math.round(avgInvoiceAmount * 100) / 100,
  };
}

export async function createInvoiceFromInquiry(
  inquiry: FormInquiry,
  invoiceType: 'estimate' | 'deposit' | 'progress' | 'final' | 'general' = 'general'
): Promise<Invoice> {
  const settings = await getInvoiceSettings(inquiry.business_id);
  const today = new Date();
  const invoiceDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const paymentTerms = settings?.default_payment_terms || 'Net 30';
  const dueDate = calculatePaymentTermsDueDate(invoiceDate, paymentTerms);

  const invoice = await createInvoice({
    business_id: inquiry.business_id,
    inquiry_id: inquiry.id,
    invoice_type: invoiceType,
    client_name: inquiry.client_name,
    client_email: inquiry.client_email,
    client_phone: inquiry.client_phone || undefined,
    invoice_date: invoiceDate,
    due_date: dueDate,
    payment_terms: paymentTerms,
    notes: settings?.invoice_notes_template || undefined,
  });

  if (inquiry.furniture_type && inquiry.pieces) {
    await addLineItem({
      invoice_id: invoice.id,
      item_type: 'labor',
      description: `${inquiry.furniture_type} assembly - ${inquiry.pieces} ${inquiry.pieces === 1 ? 'piece' : 'pieces'}`,
      quantity: inquiry.pieces,
      unit_price: inquiry.estimated_price ? parseFloat(inquiry.estimated_price.replace(/[^0-9.]/g, '')) / inquiry.pieces : 0,
      is_taxable: false,
      display_order: 0,
    });
  }

  return invoice;
}

export async function createInvoiceFromJob(
  job: Job,
  invoiceType: 'estimate' | 'deposit' | 'progress' | 'final' | 'general' = 'final'
): Promise<Invoice> {
  const settings = await getInvoiceSettings(job.business_id);
  const today = new Date();
  const invoiceDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const paymentTerms = settings?.default_payment_terms || 'Net 30';
  const dueDate = calculatePaymentTermsDueDate(invoiceDate, paymentTerms);

  const invoice = await createInvoice({
    business_id: job.business_id,
    job_id: job.id,
    invoice_type: invoiceType,
    client_name: job.client_name,
    client_email: job.client_email || '',
    client_phone: job.client_phone || undefined,
    invoice_date: invoiceDate,
    due_date: dueDate,
    payment_terms: paymentTerms,
    notes: settings?.invoice_notes_template || undefined,
  });

  const price = job.quoted_price || job.final_price || 0;
  if (price > 0) {
    await addLineItem({
      invoice_id: invoice.id,
      item_type: 'labor',
      description: job.job_type || 'Service',
      quantity: 1,
      unit_price: price,
      is_taxable: false,
      display_order: 0,
    });
  }

  return invoice;
}

export function calculatePaymentTermsDueDate(invoiceDate: string, paymentTerms: string): string {
  if (paymentTerms === 'Due on Receipt' || paymentTerms === 'Due on Completion' || paymentTerms === 'Due Upon Completion') {
    return invoiceDate;
  }

  const [year, month, day] = invoiceDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  const match = paymentTerms.match(/Net (\d+)/i);
  if (match) {
    const days = parseInt(match[1]);
    date.setDate(date.getDate() + days);
  } else {
    date.setDate(date.getDate() + 30);
  }

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
