import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PortalLayout from '../../components/portal/PortalLayout';
import {
  customerPortalService,
  PortalServiceError,
  type CustomerPortalInvoice,
  type CustomerPortalJob,
  type CustomerPortalProfile,
} from '../../services/customerPortalService';
import { customerNotificationService, type CustomerNotificationPreferences } from '../../services/customerNotificationService';

const WALKTHROUGH_STORAGE_KEY = 'portal_walkthrough_dismissed_v1';

const formatDate = (value: string | null) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString();
};

export default function PortalDashboardPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<CustomerPortalProfile | null>(null);
  const [jobs, setJobs] = useState<CustomerPortalJob[]>([]);
  const [invoices, setInvoices] = useState<CustomerPortalInvoice[]>([]);
  const [preferences, setPreferences] = useState<CustomerNotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsAccountLinking, setNeedsAccountLinking] = useState(false);
  const [walkthroughDismissed, setWalkthroughDismissed] = useState(() => localStorage.getItem(WALKTHROUGH_STORAGE_KEY) === 'true');

  useEffect(() => {
    const loadPortalData = async () => {
      setLoading(true);
      setError(null);
      setNeedsAccountLinking(false);

      try {
        const [myProfile, myJobs, myInvoices, myPreferences] = await Promise.all([
          customerPortalService.getMyProfile(),
          customerPortalService.getMyJobs(),
          customerPortalService.getMyInvoices(),
          customerNotificationService.getMyPreferences(),
        ]);

        setProfile(myProfile);
        setJobs(myJobs);
        setInvoices(myInvoices);
        setPreferences(myPreferences);
      } catch (err) {
        if (err instanceof PortalServiceError && err.code === 'SESSION_EXPIRED') {
          navigate('/portal/login?error=session_expired', { replace: true });
          return;
        }

        if (err instanceof PortalServiceError && err.code === 'NOT_FOUND') {
          setNeedsAccountLinking(true);
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

  const shouldShowWalkthrough = !walkthroughDismissed;
  const hasMissingContactPreferences = !preferences || !preferences.email_enabled || (profile?.phone?.trim() ? false : true);

  const handleCompleteWalkthrough = async () => {
    localStorage.setItem(WALKTHROUGH_STORAGE_KEY, 'true');
    setWalkthroughDismissed(true);

    try {
      await customerPortalService.trackFunnelEvent('walkthrough_completed', {
        source: 'dashboard_walkthrough',
      });
    } catch {
      // Non-blocking UX action.
    }
  };

  return (
    <PortalLayout
      title={`Welcome${profile?.full_name ? `, ${profile.full_name}` : ''}`}
      subtitle="Track your project progress and recent account activity"
    >
      {loading ? <p className="text-sm text-slate-600">Loading dashboard summary...</p> : null}

      {!loading && error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {!loading && needsAccountLinking ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
          <p className="font-medium">No linked records found for this portal account yet.</p>
          <p className="mt-1">Use the secure account-linking flow to connect your existing customer history.</p>
          <Link to="/portal/link-account" className="mt-3 inline-flex rounded-md bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700">
            Link my account
          </Link>
        </div>
      ) : null}
      {!loading && !error ? (
        <div className="space-y-6">
          {shouldShowWalkthrough ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <h3 className="text-sm font-semibold text-blue-900">First-login walkthrough</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-blue-800">
                <li>Jobs: Track project status, schedule, and details in <Link className="font-medium underline" to="/portal/jobs">My Jobs</Link>.</li>
                <li>Invoices: Review balances and securely pay from <Link className="font-medium underline" to="/portal/invoices">Invoices</Link>.</li>
                <li>Support: Send questions in <Link className="font-medium underline" to="/portal/support">Support</Link>.</li>
                <li>Profile: Keep your details updated in <Link className="font-medium underline" to="/portal/profile">My Profile</Link>.</li>
              </ul>
              <button
                type="button"
                onClick={() => void handleCompleteWalkthrough()}
                className="mt-3 rounded-md bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800"
              >
                Got it
              </button>
            </div>
          ) : null}

          {hasMissingContactPreferences ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">Complete profile for better updates</p>
              <p className="mt-1">Add your phone and confirm notification preferences so you do not miss important project updates.</p>
              <div className="mt-3 flex gap-2">
                <Link to="/portal/profile" className="rounded-md bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700">Update profile</Link>
                <Link to="/portal/notifications" className="rounded-md border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100">Notification settings</Link>
              </div>
            </div>
          ) : null}

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
