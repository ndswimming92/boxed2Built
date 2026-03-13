import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  customerPortalService,
  PortalServiceError,
  type CustomerPortalInvoice,
  type CustomerPortalJob,
  type CustomerPortalProfile,
} from '../../services/customerPortalService';

export default function PortalDashboardPage() {
  const { user, signOut } = useAuth();
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
        if (err instanceof PortalServiceError) {
          setError(err.message);
        } else {
          setError('Something went wrong while loading your portal data.');
        }
      } finally {
        setLoading(false);
      }
    };

    void loadPortalData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Portal Dashboard</h1>
              <p className="text-slate-600 mt-1">Welcome back{user?.email ? `, ${user.email}` : ''}.</p>
            </div>
            <button
              type="button"
              onClick={() => signOut()}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800"
            >
              Sign out
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <p className="text-slate-700">Loading your portal data...</p>
          ) : (
            <div className="space-y-4">
              <p className="text-slate-700">
                Signed in as <strong>{profile?.full_name || user?.email || 'Customer'}</strong>.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-lg border border-slate-200 p-4">
                  <h2 className="text-sm font-medium text-slate-500">My Jobs</h2>
                  <p className="text-2xl font-semibold text-slate-900">{jobs.length}</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-4">
                  <h2 className="text-sm font-medium text-slate-500">My Invoices</h2>
                  <p className="text-2xl font-semibold text-slate-900">{invoices.length}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
