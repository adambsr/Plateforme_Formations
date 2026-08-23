import { Link, Outlet } from 'react-router';
import { Brand } from '../../shared/components/Brand.js';

export function AuthLayout() {
  return (
    <main className="auth-shell">
      <Brand className="auth-brand" />
      <Outlet />
      <Link className="auth-back-link" to="/">
        ← Retour au site
      </Link>
    </main>
  );
}
