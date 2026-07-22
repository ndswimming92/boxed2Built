import React from 'react';
import { Navigate } from 'react-router-dom';
import PageLoader from '../ui/PageLoader';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminUser } from '../../utils/authorization';
import { useHydrated } from '../../hooks/useHydrated';

interface AdminRouteGuardProps {
  children: React.ReactNode;
}

export default function AdminRouteGuard({ children }: AdminRouteGuardProps) {
  const { user, loading } = useAuth();
  // Admin pages are prerendered with this loader in the HTML. Auth state can
  // resolve from localStorage before hydration finishes, so keep rendering the
  // loader for the first client render to avoid a hydration mismatch.
  const hydrated = useHydrated();

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
