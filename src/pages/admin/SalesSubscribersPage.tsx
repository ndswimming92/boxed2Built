import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { AlertCircle, MailCheck, MailX, Users } from 'lucide-react';
import { getSaleSubscribers } from '../../services/salesSubscriptionService';
import type { SaleSubscriber, SaleSubscriberStatus } from '../../types/saleSubscriber';

// Loaded on demand: the map brings in the US outline data.
const SubscriberMap = lazy(() => import('../../components/admin/SubscriberMap'));

const REFRESH_MS = 30_000;

const TABS: Array<{ status: SaleSubscriberStatus; label: string; empty: string }> = [
  {
    status: 'active',
    label: 'Subscribed',
    empty: 'No subscribers yet. People sign up from the Sales tab on the News page.',
  },
  { status: 'unsubscribed', label: 'Unsubscribed', empty: 'Nobody has unsubscribed.' },
];

function formatDate(value: string | null): string {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SalesSubscribersPage() {
  const [subscribers, setSubscribers] = useState<SaleSubscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SaleSubscriberStatus>('active');
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = (initial: boolean) =>
      getSaleSubscribers()
        .then((data) => {
          if (cancelled) return;
          setSubscribers(data);
          setUpdatedAt(Date.now());
          setError(null);
        })
        .catch((loadError) => {
          // A failed refresh keeps the list on screen; only the first load reports.
          if (!cancelled && initial) {
            setError(loadError instanceof Error ? loadError.message : 'Failed to load subscribers');
          }
        })
        .finally(() => {
          if (!cancelled && initial) setLoading(false);
        });

    void load(true);
    // Quietly refetched while the page is open and visible, so new sign-ups
    // show up on the map and feed without a reload.
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load(false);
    }, REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const counts = useMemo(
    () => ({
      active: subscribers.filter((s) => s.status === 'active').length,
      unsubscribed: subscribers.filter((s) => s.status === 'unsubscribed').length,
    }),
    [subscribers],
  );

  const visible = useMemo(() => {
    const rows = subscribers.filter((s) => s.status === activeTab);
    return activeTab === 'unsubscribed'
      ? [...rows].sort((a, b) => (b.unsubscribed_at ?? '').localeCompare(a.unsubscribed_at ?? ''))
      : rows;
  }, [subscribers, activeTab]);

  const tab = TABS.find((t) => t.status === activeTab)!;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Users className="w-6 h-6 text-emerald-600" aria-hidden="true" />
          Sales Subscribers
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          People who signed up on the News page for the daily new-sales email. It goes out at 8 AM Central, only on
          days a sale was approved since their last email. Unsubscribed people are kept here and are never emailed.
        </p>
      </div>

      {error && (
        <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="w-5 h-5 flex-none" aria-hidden="true" />
          {error}
        </div>
      )}

      {!loading && (
        <Suspense fallback={<div className="mb-6 h-64 rounded-xl bg-[#050b17]" aria-hidden="true" />}>
          <SubscriberMap subscribers={subscribers} updatedAt={updatedAt} />
        </Suspense>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Subscribed</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{counts.active}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Unsubscribed</p>
          <p className="mt-1 text-2xl font-bold text-slate-700">{counts.unsubscribed}</p>
        </div>
      </div>

      <div className="mb-4 flex gap-6 border-b border-slate-200" role="group" aria-label="Filter subscribers">
        {TABS.map((t) => (
          <button
            key={t.status}
            type="button"
            aria-pressed={activeTab === t.status}
            onClick={() => setActiveTab(t.status)}
            className={`-mb-px border-b-2 px-1 pb-2 text-sm font-medium ${
              activeTab === t.status
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label} ({counts[t.status]})
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-10 text-center text-slate-500">Loading...</p>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-10 text-center">
          {activeTab === 'active' ? (
            <MailCheck className="mx-auto mb-3 w-9 h-9 text-slate-400" aria-hidden="true" />
          ) : (
            <MailX className="mx-auto mb-3 w-9 h-9 text-slate-400" aria-hidden="true" />
          )}
          <p className="text-slate-600">{tab.empty}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Name</th>
                <th scope="col" className="px-4 py-3 font-semibold">Email</th>
                <th scope="col" className="px-4 py-3 font-semibold">Subscribed</th>
                {activeTab === 'unsubscribed' && (
                  <th scope="col" className="px-4 py-3 font-semibold">Unsubscribed</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((subscriber) => (
                <tr key={subscriber.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{subscriber.name}</td>
                  <td className="px-4 py-3">
                    <a href={`mailto:${subscriber.email}`} className="text-blue-700 hover:underline">
                      {subscriber.email}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(subscriber.subscribed_at)}</td>
                  {activeTab === 'unsubscribed' && (
                    <td className="px-4 py-3 text-slate-600">{formatDate(subscriber.unsubscribed_at)}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
