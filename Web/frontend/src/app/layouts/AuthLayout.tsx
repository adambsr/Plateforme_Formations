import { Link, Outlet } from 'react-router';

import blueLogo from '../../assets/hsa-logo-blue.webp';
import { ThemeToggle } from '../../shared/components/ThemeToggle.js';

export function AuthLayout() {
  return (
    <main className="auth-shell">
      <ThemeToggle />
      <Link
        className="auth-logo"
        to="/"
        aria-label="Accueil High Skills Academy"
      >
        <img src={blueLogo} alt="High Skills Academy" />
      </Link>
      <Outlet />
    </main>
  );
}
