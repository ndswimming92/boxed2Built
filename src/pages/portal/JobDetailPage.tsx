import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PortalLayout from '../../components/portal/PortalLayout';
import {
  customerPortalService,
  PortalServiceError,
  type CustomerJobActionRequest,
  type CustomerPortalJob,
  type JobActionRequestType,
} from '../../services/customerPortalService';

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleDateString() : 'N/A');
const formatDateTime = (value: string | null) => (value ? new Date(value).toLocaleString() : 'N/A');
const formatCurrency = (value: number | null) => (typeof value === 'number' ? `$${value.toFixed(2)}` : 'N/A');

const actionTypeLabel: Record<JobActionRequestType, string> = {
  request_reschedule: 'Reschedule request',
  cancel_request: 'Cancellation request',
  add_note: 'Job note',
};

export default function PortalJobDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<CustomerPortalJob | null>(null);
  const [requests, setRequests] = useState<CustomerJobActionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [actionType, setActionType] = useState<JobActionRequestType>('add_note');
  const [requestMessage, setRequestMessage] = useState('');
  const [requestedScheduleDate, setRequestedScheduleDate] = useState('');

  const loadJob = async () => {
    if (!id) {
      setError('Job id is missing.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [jobData, requestData] = await Promise.all([
        customerPortalService.getMyJobById(id),
        customerPortalService.getMyJobActionRequests(id),
      ]);
      setJob(jobData);
      setRequests(requestData);
    } catch (err) {
      if (err instanceof PortalServiceError && err.code === 'SESSION_EXPIRED') {
        navigate('/portal/login?error=session_expired', { replace: true });
        return;
      }
      setError(err instanceof Error ? err.message : 'Unable to load job details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadJob();
  }, [id, navigate]);

  const latestPending = useMemo(
    () => requests.find((request) => request.request_state === 'pending'),
    [requests]
  );

  const submitRequest = async () => {
    if (!id) return;

    setSubmitting(true);
    setError(null);
    try {
      await customerPortalService.submitJobActionRequest({
        jobId: id,
        actionType,
        requestMessage,
        requestedScheduleDate: actionType === 'request_reschedule' && requestedScheduleDate
          ? new Date(requestedScheduleDate).toISOString()
          : null,
      });
      setRequestMessage('');
      setRequestedScheduleDate('');
      await loadJob();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PortalLayout title="Job details" subtitle="Project details and customer action requests">
      <div className="mb-4 flex items-center gap-3">
        <Link to="/portal/jobs" className="inline-flex text-sm text-blue-700 hover:underline">← Back to jobs</Link>
        {id ? (
          <Link
            to={`/portal/support?jobId=${id}&subject=${encodeURIComponent(`Help with ${job?.job_type ?? 'job'}`)}`}
            className="inline-flex rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Contact support about this job
          </Link>
        ) : null}
      </div>

      {loading ? <p className="text-sm text-slate-600">Loading job details...</p> : null}
      {!loading && error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}
      {!loading && !error && !job ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">No job found.</div>
      ) : null}
      {!loading && !error && job ? (
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">{job.job_type || 'Project'}</h3>
            <p className="mt-1 text-sm text-slate-600">{job.job_description || 'No description provided.'}</p>

            <dl className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</dt>
                <dd className="mt-1 text-sm capitalize text-slate-800">{job.job_status.replace('_', ' ')}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Scheduled date</dt>
                <dd className="mt-1 text-sm text-slate-800">{formatDate(job.date_scheduled)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Completed date</dt>
                <dd className="mt-1 text-sm text-slate-800">{formatDate(job.date_completed)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Location</dt>
                <dd className="mt-1 text-sm text-slate-800">{job.location_city || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quoted price</dt>
                <dd className="mt-1 text-sm text-slate-800">{formatCurrency(job.quoted_price)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Final price</dt>
                <dd className="mt-1 text-sm text-slate-800">{formatCurrency(job.final_price)}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Request an update</h3>
            <p className="mt-1 text-sm text-slate-600">
              Submit a reschedule request, cancellation request, or note. All requests are moderated by our team.
            </p>

            {latestPending ? (
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                You currently have a pending request ({actionTypeLabel[latestPending.action_type]}).
              </p>
            ) : null}

            <div className="mt-4 grid gap-3">
              <label className="text-sm text-slate-700">
                Action type
                <select
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={actionType}
                  onChange={(event) => setActionType(event.target.value as JobActionRequestType)}
                >
                  <option value="add_note">Add note</option>
                  <option value="request_reschedule">Request reschedule</option>
                  <option value="cancel_request">Request cancellation</option>
                </select>
              </label>

              {actionType === 'request_reschedule' ? (
                <label className="text-sm text-slate-700">
                  Requested new date/time
                  <input
                    type="datetime-local"
                    value={requestedScheduleDate}
                    onChange={(event) => setRequestedScheduleDate(event.target.value)}
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              ) : null}

              <label className="text-sm text-slate-700">
                Message
                <textarea
                  value={requestMessage}
                  onChange={(event) => setRequestMessage(event.target.value)}
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Add context for your request"
                />
              </label>

              <button
                type="button"
                onClick={() => void submitRequest()}
                disabled={submitting}
                className="inline-flex w-fit rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Submitting…' : 'Submit request'}
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Request history</h3>
            {requests.length === 0 ? <p className="mt-2 text-sm text-slate-600">No action requests yet.</p> : null}
            {requests.length > 0 ? (
              <ul className="mt-3 space-y-3">
                {requests.map((request) => (
                  <li key={request.id} className="rounded-md border border-slate-200 p-3">
                    <p className="text-sm font-semibold text-slate-900">
                      {actionTypeLabel[request.action_type]}{' '}
                      <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-700">
                        {request.request_state}
                      </span>
                    </p>
                    {request.request_message ? <p className="mt-1 text-sm text-slate-700">{request.request_message}</p> : null}
                    {request.requested_schedule_date ? (
                      <p className="mt-1 text-xs text-slate-500">Requested date: {formatDateTime(request.requested_schedule_date)}</p>
                    ) : null}
                    {request.moderation_note ? (
                      <p className="mt-1 text-xs text-slate-500">Team note: {request.moderation_note}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-slate-500">Submitted {formatDateTime(request.created_at)}</p>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}
    </PortalLayout>
  );
}
