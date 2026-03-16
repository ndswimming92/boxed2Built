import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import PageLoader from '../ui/PageLoader';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminUser, isClientAuthorized } from '../../utils/authorization';

interface PortalRouteGuardProps {
  children: React.ReactNode;
}

export default function PortalRouteGuard({ children }: PortalRouteGuardProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
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
