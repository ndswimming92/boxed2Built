import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PortalLayout from '../../components/portal/PortalLayout';
import {
  customerPortalService,
  PortalServiceError,
  type CustomerPortalInvoice,
  type CustomerPortalJob,
  type CustomerPortalProfile,
} from '../../services/customerPortalService';

const formatDate = (value: string | null) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString();
};

export default function PortalDashboardPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<CustomerPortalProfile | null>(null);
  const [jobs, setJobs] = useState<CustomerPortalJob[]>([]);
  const [invoices, setInvoices] = useState<CustomerPortalInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPortalData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [myProfile, myJobs, myInvoices] = await Promise.all([
          customerPortalService.getMyProfile(),
          customerPortalService.getMyJobs(),
          customerPortalService.getMyInvoices(),
        ]);

        setProfile(myProfile);
        setJobs(myJobs);
        setInvoices(myInvoices);
      } catch (err) {
        if (err instanceof PortalServiceError && err.code === 'SESSION_EXPIRED') {
          navigate('/portal/login?error=session_expired', { replace: true });
          return;
        }

        setError(err instanceof Error ? err.message : 'Something went wrong while loading your portal data.');
      } finally {
        setLoading(false);
      }
    };

    void loadPortalData();
  }, [navigate]);

  const latestActivity = useMemo(() => {
    const entries = [
      ...jobs.map((job) => ({
        id: job.id,
        timestamp: job.updated_at,
        label: `Job ${job.job_type || 'project'} marked ${job.job_status.replace('_', ' ')}`,
      })),
      ...invoices.map((invoice) => ({
        id: invoice.id,
        timestamp: invoice.created_at,
        label: `Invoice ${invoice.invoice_number} is ${invoice.status.replace('_', ' ')}`,
      })),
    ];

    return entries
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 3);
  }, [jobs, invoices]);

  const scheduledJobsCount = jobs.filter((job) => ['scheduled', 'in_progress'].includes(job.job_status)).length;
  const completedJobsCount = jobs.filter((job) => job.job_status === 'completed').length;

  return (
    <PortalLayout
      title={`Welcome${profile?.full_name ? `, ${profile.full_name}` : ''}`}
      subtitle="Track your project progress and recent account activity"
    >
      {loading ? <p className="text-sm text-slate-600">Loading dashboard summary...</p> : null}

      {!loading && error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {!loading && !error ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Total jobs</p>
              <p className="mt-1 text-3xl font-semibold text-slate-900">{jobs.length}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Active jobs</p>
              <p className="mt-1 text-3xl font-semibold text-slate-900">{scheduledJobsCount}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Completed jobs</p>
              <p className="mt-1 text-3xl font-semibold text-slate-900">{completedJobsCount}</p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Latest activity</h3>
            {latestActivity.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">No recent activity yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {latestActivity.map((activity) => (
                  <li key={activity.id} className="rounded-md border border-slate-200 p-3">
                    <p className="text-sm font-medium text-slate-800">{activity.label}</p>
                    <p className="text-xs text-slate-500">{formatDate(activity.timestamp)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </PortalLayout>
  );
}
