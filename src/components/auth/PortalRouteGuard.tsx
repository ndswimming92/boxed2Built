import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import PageLoader from '../ui/PageLoader';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminUser, isClientAuthorized } from '../../utils/authorization';
import { useHydrated } from '../../hooks/useHydrated';

interface PortalRouteGuardProps {
  children: React.ReactNode;
}

export default function PortalRouteGuard({ children }: PortalRouteGuardProps) {
  const { user, loading } = useAuth();
  const location = useLocation();
  // Portal pages are prerendered with this loader in the HTML. Auth state can
  // resolve from localStorage before hydration finishes, so keep rendering the
  // loader for the first client render to avoid a hydration mismatch.
  const hydrated = useHydrated();

  if (!hydrated || loading) {
    return <PageLoader message="Verifying portal access..." />;
  }

  if (!user) {
    const nextPath = `${location.pathname}${location.search}`;
    return <Navigate to={`/portal/login?next=${encodeURIComponent(nextPath)}`} replace />;
  }

  if (isAdminUser(user)) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (!isClientAuthorized(user)) {
    return <Navigate to="/portal/login" replace />;
  }

  return <>{children}</>;
}
