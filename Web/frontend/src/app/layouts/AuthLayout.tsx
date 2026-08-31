import { Link, Outlet } from 'react-router';
import blueLogo from '../../assets/hsa-logo-blue.png';

export function AuthLayout() {
  return (
    <main className="auth-shell">
      <Link className="auth-logo" to="/" aria-label="Accueil High Skills Academy">
        <img src={blueLogo} alt="High Skills Academy" />
      </Link>
      <Outlet />
      <Link className="auth-back-link" to="/">
        ← Retour au site
      </Link>
    </main>
  );
}
