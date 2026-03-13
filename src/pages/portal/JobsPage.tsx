import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PortalLayout from '../../components/portal/PortalLayout';
import { customerPortalService, PortalServiceError, type CustomerPortalJob } from '../../services/customerPortalService';

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleDateString() : 'N/A');

export default function PortalJobsPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<CustomerPortalJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadJobs = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await customerPortalService.getMyJobs();
        setJobs(data);
      } catch (err) {
        if (err instanceof PortalServiceError && err.code === 'SESSION_EXPIRED') {
          navigate('/portal/login?error=session_expired', { replace: true });
          return;
        }
        setError(err instanceof Error ? err.message : 'Unable to load jobs.');
      } finally {
        setLoading(false);
      }
    };

    void loadJobs();
  }, [navigate]);

  return (
    <PortalLayout title="My Jobs" subtitle="Read-only list of your projects and statuses">
      {loading ? <p className="text-sm text-slate-600">Loading jobs...</p> : null}
      {!loading && error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}
      {!loading && !error && jobs.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">No jobs found yet.</div>
      ) : null}
      {!loading && !error && jobs.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Job</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Scheduled</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td className="px-4 py-3 text-sm text-slate-800">
                    <Link to={`/portal/jobs/${job.id}`} className="font-medium text-blue-700 hover:underline">
                      {job.job_type || 'Project'}
                    </Link>
                    <p className="text-xs text-slate-500">{job.job_description || 'No description'}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 capitalize">{job.job_status.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{formatDate(job.date_scheduled)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{job.location_city || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </PortalLayout>
  );
}
