import React, { useEffect, useMemo, useState } from 'react';
import {
  getPortalAdoptionReport,
  getPortalInactiveCustomersReport,
  type PortalAdoptionReportRow,
  type PortalInactiveCustomerRow,
} from '../../services/portalAdoptionReportService';

const formatDateTime = (value: string | null) => (value ? new Date(value).toLocaleString() : '—');

export default function PortalAdoptionPage() {
  const [adoptionRows, setAdoptionRows] = useState<PortalAdoptionReportRow[]>([]);
  const [inactiveRows, setInactiveRows] = useState<PortalInactiveCustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-base font-semibold text-slate-900">Portal adoption by customer</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Customer</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Funnel stage</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Invited</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">First login</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">First job view</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Repeat login</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {adoptionRows.map((row) => (
                    <tr key={row.customer_id}>
                      <td className="px-4 py-2 text-sm text-slate-700">
                        <p className="font-medium text-slate-900">{row.full_name || 'Unknown customer'}</p>
                        <p className="text-xs text-slate-500">{row.email || 'No email'}</p>
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-700">{row.funnel_stage.replaceAll('_', ' ')}</td>
                      <td className="px-4 py-2 text-sm text-slate-700">{formatDateTime(row.invited_at)}</td>
                      <td className="px-4 py-2 text-sm text-slate-700">{formatDateTime(row.first_login_at)}</td>
                      <td className="px-4 py-2 text-sm text-slate-700">{formatDateTime(row.first_job_view_at)}</td>
                      <td className="px-4 py-2 text-sm text-slate-700">{formatDateTime(row.repeat_login_at)}</td>
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
                      <td className="px-4 py-2 text-sm text-slate-700">{row.inactivity_status.replaceAll('_', ' ')}</td>
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
    </div>
  );
}
