import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PortalLayout from '../../components/portal/PortalLayout';
import { PortalServiceError } from '../../services/customerPortalService';
import {
  supportTicketService,
  type SupportTicket,
  type SupportTicketMessage,
  type SupportTicketPriority,
  type SupportTicketStatus,
} from '../../services/supportTicketService';

const statusLabel: Record<SupportTicketStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  waiting_on_customer: 'Waiting on You',
  resolved: 'Resolved',
  closed: 'Closed',
};

const formatDateTime = (value: string | null) => (value ? new Date(value).toLocaleString() : '—');

export default function PortalSupportPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [messages, setMessages] = useState<SupportTicketMessage[]>([]);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);

  const [subject, setSubject] = useState(searchParams.get('subject') ?? '');
  const [newMessage, setNewMessage] = useState(searchParams.get('message') ?? '');
  const [priority, setPriority] = useState<SupportTicketPriority>('normal');
  const [replyMessage, setReplyMessage] = useState('');

  const relatedJobId = searchParams.get('jobId');
  const relatedInvoiceId = searchParams.get('invoiceId');

  const activeTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === activeTicketId) ?? null,
    [tickets, activeTicketId]
  );

  const timeline = useMemo(() => {
    if (!activeTicket) return [];
    return [
      { label: 'Ticket created', value: activeTicket.created_at },
      { label: 'First response', value: activeTicket.first_response_at },
      { label: 'Resolved', value: activeTicket.resolved_at },
      { label: 'Closed', value: activeTicket.closed_at },
      { label: 'SLA first response due', value: activeTicket.sla_first_response_due_at },
      { label: 'SLA resolution due', value: activeTicket.sla_resolution_due_at },
    ].filter((event) => event.value);
  }, [activeTicket]);

  const loadTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await supportTicketService.getMyTickets();
      setTickets(data);
      setActiveTicketId((current) => current ?? data[0]?.id ?? null);
    } catch (err) {
      if (err instanceof PortalServiceError && err.code === 'SESSION_EXPIRED') {
        navigate('/portal/login?error=session_expired', { replace: true });
        return;
      }
      setError(err instanceof Error ? err.message : 'Unable to load support tickets.');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (ticketId: string) => {
    try {
      const data = await supportTicketService.getMyTicketMessages(ticketId);
      setMessages(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load ticket thread.');
    }
  };

  useEffect(() => {
    void loadTickets();
  }, [navigate]);

  useEffect(() => {
    if (activeTicketId) {
      void loadMessages(activeTicketId);
    } else {
      setMessages([]);
    }
  }, [activeTicketId]);

  const handleCreateTicket = async () => {
    setCreating(true);
    setError(null);
    try {
      const created = await supportTicketService.createTicket({
        subject,
        message: newMessage,
        relatedJobId,
        relatedInvoiceId,
        priority,
      });
      setSubject('');
      setNewMessage('');
      await loadTickets();
      setActiveTicketId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create support ticket.');
    } finally {
      setCreating(false);
    }
  };

  const handleReply = async () => {
    if (!activeTicketId) return;

    setSending(true);
    setError(null);
    try {
      await supportTicketService.addCustomerMessage(activeTicketId, replyMessage);
      setReplyMessage('');
      await loadMessages(activeTicketId);
      await loadTickets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send support message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <PortalLayout title="Support" subtitle="Create support tickets and track updates from our team.">
      {error ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">New Ticket</h3>
        {(relatedJobId || relatedInvoiceId) ? (
          <p className="mt-1 text-xs text-blue-700">
            Context attached: {relatedJobId ? `Job ${relatedJobId}` : ''} {relatedInvoiceId ? `Invoice ${relatedInvoiceId}` : ''}
          </p>
        ) : null}
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-sm text-slate-700 md:col-span-2">Subject
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="text-sm text-slate-700">Priority
            <select value={priority} onChange={(e) => setPriority(e.target.value as SupportTicketPriority)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
            </select>
          </label>
          <div />
          <label className="text-sm text-slate-700 md:col-span-2">Message
            <textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <button onClick={() => void handleCreateTicket()} disabled={creating} className="w-fit rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60">
            {creating ? 'Creating…' : 'Create ticket'}
          </button>
        </div>
      </div>

      {loading ? <p className="text-sm text-slate-600">Loading support tickets...</p> : null}

      <div className="grid gap-4 md:grid-cols-[280px,1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <h4 className="text-sm font-semibold text-slate-900">Your tickets</h4>
          <ul className="mt-3 space-y-2">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <button
                  type="button"
                  onClick={() => setActiveTicketId(ticket.id)}
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm ${ticket.id === activeTicketId ? 'border-slate-900 bg-slate-100' : 'border-slate-200'}`}
                >
                  <p className="font-medium text-slate-900">{ticket.subject}</p>
                  <p className="text-xs text-slate-500">{statusLabel[ticket.status]} • {formatDateTime(ticket.updated_at)}</p>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          {!activeTicket ? <p className="text-sm text-slate-600">Select a ticket to view the thread.</p> : (
            <>
              <div className="flex items-center justify-between">
                <h4 className="text-base font-semibold text-slate-900">{activeTicket.subject}</h4>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">{statusLabel[activeTicket.status]}</span>
              </div>

              <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Status Timeline</p>
                <ul className="mt-2 space-y-1">
                  {timeline.map((event) => (
                    <li key={event.label} className="text-xs text-slate-700">{event.label}: {formatDateTime(event.value ?? null)}</li>
                  ))}
                </ul>
              </div>

              <ul className="mt-4 space-y-3">
                {messages.map((message) => (
                  <li key={message.id} className={`rounded-md border p-3 ${message.author_role === 'customer' ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                    <p className="text-xs font-semibold uppercase text-slate-500">{message.author_role}</p>
                    <p className="mt-1 text-sm text-slate-800">{message.message_body}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatDateTime(message.created_at)}</p>
                  </li>
                ))}
              </ul>

              <div className="mt-4">
                <textarea value={replyMessage} onChange={(e) => setReplyMessage(e.target.value)} rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Reply to this ticket" />
                <button onClick={() => void handleReply()} disabled={sending} className="mt-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60">
                  {sending ? 'Sending…' : 'Send reply'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </PortalLayout>
  );
}
