import React from 'react';
import { Navigate } from 'react-router-dom';
import PageLoader from '../ui/PageLoader';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminUser, isClientAuthorized } from '../../utils/authorization';

interface PortalRouteGuardProps {
  children: React.ReactNode;
}

export default function PortalRouteGuard({ children }: PortalRouteGuardProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageLoader message="Verifying portal access..." />;
  }

  if (!user) {
    return <Navigate to="/portal/login" replace />;
  }

  if (isAdminUser(user)) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (!isClientAuthorized(user)) {
    return <Navigate to="/portal/login" replace />;
  }

  return <>{children}</>;
}
