import React from 'react';
import { Navigate } from 'react-router-dom';
import PageLoader from '../ui/PageLoader';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminUser } from '../../utils/authorization';

interface AdminRouteGuardProps {
  children: React.ReactNode;
}

export default function AdminRouteGuard({ children }: AdminRouteGuardProps) {
  const { user, loading } = useAuth();

  if (loading) {
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
