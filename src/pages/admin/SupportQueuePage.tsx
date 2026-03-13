import React, { useEffect, useMemo, useState } from 'react';
import {
  supportTicketService,
  type SupportTicket,
  type SupportTicketMessage,
  type SupportTicketPriority,
  type SupportTicketStatus,
} from '../../services/supportTicketService';

const statusOptions: SupportTicketStatus[] = ['open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed'];

export default function SupportQueuePage() {
  const [filter, setFilter] = useState<SupportTicketStatus | 'all'>('open');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [messages, setMessages] = useState<SupportTicketMessage[]>([]);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [status, setStatus] = useState<SupportTicketStatus>('open');
  const [priority, setPriority] = useState<SupportTicketPriority>('normal');
  const [note, setNote] = useState('');
  const [reply, setReply] = useState('');
  const [internalReply, setInternalReply] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeTicket = useMemo(() => tickets.find((ticket) => ticket.id === activeTicketId) ?? null, [tickets, activeTicketId]);

  const loadQueue = async () => {
    setError(null);
    try {
      const data = await supportTicketService.getAdminQueue(filter);
      setTickets(data);
      setActiveTicketId((current) => current ?? data[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load support queue.');
    }
  };

  const loadMessages = async (ticketId: string) => {
    try {
      const data = await supportTicketService.getAdminTicketMessages(ticketId);
      setMessages(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load messages.');
    }
  };

  useEffect(() => {
    void loadQueue();
  }, [filter]);

  useEffect(() => {
    if (!activeTicketId) return;
    const ticket = tickets.find((item) => item.id === activeTicketId);
    if (!ticket) return;

    setStatus(ticket.status);
    setPriority(ticket.priority);
    void loadMessages(activeTicketId);
  }, [activeTicketId, tickets]);

  const handleStatusUpdate = async () => {
    if (!activeTicketId) return;
    try {
      await supportTicketService.updateAdminTicketStatus({ ticketId: activeTicketId, status, note, priority });
      setNote('');
      await loadQueue();
      await loadMessages(activeTicketId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update status.');
    }
  };

  const handleReply = async () => {
    if (!activeTicketId) return;
    try {
      await supportTicketService.addAdminMessage(activeTicketId, reply, internalReply);
      setReply('');
      await loadQueue();
      await loadMessages(activeTicketId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send reply.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-900">Support Queue</h1>
          <select value={filter} onChange={(e) => setFilter(e.target.value as SupportTicketStatus | 'all')} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="all">All</option>
            {statusOptions.map((value) => <option key={value} value={value}>{value.replace('_', ' ')}</option>)}
          </select>
        </div>
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[320px,1fr]">
        <aside className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <ul className="space-y-2">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <button type="button" onClick={() => setActiveTicketId(ticket.id)} className={`w-full rounded-md border px-3 py-2 text-left ${ticket.id === activeTicketId ? 'border-slate-900 bg-slate-100' : 'border-slate-200'}`}>
                  <p className="text-sm font-semibold text-slate-900">{ticket.subject}</p>
                  <p className="text-xs text-slate-500">{ticket.status.replace('_', ' ')} • {new Date(ticket.updated_at).toLocaleString()}</p>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          {!activeTicket ? <p className="text-sm text-slate-600">Select a ticket from the queue.</p> : (
            <>
              <h2 className="text-lg font-semibold text-slate-900">{activeTicket.subject}</h2>
              <p className="text-xs text-slate-500">Customer ID: {activeTicket.customer_id}</p>
              <p className="text-xs text-slate-500">Context: Job {activeTicket.related_job_id ?? '—'} / Invoice {activeTicket.related_invoice_id ?? '—'}</p>

              <div className="mt-4 grid gap-3 rounded-md border border-slate-200 p-3 md:grid-cols-3">
                <label className="text-sm text-slate-700">Status
                  <select value={status} onChange={(e) => setStatus(e.target.value as SupportTicketStatus)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                    {statusOptions.map((value) => <option key={value} value={value}>{value.replace('_', ' ')}</option>)}
                  </select>
                </label>
                <label className="text-sm text-slate-700">Priority
                  <select value={priority} onChange={(e) => setPriority(e.target.value as SupportTicketPriority)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                    <option value="low">low</option><option value="normal">normal</option><option value="high">high</option><option value="urgent">urgent</option>
                  </select>
                </label>
                <button type="button" onClick={() => void handleStatusUpdate()} className="self-end rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">Update</button>
                <label className="text-sm text-slate-700 md:col-span-3">Status note
                  <input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </label>
              </div>

              <ul className="mt-4 space-y-2">
                {messages.map((message) => (
                  <li key={message.id} className={`rounded-md border p-3 ${message.is_internal ? 'border-amber-200 bg-amber-50' : 'border-slate-200'}`}>
                    <p className="text-xs font-semibold uppercase text-slate-500">{message.author_role}{message.is_internal ? ' • internal' : ''}</p>
                    <p className="mt-1 text-sm text-slate-800">{message.message_body}</p>
                  </li>
                ))}
              </ul>

              <div className="mt-4">
                <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Reply to customer or add internal note" />
                <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={internalReply} onChange={(e) => setInternalReply(e.target.checked)} />
                  Internal note (not visible to customer)
                </label>
                <button type="button" onClick={() => void handleReply()} className="mt-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">Send message</button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
