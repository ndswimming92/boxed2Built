import React, { useEffect, useState, useCallback } from 'react';
import { Mail, RefreshCw, Search, ChevronDown, ChevronRight, CheckCircle2, XCircle, Clock, AlertTriangle, MousePointer, Eye, Send, Ban, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface EmailEvent {
  id: string;
  resend_event_id: string | null;
  message_id: string | null;
  event_type: string;
  recipient: string | null;
  subject: string | null;
  from_address: string | null;
  occurred_at: string;
  payload: Record<string, unknown>;
  created_at: string;
}

interface EmailThread {
  message_id: string | null;
  recipient: string | null;
  subject: string | null;
  latestStatus: string;
  latestAt: string;
  events: EmailEvent[];
}

const EVENT_LABELS: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  'email.sent':              { label: 'Sent',             color: 'text-blue-700',   bg: 'bg-blue-50',    icon: Send },
  'email.delivered':         { label: 'Delivered',        color: 'text-emerald-700',bg: 'bg-emerald-50', icon: CheckCircle2 },
  'email.opened':            { label: 'Opened',           color: 'text-teal-700',   bg: 'bg-teal-50',    icon: Eye },
  'email.clicked':           { label: 'Clicked',          color: 'text-cyan-700',   bg: 'bg-cyan-50',    icon: MousePointer },
  'email.bounced':           { label: 'Bounced',          color: 'text-red-700',    bg: 'bg-red-50',     icon: XCircle },
  'email.complained':        { label: 'Complained',       color: 'text-orange-700', bg: 'bg-orange-50',  icon: AlertTriangle },
  'email.failed':            { label: 'Failed',           color: 'text-red-700',    bg: 'bg-red-50',     icon: XCircle },
  'email.delivery_delayed':  { label: 'Delayed',          color: 'text-yellow-700', bg: 'bg-yellow-50',  icon: Clock },
  'email.scheduled':         { label: 'Scheduled',        color: 'text-slate-600',  bg: 'bg-slate-100',  icon: Clock },
  'email.received':          { label: 'Received',         color: 'text-slate-600',  bg: 'bg-slate-100',  icon: Mail },
  'email.suppressed':        { label: 'Suppressed',       color: 'text-slate-600',  bg: 'bg-slate-100',  icon: Ban },
};

function getEventMeta(type: string) {
  return EVENT_LABELS[type] ?? { label: type, color: 'text-slate-600', bg: 'bg-slate-100', icon: Mail };
}

