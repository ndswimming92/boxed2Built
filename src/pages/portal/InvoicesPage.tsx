import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PortalLayout from '../../components/portal/PortalLayout';
import {
  customerPortalService,
  PortalServiceError,
  type CustomerPortalInvoice,
} from '../../services/customerPortalService';
import { getOfflineFriendlyErrorMessage } from '../../utils/retry';
import { invoiceNoun } from '../../utils/invoiceLabels';

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleDateString() : 'N/A');
const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);
const PAGE_SIZE = 20;

export default function PortalInvoicesPage() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<CustomerPortalInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadInvoices = useCallback(async (nextPage: number, append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await customerPortalService.getMyInvoices({ page: nextPage, pageSize: PAGE_SIZE });
      setHasMore(data.length === PAGE_SIZE);
      setPage(nextPage);
      setInvoices((previous) => (append ? [...previous, ...data] : data));
    } catch (err) {
      if (err instanceof PortalServiceError && err.code === 'SESSION_EXPIRED') {
        navigate('/portal/login?error=session_expired', { replace: true });
        return;
      }
      const fallback = err instanceof Error ? err.message : 'Unable to load invoices.';
      setError(getOfflineFriendlyErrorMessage(fallback));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [navigate]);

  useEffect(() => {
    void loadInvoices(0);
  }, [loadInvoices]);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loading || loadingMore) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        void loadInvoices(page + 1, true);
      }
    }, { rootMargin: '100px' });

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, loadInvoices, page]);

  const summary = useMemo(() => {
    const unpaid = invoices.filter((invoice) => ['sent', 'overdue', 'partially_paid'].includes(invoice.status));
    return {
      total: invoices.length,
      unpaidCount: unpaid.length,
      unpaidAmount: unpaid.reduce((sum, invoice) => sum + (invoice.amount_due || 0), 0),
    };
  }, [invoices]);

  const handlePayNow = async (invoiceId: string) => {
    setActiveInvoiceId(invoiceId);
    setError(null);
    try {
      const url = await customerPortalService.createInvoiceCheckoutSession(invoiceId);
      window.location.href = url;
    } catch (err) {
      const fallback = err instanceof Error ? err.message : 'Unable to start checkout for this invoice.';
      setError(getOfflineFriendlyErrorMessage(fallback));
    } finally {
      setActiveInvoiceId(null);
    }
  };

  return (
    <PortalLayout title="Invoices" subtitle="Review invoice status, balances, and securely pay online">
      {loading ? <p className="text-sm text-slate-600">Loading invoices...</p> : null}
      {!loading && error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{error}</p>
          <button type="button" onClick={() => void loadInvoices(page, page > 0)} className="mt-2 rounded-md border border-red-300 px-2 py-1 text-xs font-medium">Retry</button>
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total invoices</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{summary.total}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Unpaid invoices</p>
            <p className="mt-1 text-2xl font-semibold text-amber-700">{summary.unpaidCount}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Outstanding balance</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{formatCurrency(summary.unpaidAmount)}</p>
          </div>
        </div>
      ) : null}

      {!loading && !error && invoices.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">No invoices are available yet.</div>
      ) : null}

      {!loading && !error && invoices.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Invoice</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Dates</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Balance</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {invoices.map((invoice) => {
                  const canPay = ['sent', 'overdue', 'partially_paid'].includes(invoice.status) && invoice.amount_due > 0;
                  return (
                    <tr key={invoice.id}>
                      <td className="px-4 py-3 text-sm text-slate-800">
                        <p className="font-medium">{invoice.invoice_number}</p>
                        <p className="text-xs text-slate-500">{invoiceNoun(invoice.invoice_type)}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 capitalize">{invoice.status.replace('_', ' ')}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        <p>Issued: {formatDate(invoice.invoice_date)}</p>
                        {invoice.due_date && <p>Due: {formatDate(invoice.due_date)}</p>}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-slate-800">
                        <p className="font-semibold">{formatCurrency(invoice.amount_due)}</p>
                        <p className="text-xs text-slate-500">of {formatCurrency(invoice.total_amount)}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <a
                          href={`/portal/support?invoiceId=${invoice.id}&subject=${encodeURIComponent(`Question about invoice ${invoice.invoice_number}`)}`}
                          className="mr-2 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          Support
                        </a>
                        {canPay ? (
                          <button
                            type="button"
                            onClick={() => void handlePayNow(invoice.id)}
                            disabled={activeInvoiceId === invoice.id}
                            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                          >
                            {activeInvoiceId === invoice.id ? 'Opening…' : 'Pay Now'}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div ref={sentinelRef} className="p-3 text-center text-xs text-slate-500">{loadingMore ? 'Loading more…' : hasMore ? 'Scroll to load more' : 'End of invoice history'}</div>
        </div>
      ) : null}
    </PortalLayout>
  );
}
