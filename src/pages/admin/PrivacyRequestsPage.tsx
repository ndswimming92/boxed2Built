import React, { useEffect, useState } from 'react';
import {
  privacyPortalService,
  type CustomerPrivacyRequest,
  type CustomerPrivacyExportJob,
  type CustomerMarketingConsent,
  type PrivacyAuditEvent,
  type PrivacyExportJobStatus,
} from '../../services/privacyPortalService';

const fmt = (value: string | null) => (value ? new Date(value).toLocaleString() : '—');

export default function PrivacyRequestsPage() {
  const [requests, setRequests] = useState<CustomerPrivacyRequest[]>([]);
  const [jobs, setJobs] = useState<CustomerPrivacyExportJob[]>([]);
  const [consents, setConsents] = useState<CustomerMarketingConsent[]>([]);
  const [auditTrail, setAuditTrail] = useState<PrivacyAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, j, c, a] = await Promise.all([
        privacyPortalService.getAdminPrivacyRequests(),
        privacyPortalService.getAdminExportJobs(),
        privacyPortalService.getAdminMarketingConsents(),
        privacyPortalService.getAdminPrivacyAuditTrail(),
      ]);
      setRequests(r);
      setJobs(j);
      setConsents(c);
      setAuditTrail(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load privacy dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const updateJob = async (jobId: string, status: PrivacyExportJobStatus) => {
    await privacyPortalService.adminUpdateExportJob(jobId, status);
    await load();
  };

  const processDeletion = async (requestId: string, status: 'processing' | 'completed' | 'rejected' | 'cancelled') => {
    await privacyPortalService.adminProcessDeletionRequest(requestId, status);
    await load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Privacy Operations</h1>
        <p className="text-sm text-slate-600">Process export/deletion requests and monitor immutable audit records.</p>
      </div>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-600">Loading privacy dashboard…</p> : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Data export jobs</h2>
        <div className="mt-3 space-y-2">
          {jobs.map((job) => (
            <div key={job.id} className="rounded border border-slate-200 p-3 text-sm">
              <p><strong>{job.status}</strong> · {job.id}</p>
              <p>Customer: {job.customer_id}</p>
              <p>Created: {fmt(job.created_at)} · Completed: {fmt(job.completed_at)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className="rounded border px-2 py-1" onClick={() => void updateJob(job.id, 'processing')}>Mark processing</button>
                <button type="button" className="rounded border px-2 py-1" onClick={() => void updateJob(job.id, 'ready')}>Mark ready</button>
                <button type="button" className="rounded border px-2 py-1" onClick={() => void updateJob(job.id, 'failed')}>Mark failed</button>
              </div>
            </div>
          ))}
          {!loading && jobs.length === 0 ? <p className="text-sm text-slate-500">No export jobs queued.</p> : null}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Account deletion workflow</h2>
        <div className="mt-3 space-y-2">
          {requests.filter((item) => item.request_type === 'account_deletion').map((request) => (
            <div key={request.id} className="rounded border border-slate-200 p-3 text-sm">
              <p><strong>{request.status}</strong> · {request.id}</p>
              <p>Customer: {request.customer_id}</p>
              <p>Confirmed: {fmt(request.confirmed_at)} · Grace ends: {fmt(request.grace_period_ends_at)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className="rounded border px-2 py-1" onClick={() => void processDeletion(request.id, 'processing')}>Set processing</button>
                <button type="button" className="rounded border px-2 py-1" onClick={() => void processDeletion(request.id, 'completed')}>Complete deletion</button>
                <button type="button" className="rounded border px-2 py-1" onClick={() => void processDeletion(request.id, 'rejected')}>Reject</button>
              </div>
            </div>
          ))}
          {!loading && requests.filter((item) => item.request_type === 'account_deletion').length === 0 ? <p className="text-sm text-slate-500">No deletion requests yet.</p> : null}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Marketing consent register</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-2">Customer</th><th>Email</th><th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {consents.map((consent) => (
                <tr key={consent.id} className="border-t border-slate-100">
                  <td className="py-2">{consent.customer_id}</td>
                  <td>{consent.email_marketing_enabled ? 'Yes' : 'No'}</td>
                  <td>{fmt(consent.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && consents.length === 0 ? <p className="text-sm text-slate-500">No consent records.</p> : null}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Immutable privacy audit trail</h2>
        <div className="mt-3 space-y-2">
          {auditTrail.map((event) => (
            <div key={event.id} className="rounded border border-slate-200 p-3 text-xs">
              <p><strong>{event.event_type}</strong> ({event.actor_type}) · {fmt(event.created_at)}</p>
              <p>Subject: {event.subject_table} / {event.subject_id ?? '—'}</p>
            </div>
          ))}
          {!loading && auditTrail.length === 0 ? <p className="text-sm text-slate-500">No audit events.</p> : null}
        </div>
      </section>
    </div>
  );
}
