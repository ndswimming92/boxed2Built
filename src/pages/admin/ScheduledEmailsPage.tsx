import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  Calendar,
  Clock,
  Loader2,
  Mail,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  UserRound,
} from 'lucide-react';
import {
  cancelJobFollowup,
  cancelJobReminder,
  cancelWelcomeEmail,
  listScheduledEmails,
  resumeJobFollowup,
  resumeJobReminder,
  resumeWelcomeEmail,
  type ScheduledEmailKind,
  type ScheduledEmailRow,
} from '../../services/scheduledEmailsService';
import { useToast } from '../../contexts/ToastContext';

const KIND_LABELS: Record<ScheduledEmailKind, string> = {
  reminder: 'Appointment Reminder',
  followup: 'Post-Job Follow-Up',
  welcome: 'Portal Welcome',
};

const KIND_FILTERS: Array<{ value: 'all' | ScheduledEmailKind; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'reminder', label: 'Reminders' },
  { value: 'followup', label: 'Follow-Ups' },
  { value: 'welcome', label: 'Portal Welcome' },
];

/**
 * 'Fri, Sep 25 at 5:00 PM' on the business's own clock, not the viewer's —
 * the same shape jobReminderLabels/jobFollowupLabels each already render,
 * duplicated here rather than imported since this page has no single
 * "reminder" or "follow-up" identity to borrow the name from.
 */
function formatInstant(iso: string, timeZone: string): string {
  const instant = new Date(iso);
  const date = instant.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone,
  });
  const time = instant.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  });
  return `${date} at ${time}`;
}

function statusLine(row: ScheduledEmailRow): string {
  if (row.status === 'cancelled') return 'Cancelled';
  if (row.status === 'blocked') return 'No usable email on file';
  if (row.status === 'due') return 'Sending within the hour';
  return row.sendAt ? `Goes out ${formatInstant(row.sendAt, row.timeZone)}` : 'Scheduled';
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <p className="text-xs sm:text-sm font-medium text-slate-500">{label}</p>
        <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-xl sm:text-2xl font-bold text-slate-900">{value.toLocaleString()}</p>
    </div>
  );
}

