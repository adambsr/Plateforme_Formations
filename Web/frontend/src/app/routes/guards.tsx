import { Navigate, Outlet, useLocation } from 'react-router';

import { useAuth } from '../../core/auth/AuthContext.js';
import type { UserRole } from '../../core/auth/types.js';
import { roleHomePath } from './destinations.js';
import { ForbiddenPage } from '../../features/system/SystemPages.js';

export function PublicOnly() {
  const { status, user } = useAuth();
  if (status === 'loading' || status === 'logging-out')
    return <div className="screen-message">Chargement de la session…</div>;
  if (user !== null)
    return (
      <Navigate
        to={
          user.mustChangePassword ? '/change-password' : roleHomePath(user.role)
        }
        replace
      />
    );
  return <Outlet />;
}

export function RequireAuthentication() {
  const { status, user } = useAuth();
  const location = useLocation();
  if (status === 'loading' || status === 'logging-out')
    return <div className="screen-message">Chargement de la session…</div>;
  if (user === null)
    return (
      <Navigate
        to="/status/authentication-required"
        state={{ from: `${location.pathname}${location.search}` }}
        replace
      />
    );
  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }
  return <Outlet />;
}

export function RequireRole({ roles }: { roles: readonly UserRole[] }) {
  const { user } = useAuth();
  return user !== null && roles.includes(user.role) ? (
    <Outlet />
  ) : (
    <ForbiddenPage />
  );
}
