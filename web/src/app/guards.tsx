import type { ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { adminToken, studentToken, useToken } from '../lib/session';
import { AdminLoginPage } from '../features/auth/AdminLoginPage';

export function RequireStudent() {
  const token = useToken(studentToken);
  return token ? <Outlet /> : <Navigate to="/login" replace />;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const token = useToken(adminToken);
  return token ? <>{children}</> : <AdminLoginPage />;
}
