import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PortalLayout from '../../components/portal/PortalLayout';
import { PortalServiceError } from '../../services/customerPortalService';
import {
  customerNotificationService,
  type CustomerNotification,
  type CustomerNotificationType,
} from '../../services/customerNotificationService';
import { useNavigate } from 'react-router-dom';
import { getOfflineFriendlyErrorMessage } from '../../utils/retry';

type FilterValue = 'all' | 'unread' | CustomerNotificationType;

const notificationTypeLabels: Record<CustomerNotificationType, string> = {
  job_scheduled: 'Job Scheduled',
  job_completed: 'Job Completed',
  invoice_issued: 'Invoice Issued',
  invoice_paid: 'Invoice Paid',
  reminder_sent: 'Reminder Sent',
  job_action_request_approved: 'Request Approved',
  job_action_request_rejected: 'Request Rejected',
};

const formatTimestamp = (value: string) => new Date(value).toLocaleString();

const getSummaryText = (notification: CustomerNotification) => {
  const payload = notification.payload as Record<string, unknown>;

  switch (notification.notification_type) {
    case 'job_scheduled':
      return `${payload.job_type ?? 'Your job'} was scheduled${payload.date_scheduled ? ` for ${String(payload.date_scheduled)}` : ''}.`;
    case 'job_completed':
      return `${payload.job_type ?? 'Your job'} was marked as completed.`;
    case 'invoice_issued':
      return `Invoice ${payload.invoice_number ? `#${String(payload.invoice_number)}` : ''} is now available.`;
    case 'invoice_paid':
      return `Invoice ${payload.invoice_number ? `#${String(payload.invoice_number)}` : ''} has been paid.`;
    case 'reminder_sent':
      return `A ${String(payload.reminder_type ?? 'service')} reminder was sent.`;
    case 'job_action_request_approved':
      return `Your ${String(payload.action_type ?? 'job action')} request was approved.`;
    case 'job_action_request_rejected':
      return `Your ${String(payload.action_type ?? 'job action')} request was rejected.`;
    default:
      return 'You have a new account update.';
  }
};

