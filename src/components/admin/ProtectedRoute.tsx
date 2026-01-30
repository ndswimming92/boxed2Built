import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import PageLoader from '../ui/PageLoader';
import { isUserAuthorized, getAuthorizationError } from '../../utils/authorization';
import { AlertCircle } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, signOut } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        setIsCheckingAuth(false);
        return;
      }

      if (!isUserAuthorized(user)) {
        const errorMessage = getAuthorizationError(user);
        setAuthError(errorMessage);

        setTimeout(() => {
          signOut();
        }, 3000);
      } else {
        setIsCheckingAuth(false);
      }
    }
  }, [user, loading, signOut]);

  if (loading || isCheckingAuth) {
    return <PageLoader message="Verifying authentication..." />;
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
            <p className="text-slate-600 mb-6">{authError}</p>
            <p className="text-sm text-slate-500 mb-4">
              You will be redirected to the login page in a moment...
            </p>
            <a
              href="/admin/login"
              className="inline-block text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Return to Login
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
}
