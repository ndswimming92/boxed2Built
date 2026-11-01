import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import PageLoader from '../ui/PageLoader';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminUser } from '../../utils/authorization';
import { useHydrated } from '../../hooks/useHydrated';
import { clearAdminReturnPath, rememberAdminReturnPath } from '../../utils/adminReturnPath';

interface AdminRouteGuardProps {
  children: React.ReactNode;
}

export default function AdminRouteGuard({ children }: AdminRouteGuardProps) {
  const { user, loading } = useAuth();
  // Admin pages are prerendered with this loader in the HTML. Auth state can
  // resolve from localStorage before hydration finishes, so keep rendering the
  // loader for the first client render to avoid a hydration mismatch.
  const hydrated = useHydrated();
  const location = useLocation();
  const signedOut = hydrated && !loading && !user;
  const signedInAdmin = hydrated && !loading && !!user && isAdminUser(user);

  // Someone sent to sign in is remembered, so a link into the admin (such as the one
  // in the new-request text) still lands where it pointed once they are in. Once an
  // admin is through, any remembered path is stale and goes.
  useEffect(() => {
    if (signedOut) rememberAdminReturnPath(`${location.pathname}${location.search}`);
    else if (signedInAdmin) clearAdminReturnPath();
  }, [signedOut, signedInAdmin, location.pathname, location.search]);

  if (!hydrated || loading) {
    return <PageLoader message="Verifying admin access..." />;
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  if (!isAdminUser(user)) {
    return <Navigate to="/portal/dashboard" replace />;
  }

  return <>{children}</>;
}
