import React from 'react';
import { Navigate } from 'react-router-dom';
import { useProfile } from '../hooks/useProfile';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { profile, loading } = useProfile();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !profile.is_global_admin) {
    return <Navigate to="/profile" replace />;
  }

  return <>{children}</>;
}