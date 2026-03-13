import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PortalLayout from '../../components/portal/PortalLayout';
import { customerPortalService, PortalServiceError, type CustomerPortalJob } from '../../services/customerPortalService';

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleDateString() : 'N/A');
const formatCurrency = (value: number | null) => (typeof value === 'number' ? `$${value.toFixed(2)}` : 'N/A');

export default function PortalJobDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<CustomerPortalJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('Job id is missing.');
      setLoading(false);
      return;
    }

    const loadJob = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await customerPortalService.getMyJobById(id);
        setJob(data);
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

    void loadJob();
  }, [id, navigate]);

  return (
    <PortalLayout title="Job details" subtitle="Read-only view of your project information">
      <Link to="/portal/jobs" className="mb-4 inline-flex text-sm text-blue-700 hover:underline">← Back to jobs</Link>

      {loading ? <p className="text-sm text-slate-600">Loading job details...</p> : null}
      {!loading && error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}
      {!loading && !error && !job ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">No job found.</div>
      ) : null}
      {!loading && !error && job ? (
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
      ) : null}
    </PortalLayout>
  );
}
