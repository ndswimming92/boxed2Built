import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PortalLayout from '../../components/portal/PortalLayout';
import { PortalServiceError } from '../../services/customerPortalService';
import {
  privacyPortalService,
  type CustomerPrivacyRequest,
  type CustomerPrivacyExportJob,
} from '../../services/privacyPortalService';

const fmt = (value: string | null) => (value ? new Date(value).toLocaleString() : '—');

export default function PortalPrivacyPage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<CustomerPrivacyRequest[]>([]);
  const [jobs, setJobs] = useState<CustomerPrivacyExportJob[]>([]);
  const [emailConsent, setEmailConsent] = useState(false);
  const [gracePeriodDays, setGracePeriodDays] = useState(30);
  const [confirmRequestId, setConfirmRequestId] = useState('');
  const [confirmToken, setConfirmToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [privacyRequests, exportJobs, consent] = await Promise.all([
        privacyPortalService.getMyPrivacyRequests(),
        privacyPortalService.getMyExportJobs(),
        privacyPortalService.getMyMarketingConsent(),
      ]);
      setRequests(privacyRequests);
      setJobs(exportJobs);
      setEmailConsent(consent?.email_marketing_enabled ?? false);
    } catch (err) {
      if (err instanceof PortalServiceError && err.code === 'SESSION_EXPIRED') {
        navigate('/portal/login?error=session_expired', { replace: true });
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load privacy center.');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeDeletionRequest = useMemo(
    () => requests.find((item) => item.request_type === 'account_deletion' && !['completed', 'rejected', 'cancelled'].includes(item.status)),
    [requests],
  );

  const runAction = async (actionKey: string, fn: () => Promise<void>, successMessage: string) => {
    setBusyAction(actionKey);
    setError(null);
    setSuccess(null);

    try {
      await fn();
      await load();
      setSuccess(successMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <PortalLayout title="Privacy Center" subtitle="Manage data export, account deletion, and marketing consent.">
      <div className="space-y-6">
        {error ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {success ? <p className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">{success}</p> : null}

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Download my data</h3>
          <p className="mt-1 text-sm text-slate-600">Create an asynchronous export request. You can return later when the file is ready.</p>
          <button
            type="button"
            disabled={busyAction === 'export'}
            onClick={() => void runAction('export', () => privacyPortalService.submitDataExportRequest().then(() => undefined), 'Export request submitted.')}
            className="mt-3 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busyAction === 'export' ? 'Submitting…' : 'Request data export'}
          </button>

          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium text-slate-800">Export jobs</p>
            {loading ? <p className="text-sm text-slate-500">Loading export jobs…</p> : null}
            {!loading && jobs.length === 0 ? <p className="text-sm text-slate-500">No export jobs yet.</p> : null}
            {jobs.map((job) => (
              <div key={job.id} className="rounded border border-slate-200 p-3 text-sm">
                <p>Status: <span className="font-medium">{job.status}</span></p>
                <p>Created: {fmt(job.created_at)}</p>
                <p>Expires: {fmt(job.expires_at)}</p>
                {job.download_url ? <a className="text-blue-700 underline" href={job.download_url} target="_blank" rel="noreferrer">Download export</a> : null}
                {job.error_message ? <p className="text-red-700">Error: {job.error_message}</p> : null}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Request account deletion</h3>
          <p className="mt-1 text-sm text-slate-600">Deletion is delayed with a grace period and requires explicit confirmation.</p>

          <div className="mt-3 flex items-end gap-3">
            <label className="text-sm text-slate-700">
              Grace period (days)
              <input
                type="number"
                min={1}
                max={90}
                value={gracePeriodDays}
                onChange={(event) => setGracePeriodDays(Number(event.target.value) || 30)}
                className="ml-2 w-20 rounded-md border border-slate-300 px-2 py-1"
              />
            </label>
            <button
              type="button"
              disabled={busyAction === 'deletion'}
              onClick={() => void runAction('deletion', () => privacyPortalService.submitAccountDeletionRequest(gracePeriodDays).then(() => undefined), 'Deletion request submitted. Confirm it below.')}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
            >
              {busyAction === 'deletion' ? 'Submitting…' : 'Request deletion'}
            </button>
          </div>

          {activeDeletionRequest ? (
            <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p>Current deletion request status: <strong>{activeDeletionRequest.status}</strong></p>
              <p>Grace period ends: {fmt(activeDeletionRequest.grace_period_ends_at)}</p>
              <p className="mt-2">To confirm deletion, enter request ID and confirmation token.</p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <input
                  value={confirmRequestId}
                  onChange={(event) => setConfirmRequestId(event.target.value)}
                  placeholder="Request ID"
                  className="rounded-md border border-slate-300 px-2 py-1"
                />
                <input
                  value={confirmToken}
                  onChange={(event) => setConfirmToken(event.target.value)}
                  placeholder="Confirmation token"
                  className="rounded-md border border-slate-300 px-2 py-1"
                />
              </div>
              <button
                type="button"
                disabled={busyAction === 'confirm-deletion' || !confirmRequestId || !confirmToken}
                onClick={() => void runAction('confirm-deletion', () => privacyPortalService.confirmAccountDeletionRequest(confirmRequestId, confirmToken).then(() => undefined), 'Deletion request confirmed and scheduled.')}
                className="mt-2 rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {busyAction === 'confirm-deletion' ? 'Confirming…' : 'Confirm deletion request'}
              </button>
            </div>
          ) : null}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Marketing consent</h3>
          <p className="mt-1 text-sm text-slate-600">Control promotional email permissions.</p>

          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={emailConsent} onChange={(event) => setEmailConsent(event.target.checked)} />
              Email marketing
            </label>
          </div>

          <button
            type="button"
            disabled={busyAction === 'consent'}
            onClick={() => void runAction('consent', () => privacyPortalService.upsertMyMarketingConsent({ emailEnabled: emailConsent }).then(() => undefined), 'Marketing consent saved.')}
            className="mt-3 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busyAction === 'consent' ? 'Saving…' : 'Save consent'}
          </button>
        </section>
      </div>
    </PortalLayout>
  );
}