function StatusBadge({ type }: { type: string }) {
  const { label, color, bg, icon: Icon } = getEventMeta(type);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${color} ${bg}`}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4.5 h-4.5 w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value.toLocaleString()}</p>
    </div>
  );
}

function groupIntoThreads(events: EmailEvent[]): EmailThread[] {
  const map = new Map<string, EmailEvent[]>();

  for (const ev of events) {
    const key = ev.message_id ?? ev.id;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ev);
  }

  const threads: EmailThread[] = [];
  map.forEach((evs, key) => {
    const sorted = [...evs].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
    threads.push({
      message_id: key,
      recipient: sorted[0].recipient,
      subject: sorted[0].subject,
      latestStatus: sorted[0].event_type,
      latestAt: sorted[0].occurred_at,
      events: sorted,
    });
  });

  return threads.sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime());
}

export default function EmailActivityPage() {
  const [events, setEvents] = useState<EmailEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());

  const fetchEvents = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    const { data, error } = await supabase
      .from('email_events')
      .select('*')
      .order('occurred_at', { ascending: false })
      .limit(500);

    if (!error && data) setEvents(data as EmailEvent[]);

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const filtered = events.filter(ev => {
    const matchesType = filterType === 'all' || ev.event_type === filterType;
    const q = search.toLowerCase();
    const matchesSearch = !q || (
      ev.recipient?.toLowerCase().includes(q) ||
      ev.subject?.toLowerCase().includes(q) ||
      ev.event_type.toLowerCase().includes(q)
    );
    return matchesType && matchesSearch;
  });

  const threads = groupIntoThreads(filtered);

  const counts = {
    sent: events.filter(e => e.event_type === 'email.sent').length,
    delivered: events.filter(e => e.event_type === 'email.delivered').length,
    opened: events.filter(e => e.event_type === 'email.opened').length,
    bounced: events.filter(e => e.event_type === 'email.bounced').length,
    failed: events.filter(e => e.event_type === 'email.failed').length,
    total: events.length,
  };

  const toggleThread = (id: string) => {
    setExpandedThreads(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const eventTypes = Array.from(new Set(events.map(e => e.event_type))).sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Email Activity</h1>
          <p className="text-sm text-slate-500 mt-0.5">Real-time email delivery events from Resend</p>
        </div>
        <button
          onClick={() => fetchEvents(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total Events"  value={counts.total}     icon={Mail}         color="bg-slate-100 text-slate-600" />
        <StatCard label="Sent"          value={counts.sent}      icon={Send}         color="bg-blue-50 text-blue-600" />
        <StatCard label="Delivered"     value={counts.delivered} icon={CheckCircle2} color="bg-emerald-50 text-emerald-600" />
        <StatCard label="Opened"        value={counts.opened}    icon={Eye}          color="bg-teal-50 text-teal-600" />
        <StatCard label="Bounced"       value={counts.bounced}   icon={XCircle}      color="bg-red-50 text-red-600" />
        <StatCard label="Failed"        value={counts.failed}    icon={AlertTriangle} color="bg-orange-50 text-orange-600" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by recipient or subject..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-slate-700"
        >
          <option value="all">All Event Types</option>
          {eventTypes.map(t => (
            <option key={t} value={t}>{getEventMeta(t).label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : threads.length === 0 ? (
          <div className="text-center py-20">
            <Mail className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No email events yet</p>
            <p className="text-sm text-slate-400 mt-1">
              Events will appear here once your Resend webhook is configured.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {/* Header row */}
            <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <div className="col-span-1"></div>
              <div className="col-span-4">Recipient / Subject</div>
              <div className="col-span-3">Latest Status</div>
              <div className="col-span-3">Time</div>
              <div className="col-span-1 text-right">Events</div>
            </div>

            {threads.map(thread => {
              const key = thread.message_id ?? thread.events[0]?.id ?? '';
              const isExpanded = expandedThreads.has(key);

              return (
                <div key={key}>
                  {/* Thread summary row */}
                  <button
                    onClick={() => toggleThread(key)}
                    className="w-full grid grid-cols-12 gap-4 px-5 py-4 text-left hover:bg-slate-50 transition-colors items-center"
                  >
                    <div className="col-span-1 flex items-center justify-center">
                      {isExpanded
                        ? <ChevronDown className="w-4 h-4 text-slate-400" />
                        : <ChevronRight className="w-4 h-4 text-slate-400" />
                      }
                    </div>
                    <div className="col-span-4 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {thread.recipient ?? 'Unknown recipient'}
                      </p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {thread.subject ?? 'No subject'}
                      </p>
                    </div>
                    <div className="col-span-3">
                      <StatusBadge type={thread.latestStatus} />
                    </div>
                    <div className="col-span-3">
                      <p className="text-sm text-slate-600">{formatDate(thread.latestAt)}</p>
                    </div>
                    <div className="col-span-1 text-right">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                        {thread.events.length}
                      </span>
                    </div>
                  </button>

                  {/* Expanded event history */}
                  {isExpanded && (
                    <div className="bg-slate-50 border-t border-slate-100 px-5 py-3 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Event History</p>
                      {thread.events.map(ev => {
                        const { label, color, bg, icon: Icon } = getEventMeta(ev.event_type);
                        return (
                          <div key={ev.id} className="flex items-start gap-3 bg-white rounded-lg border border-slate-100 px-4 py-3">
                            <div className={`mt-0.5 flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${bg}`}>
                              <Icon className={`w-3.5 h-3.5 ${color}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs font-semibold ${color}`}>{label}</span>
                                <span className="text-xs text-slate-400">{formatDate(ev.occurred_at)}</span>
                              </div>
                              {ev.resend_event_id && (
                                <p className="text-xs text-slate-400 mt-0.5 font-mono truncate">
                                  ID: {ev.resend_event_id}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!loading && threads.length > 0 && (
        <p className="text-xs text-slate-400 text-center">
          Showing {threads.length} email thread{threads.length !== 1 ? 's' : ''} ({filtered.length} event{filtered.length !== 1 ? 's' : ''})
        </p>
      )}
    </div>
  );
}