export default function ScheduledEmailsPage() {
  const [rows, setRows] = useState<ScheduledEmailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<'all' | ScheduledEmailKind>('all');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const { showToast } = useToast();

  const fetchRows = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const emails = await listScheduledEmails();
      setRows(emails);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load scheduled emails');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (kindFilter !== 'all' && row.kind !== kindFilter) return false;
      if (!q) return true;
      return (
        row.recipientName?.toLowerCase().includes(q) ||
        row.recipientEmail?.toLowerCase().includes(q) ||
        row.detail?.toLowerCase().includes(q) ||
        row.label.toLowerCase().includes(q)
      );
    });
  }, [rows, kindFilter, search]);

  const counts = useMemo(
    () => ({
      due: rows.filter((row) => row.status === 'due').length,
      scheduled: rows.filter((row) => row.status === 'scheduled').length,
      cancelled: rows.filter((row) => row.status === 'cancelled').length,
      blocked: rows.filter((row) => row.status === 'blocked').length,
    }),
    [rows],
  );

  const sections = useMemo(
    () => [
      { key: 'due', title: 'Sending Within the Hour', rows: filtered.filter((row) => row.status === 'due') },
      { key: 'scheduled', title: 'Upcoming', rows: filtered.filter((row) => row.status === 'scheduled') },
      { key: 'cancelled', title: 'Cancelled', rows: filtered.filter((row) => row.status === 'cancelled') },
      { key: 'blocked', title: 'Needs Attention', rows: filtered.filter((row) => row.status === 'blocked') },
    ],
    [filtered],
  );

  const handleCancel = useCallback(
    async (row: ScheduledEmailRow) => {
      const who = row.recipientName || row.recipientEmail || 'this recipient';
      if (!confirm(`Cancel the ${KIND_LABELS[row.kind].toLowerCase()} email to ${who}? You can resume it any time.`)) {
        return;
      }
      setBusyId(row.id);
      try {
        if (row.kind === 'reminder' && row.jobId) await cancelJobReminder(row.jobId);
        else if (row.kind === 'followup' && row.jobId) await cancelJobFollowup(row.jobId);
        else if (row.kind === 'welcome' && row.queueId) await cancelWelcomeEmail(row.queueId);
        showToast({ type: 'success', message: 'Email cancelled.' });
        await fetchRows(true);
      } catch (err) {
        showToast({ type: 'error', message: err instanceof Error ? err.message : 'Could not cancel this email' });
      } finally {
        setBusyId(null);
      }
    },
    [fetchRows, showToast],
  );

  const handleResume = useCallback(
    async (row: ScheduledEmailRow) => {
      setBusyId(row.id);
      try {
        if (row.kind === 'reminder' && row.jobId) await resumeJobReminder(row.jobId);
        else if (row.kind === 'followup' && row.jobId) await resumeJobFollowup(row.jobId);
        else if (row.kind === 'welcome' && row.queueId) await resumeWelcomeEmail(row.queueId);
        showToast({ type: 'success', message: 'Email resumed.' });
        await fetchRows(true);
      } catch (err) {
        showToast({ type: 'error', message: err instanceof Error ? err.message : 'Could not resume this email' });
      } finally {
        setBusyId(null);
      }
    },
    [fetchRows, showToast],
  );

  return (
    <div className="max-w-6xl">
      <div className="flex items-start justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 sm:mb-2">Scheduled Emails</h1>
          <p className="text-sm sm:text-base text-slate-600">
            Every appointment reminder, follow-up, and portal welcome email waiting to go out — cancel or resume any one.
          </p>
        </div>
        <button
          onClick={() => fetchRows(true)}
          disabled={refreshing || loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard label="Due Soon" value={counts.due} icon={Send} color="bg-emerald-50 text-emerald-600" />
        <StatCard label="Upcoming" value={counts.scheduled} icon={Calendar} color="bg-blue-50 text-blue-600" />
        <StatCard label="Cancelled" value={counts.cancelled} icon={Ban} color="bg-slate-100 text-slate-600" />
        <StatCard label="Needs Attention" value={counts.blocked} icon={AlertTriangle} color="bg-amber-50 text-amber-600" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by recipient, job, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {KIND_FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setKindFilter(filter.value)}
              className={`px-3.5 py-2 text-sm font-medium rounded-lg border whitespace-nowrap transition-colors ${
                kindFilter === filter.value
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 bg-white rounded-xl border border-slate-200">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      )}

      {!loading && error && (
        <div className="bg-white rounded-xl border border-red-200 p-8 text-center">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={() => fetchRows()}
            className="mt-3 text-sm font-semibold text-emerald-700 hover:text-emerald-800 underline"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Mail className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">
            {rows.length === 0 ? 'Nothing scheduled right now' : 'No emails match your filters'}
          </p>
        </div>
      )}

      {!loading &&
        !error &&
        sections.map((section) =>
          section.rows.length === 0 ? null : (
            <div key={section.key} className="mb-6">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                {section.title} ({section.rows.length})
              </h2>
              <div className="space-y-2">
                {section.rows.map((row) => (
                  <div
                    key={row.id}
                    className={`bg-white rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 ${
                      row.status === 'blocked'
                        ? 'border-amber-200 bg-amber-50/40'
                        : row.status === 'cancelled'
                        ? 'border-slate-200 bg-slate-50'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-700">
                          {KIND_LABELS[row.kind]}
                        </span>
                        {row.detail && <span className="text-xs text-slate-400 truncate">{row.detail}</span>}
                      </div>
                      <p className="font-medium text-slate-900 truncate flex items-center gap-1.5">
                        <UserRound className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {row.recipientName || 'Unknown recipient'}
                        {row.recipientEmail && (
                          <span className="text-slate-400 font-normal truncate">— {row.recipientEmail}</span>
                        )}
                      </p>
                      <p
                        className={`text-sm mt-1 flex items-center gap-1.5 ${
                          row.status === 'blocked'
                            ? 'text-amber-800'
                            : row.status === 'cancelled'
                            ? 'text-slate-500'
                            : 'text-slate-600'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        {statusLine(row)}
                      </p>
                    </div>

                    <div className="shrink-0">
                      {(row.status === 'due' || row.status === 'scheduled') && (
                        <button
                          onClick={() => handleCancel(row)}
                          disabled={busyId === row.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          {busyId === row.id ? 'Cancelling…' : 'Cancel'}
                        </button>
                      )}
                      {row.status === 'cancelled' && (
                        <button
                          onClick={() => handleResume(row)}
                          disabled={busyId === row.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 border border-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          {busyId === row.id ? 'Resuming…' : 'Resume'}
                        </button>
                      )}
                      {row.status === 'blocked' && (
                        <p className="text-xs text-amber-700 max-w-[16rem] text-right">
                          Add an email to {row.kind === 'welcome' ? 'this customer' : 'this job'} and it sends automatically.
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ),
        )}
    </div>
  );
}
