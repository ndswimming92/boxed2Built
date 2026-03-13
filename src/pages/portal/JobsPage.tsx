import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PortalLayout from '../../components/portal/PortalLayout';
import { customerPortalService, PortalServiceError, type CustomerPortalJob } from '../../services/customerPortalService';
import { getOfflineFriendlyErrorMessage } from '../../utils/retry';

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleDateString() : 'N/A');
const PAGE_SIZE = 20;

export default function PortalJobsPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<CustomerPortalJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const hasTrackedFirstJobView = useRef(false);

  const loadJobs = useCallback(async (nextPage: number, append = false) => {
    setError(null);
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const data = await customerPortalService.getMyJobs({ page: nextPage, pageSize: PAGE_SIZE });
      setHasMore(data.length === PAGE_SIZE);
      setPage(nextPage);
      setJobs((prev) => (append ? [...prev, ...data] : data));

      if (!append && data.length > 0 && !hasTrackedFirstJobView.current) {
        hasTrackedFirstJobView.current = true;
        void customerPortalService.trackFunnelEvent('first_job_view', {
          source: 'jobs_page',
          visible_jobs_count: data.length,
        }).catch(() => undefined);
      }
    } catch (err) {
      if (err instanceof PortalServiceError && err.code === 'SESSION_EXPIRED') {
        navigate('/portal/login?error=session_expired', { replace: true });
        return;
      }
      const fallback = err instanceof Error ? err.message : 'Unable to load jobs.';
      setError(getOfflineFriendlyErrorMessage(fallback));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [navigate]);

  useEffect(() => {
    void loadJobs(0);
  }, [loadJobs]);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loading || loadingMore) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        void loadJobs(page + 1, true);
      }
    }, { rootMargin: '100px' });

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, loadJobs, page]);

  return (
    <PortalLayout title="My Jobs" subtitle="Read-only list of your projects and statuses">
      {loading ? <p className="text-sm text-slate-600">Loading jobs...</p> : null}
      {!loading && error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{error}</p>
          <button type="button" onClick={() => void loadJobs(page, page > 0)} className="mt-2 rounded-md border border-red-300 px-2 py-1 text-xs font-medium">Retry</button>
        </div>
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
          <div ref={sentinelRef} className="p-3 text-center text-xs text-slate-500">
            {loadingMore ? 'Loading more…' : hasMore ? 'Scroll to load more' : 'End of job history'}
          </div>
        </div>
      ) : null}
    </PortalLayout>
  );
}