export default function PortalNotificationsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterValue>('all');
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [importantOnly, setImportantOnly] = useState(true);
  const [unsubscribed, setUnsubscribed] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const PAGE_SIZE = 20;

  const loadNotifications = useCallback(async (nextPage = 0, append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [items, preferences] = await Promise.all([
        customerNotificationService.getMyNotifications(filter, { page: nextPage, pageSize: PAGE_SIZE }),
        customerNotificationService.getMyPreferences(),
      ]);
      setHasMore(items.length === PAGE_SIZE);
      setPage(nextPage);
      setNotifications((previous) => (append ? [...previous, ...items] : items));
      if (preferences) {
        setEmailEnabled(preferences.email_enabled);
        setImportantOnly(preferences.important_only);
        setUnsubscribed(Boolean(preferences.unsubscribed_at));
      }
    } catch (err) {
      if (err instanceof PortalServiceError && err.code === 'SESSION_EXPIRED') {
        navigate('/portal/login?error=session_expired', { replace: true });
        return;
      }
      const fallback = err instanceof Error ? err.message : 'Failed to load notifications.';
      setError(getOfflineFriendlyErrorMessage(fallback));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filter, navigate]);

  useEffect(() => {
    void loadNotifications(0, false);
  }, [loadNotifications]);

  useEffect(() => {
    if (!sentinelRef.current || loading || loadingMore || !hasMore) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        void loadNotifications(page + 1, true);
      }
    }, { rootMargin: '100px' });

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadNotifications, loading, loadingMore, page]);


  const unreadCount = useMemo(() => notifications.filter((item) => !item.is_read).length, [notifications]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await customerNotificationService.markAsRead(notificationId);
      await loadNotifications(0, false);
    } catch (err) {
      const fallback = err instanceof Error ? err.message : 'Failed to update notification.';
      setError(getOfflineFriendlyErrorMessage(fallback));
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await customerNotificationService.markAllAsRead();
      await loadNotifications(0, false);
    } catch (err) {
      const fallback = err instanceof Error ? err.message : 'Failed to update notifications.';
      setError(getOfflineFriendlyErrorMessage(fallback));
    }
  };

  const handleSavePreferences = async () => {
    setSavingPrefs(true);
    setError(null);

    try {
      await customerNotificationService.upsertMyPreferences({
        email_enabled: emailEnabled,
        important_only: importantOnly,
        unsubscribed_at: unsubscribed ? new Date().toISOString() : null,
      });
    } catch (err) {
      const fallback = err instanceof Error ? err.message : 'Failed to save email settings.';
      setError(getOfflineFriendlyErrorMessage(fallback));
    } finally {
      setSavingPrefs(false);
    }
  };

  return (
    <PortalLayout title="Notifications" subtitle="Stay updated on jobs, invoices, and reminders in one feed.">
      <div className="space-y-6">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-slate-500">Unread notifications</p>
              <p className="text-3xl font-semibold text-slate-900">{unreadCount}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value as FilterValue)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="all">All notifications</option>
                <option value="unread">Unread only</option>
                <option value="job_scheduled">Job Scheduled</option>
                <option value="job_completed">Job Completed</option>
                <option value="invoice_issued">Invoice Issued</option>
                <option value="invoice_paid">Invoice Paid</option>
                <option value="reminder_sent">Reminder Sent</option>
                <option value="job_action_request_approved">Request Approved</option>
                <option value="job_action_request_rejected">Request Rejected</option>
              </select>
              <button
                type="button"
                onClick={() => void handleMarkAllAsRead()}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Mark all as read
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Email mirror (optional)</h3>
          <p className="mt-1 text-sm text-slate-600">Receive important portal notifications in your email inbox.</p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={emailEnabled}
                onChange={(event) => setEmailEnabled(event.target.checked)}
              />
              Enable email notifications
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={importantOnly}
                onChange={(event) => setImportantOnly(event.target.checked)}
                disabled={!emailEnabled}
              />
              Important notifications only
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
              <input
                type="checkbox"
                checked={unsubscribed}
                onChange={(event) => setUnsubscribed(event.target.checked)}
              />
              Unsubscribe from all notification emails
            </label>
          </div>

          <button
            type="button"
            onClick={() => void handleSavePreferences()}
            disabled={savingPrefs}
            className="mt-4 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savingPrefs ? 'Saving…' : 'Save email preferences'}
          </button>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Activity feed</h3>

          {loading ? <p className="mt-2 text-sm text-slate-600">Loading notifications...</p> : null}
          {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
          {error ? (
            <button type="button" onClick={() => void loadNotifications(page, page > 0)} className="mt-2 rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700">
              Retry
            </button>
          ) : null}

          {!loading && notifications.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No notifications yet.</p>
          ) : null}

          {notifications.length > 0 ? (
            <ul className="mt-3 space-y-3">
              {notifications.map((notification) => (
                <li key={notification.id} className="rounded-md border border-slate-200 p-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {notificationTypeLabels[notification.notification_type]}
                        {notification.is_important ? (
                          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Important</span>
                        ) : null}
                      </p>
                      <p className="mt-1 text-sm text-slate-700">{getSummaryText(notification)}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatTimestamp(notification.created_at)}</p>
                    </div>

                    {!notification.is_read ? (
                      <button
                        type="button"
                        onClick={() => void handleMarkAsRead(notification.id)}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Mark as read
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500">Read</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          <div ref={sentinelRef} className="mt-3 text-center text-xs text-slate-500">{loadingMore ? 'Loading more…' : hasMore ? 'Scroll to load more' : 'End of notifications'}</div>
        </section>
      </div>
    </PortalLayout>
  );
}
