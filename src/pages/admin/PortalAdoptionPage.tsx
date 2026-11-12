import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Trash2 } from 'lucide-react';
import {
  deletePortalAccounts,
  getPortalAdoptionReport,
  getPortalInactiveCustomersReport,
  type PortalAdoptionReportRow,
  type PortalInactiveCustomerRow,
} from '../../services/portalAdoptionReportService';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { logAction } from '../../services/auditLogService';

const formatDateTime = (value: string | null) => (value ? new Date(value).toLocaleString() : '—');

export default function PortalAdoptionPage() {
  const [adoptionRows, setAdoptionRows] = useState<PortalAdoptionReportRow[]>([]);
  const [inactiveRows, setInactiveRows] = useState<PortalInactiveCustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<PortalAdoptionReportRow[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'warning'; lines: string[] } | null>(null);

  const selectedRows = useMemo(
    () => adoptionRows.filter((row) => selectedIds.has(row.customer_id)),
    [adoptionRows, selectedIds],
  );
  const allSelected = adoptionRows.length > 0 && selectedRows.length === adoptionRows.length;

  const toggleSelected = (customerId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(customerId)) next.delete(customerId);
      else next.add(customerId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(adoptionRows.map((row) => row.customer_id)));
  };

  const openDelete = (rows: PortalAdoptionReportRow[]) => {
    setDeleteError(null);
    setPendingDelete(rows);
  };

  const closeDelete = () => {
    if (deleting) return;
    setPendingDelete(null);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete || pendingDelete.length === 0) return;
    setDeleting(true);
    setDeleteError(null);

    try {
      const results = await deletePortalAccounts(pendingDelete.map((row) => row.customer_id));
      const label = (customerId: string) => {
        const row = pendingDelete.find((r) => r.customer_id === customerId);
        return row?.full_name || row?.email || 'Unknown customer';
      };

      const deleted = results.filter((r) => r.success);
      const failed = results.filter((r) => !r.success);
      const deletedIds = new Set(deleted.map((r) => r.customerId));

      for (const result of deleted) {
        void logAction({
          actionType: 'DELETE',
          tableName: 'customers',
          recordIdentifier: result.email || label(result.customerId),
        });
      }

      setAdoptionRows((prev) => prev.filter((row) => !deletedIds.has(row.customer_id)));
      setInactiveRows((prev) => prev.filter((row) => !deletedIds.has(row.customer_id)));
      setSelectedIds((prev) => new Set([...prev].filter((id) => !deletedIds.has(id))));

      const lines: string[] = [];
      if (deleted.length > 0) {
        lines.push(`Deleted ${deleted.length} ${deleted.length === 1 ? 'account' : 'accounts'}.`);
      }
      for (const result of deleted) {
        if (result.loginKeptReason) lines.push(`${label(result.customerId)}: ${result.loginKeptReason}`);
      }
      for (const result of failed) {
        lines.push(`${label(result.customerId)} was not deleted: ${result.error || 'Unknown error.'}`);
      }

      setNotice({
        tone: failed.length > 0 || deleted.some((r) => r.loginKeptReason) ? 'warning' : 'success',
        lines,
      });
      setPendingDelete(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const [adoption, inactive] = await Promise.all([
          getPortalAdoptionReport(),
          getPortalInactiveCustomersReport(),
        ]);
        setAdoptionRows(adoption);
        setInactiveRows(inactive);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load portal adoption reports.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const stageCounts = useMemo(() => {
    const counts = {
      invite_sent: 0,
      login: 0,
      first_job_view: 0,
      repeat_login: 0,
    };

    for (const row of adoptionRows) {
      if (row.funnel_stage in counts) {
        counts[row.funnel_stage as keyof typeof counts] += 1;
      }
    }

    return counts;
  }, [adoptionRows]);

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Portal Adoption Reports</h1>
        <p className="mt-1 text-sm text-slate-600">Track invite → login → first job view → repeat login funnel and spot inactive customers.</p>
      </div>

      {loading ? <p className="text-sm text-slate-600">Loading reports...</p> : null}
      {!loading && error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {!loading && !error ? (
        <div className="space-y-6">
          {notice ? (
            <div
              role="status"
              className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
                notice.tone === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-amber-200 bg-amber-50 text-amber-900'
              }`}
            >
              <div className="space-y-1">
                {notice.lines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="shrink-0 text-xs font-medium underline underline-offset-2"
              >
                Dismiss
              </button>
            </div>
          ) : null}

          <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Invite sent</p>
              <p className="mt-1 text-3xl font-semibold text-slate-900">{stageCounts.invite_sent}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Logged in</p>
              <p className="mt-1 text-3xl font-semibold text-slate-900">{stageCounts.login}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">First job view</p>
              <p className="mt-1 text-3xl font-semibold text-slate-900">{stageCounts.first_job_view}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Repeat login</p>
              <p className="mt-1 text-3xl font-semibold text-slate-900">{stageCounts.repeat_login}</p>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <h2 className="text-base font-semibold text-slate-900">Portal adoption by customer</h2>
              {selectedRows.length > 0 ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-600">{selectedRows.length} selected</span>
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    className="text-sm font-medium text-slate-600 hover:text-slate-900"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => openDelete(selectedRows)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete selected
                  </button>
                </div>
              ) : null}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="w-10 px-4 py-2 text-left">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        disabled={adoptionRows.length === 0}
                        aria-label="Select all accounts"
                        className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                      />
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Customer</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Funnel stage</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Invited</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">First login</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">First job view</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Repeat login</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-slate-500">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {adoptionRows.map((row) => (
                    <tr key={row.customer_id} className={selectedIds.has(row.customer_id) ? 'bg-red-50/40' : undefined}>
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(row.customer_id)}
                          onChange={() => toggleSelected(row.customer_id)}
                          aria-label={`Select ${row.full_name || row.email || 'customer'}`}
                          className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                        />
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-700">
                        <p className="font-medium text-slate-900">{row.full_name || 'Unknown customer'}</p>
                        <p className="text-xs text-slate-500">{row.email || 'No email'}</p>
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-700">{row.funnel_stage.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-2 text-sm text-slate-700">{formatDateTime(row.invited_at)}</td>
                      <td className="px-4 py-2 text-sm text-slate-700">{formatDateTime(row.first_login_at)}</td>
                      <td className="px-4 py-2 text-sm text-slate-700">{formatDateTime(row.first_job_view_at)}</td>
                      <td className="px-4 py-2 text-sm text-slate-700">{formatDateTime(row.repeat_login_at)}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => openDelete([row])}
                          title={`Delete ${row.full_name || row.email || 'account'}`}
                          aria-label={`Delete ${row.full_name || row.email || 'account'}`}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-base font-semibold text-slate-900">Inactive customers</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Customer</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Inactive days</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Last portal activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inactiveRows.map((row) => (
                    <tr key={row.customer_id}>
                      <td className="px-4 py-2 text-sm text-slate-700">
                        <p className="font-medium text-slate-900">{row.full_name || 'Unknown customer'}</p>
                        <p className="text-xs text-slate-500">{row.email || 'No email'}</p>
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-700">{row.inactivity_status.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-2 text-sm text-slate-700">{row.inactive_days}</td>
                      <td className="px-4 py-2 text-sm text-slate-700">{formatDateTime(row.last_portal_activity_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}

      {pendingDelete ? (
        <Modal isOpen onClose={closeDelete} title="Delete portal account" size="small">
          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-gray-900">
                  {pendingDelete.length === 1
                    ? 'Delete this account?'
                    : `Delete ${pendingDelete.length} accounts?`}
                </h2>
                <p className="mt-1 text-sm text-gray-600">This is permanent and cannot be undone.</p>
                <ul className="mt-2 max-h-32 space-y-0.5 overflow-y-auto text-sm text-gray-900">
                  {pendingDelete.map((row) => (
                    <li key={row.customer_id} className="truncate">
                      <span className="font-medium">{row.full_name || 'Unknown customer'}</span>
                      {row.email ? <span className="text-gray-500"> · {row.email}</span> : null}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm font-medium text-gray-900">What gets deleted</p>
                <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-gray-600">
                  <li>The portal account and its login</li>
                  <li>Portal activity, notifications, documents, support tickets and saved requests</li>
                  <li>Files they uploaded</li>
                  <li>The matching record on the Customers page, with its notes</li>
                </ul>
                <p className="mt-3 text-sm font-medium text-gray-900">What is kept</p>
                <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-gray-600">
                  <li>Jobs, invoices, bookings and inquiries stay in your records, unlinked from the account</li>
                </ul>
              </div>
            </div>

            {deleteError ? (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {deleteError}
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={closeDelete}
                disabled={deleting}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <LoadingSpinner />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    {pendingDelete.length === 1 ? 'Delete account' : `Delete ${pendingDelete.length} accounts`}
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
