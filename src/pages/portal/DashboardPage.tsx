import React from 'react';
import { useAuth } from '../../contexts/AuthContext';

export default function PortalDashboardPage() {
  const { user, signOut } = useAuth();

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

          <p className="text-slate-700">
            Your dedicated customer portal is now protected with role-specific routing and authentication.
          </p>
        </div>
      </div>
    </div>
  );
}
