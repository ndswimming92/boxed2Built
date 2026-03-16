import { supabase } from '../lib/supabase';
import { PortalServiceError } from './customerPortalService';

export type SupportTicketStatus = 'open' | 'in_progress' | 'waiting_on_customer' | 'resolved' | 'closed';
export type SupportTicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type SupportAuthorRole = 'customer' | 'admin' | 'system';

export type SupportTicket = {
  id: string;
  organization_id: string;
  customer_id: string;
  related_job_id: string | null;
  related_invoice_id: string | null;
  subject: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  sla_first_response_due_at: string | null;
  sla_resolution_due_at: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  last_customer_message_at: string | null;
  last_admin_message_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SupportTicketMessage = {
  id: string;
  organization_id: string;
  ticket_id: string;
  customer_id: string;
  author_user_id: string | null;
  author_role: SupportAuthorRole;
  message_body: string;
  is_internal: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
};

const normalizeError = (error: { message: string; code?: string } | null, fallback: string): PortalServiceError => {
  if (!error) {
    return new PortalServiceError('UNKNOWN', fallback);
  }

  if (error.code === '42501') {
    return new PortalServiceError('UNAUTHORIZED', 'You are not authorized to access this support resource.');
  }

  if (error.code === 'PGRST116') {
    return new PortalServiceError('NOT_FOUND', 'Support ticket not found.');
  }

  const lowerMessage = error.message.toLowerCase();
  if (error.code === '42P01' || error.code === 'PGRST205' || lowerMessage.includes('schema cache') || lowerMessage.includes('could not find the table')) {
    return new PortalServiceError(
      'MISCONFIGURED',
      'Support ticketing is not set up in this environment yet. Run the latest Supabase migrations (for example: `supabase db push`) and refresh the page.'
    );
  }

  return new PortalServiceError('UNKNOWN', error.message || fallback);
};

export const supportTicketService = {
  async getCustomerNames(customerIds: string[]): Promise<Record<string, string>> {
    const uniqueCustomerIds = Array.from(new Set(customerIds.filter(Boolean)));
    if (uniqueCustomerIds.length === 0) return {};

    const { data, error } = await supabase
      .from('customers')
      .select('id, full_name')
      .in('id', uniqueCustomerIds);

    if (error) throw normalizeError(error, 'Failed to fetch customer names.');

    return (data ?? []).reduce<Record<string, string>>((acc, customer) => {
      const customerName = typeof customer.full_name === 'string' ? customer.full_name.trim() : '';
      acc[customer.id] = customerName || `Customer ${customer.id.slice(0, 8)}`;
      return acc;
    }, {});
  },

  async getMyTickets(): Promise<SupportTicket[]> {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw normalizeError(error, 'Failed to fetch support tickets.');
    return (data ?? []) as SupportTicket[];
  },

  async createTicket(payload: {
    subject: string;
    message: string;
    relatedJobId?: string | null;
    relatedInvoiceId?: string | null;
    priority?: SupportTicketPriority;
  }): Promise<SupportTicket> {
    const { data, error } = await supabase.rpc('submit_support_ticket', {
      p_subject: payload.subject,
      p_message: payload.message,
      p_related_job_id: payload.relatedJobId ?? null,
      p_related_invoice_id: payload.relatedInvoiceId ?? null,
      p_priority: payload.priority ?? 'normal',
    });

    if (error) throw normalizeError(error, 'Failed to create support ticket.');
    return data as SupportTicket;
  },

  async getMyTicketMessages(ticketId: string): Promise<SupportTicketMessage[]> {
    const { data, error } = await supabase
      .from('support_ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (error) throw normalizeError(error, 'Failed to fetch ticket messages.');
    return (data ?? []) as SupportTicketMessage[];
  },

  async addCustomerMessage(ticketId: string, message: string): Promise<SupportTicketMessage> {
    const { data, error } = await supabase.rpc('add_support_ticket_message', {
      p_ticket_id: ticketId,
      p_message: message,
    });

    if (error) throw normalizeError(error, 'Failed to send message.');
    return data as SupportTicketMessage;
  },

  async getAdminQueue(status?: SupportTicketStatus | 'all'): Promise<SupportTicket[]> {
    let query = supabase.from('support_tickets').select('*').order('updated_at', { ascending: false });
    if (status && status !== 'all') query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw normalizeError(error, 'Failed to fetch support queue.');
    return (data ?? []) as SupportTicket[];
  },

  async getAdminTicketMessages(ticketId: string): Promise<SupportTicketMessage[]> {
    return this.getMyTicketMessages(ticketId);
  },

  async addAdminMessage(ticketId: string, message: string, isInternal = false): Promise<SupportTicketMessage> {
    const { data, error } = await supabase.rpc('admin_add_support_ticket_message', {
      p_ticket_id: ticketId,
      p_message: message,
      p_is_internal: isInternal,
    });

    if (error) throw normalizeError(error, 'Failed to send admin message.');
    return data as SupportTicketMessage;
  },

  async updateAdminTicketStatus(payload: {
    ticketId: string;
    status: SupportTicketStatus;
    note?: string | null;
    priority?: SupportTicketPriority | null;
  }): Promise<SupportTicket> {
    const { data, error } = await supabase.rpc('admin_update_support_ticket_status', {
      p_ticket_id: payload.ticketId,
      p_status: payload.status,
      p_note: payload.note ?? null,
      p_priority: payload.priority ?? null,
    });

    if (error) throw normalizeError(error, 'Failed to update support ticket status.');
    return data as SupportTicket;
  },
};
