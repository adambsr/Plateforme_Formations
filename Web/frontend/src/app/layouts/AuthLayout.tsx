import { Link, Outlet } from 'react-router';

export function AuthLayout() {
  return (
    <main className="auth-shell">
      <Link className="auth-brand" to="/" aria-label="Retour au site public">
        <span aria-hidden="true">PF</span>
        <span>Plateforme de Formations</span>
      </Link>
      <Outlet />
      <Link className="auth-back-link" to="/">
        ← Retour au site
      </Link>
    </main>
  );
}
