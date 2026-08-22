import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router';

import { useAuth } from '../../core/auth/AuthContext.js';
import { UserMenu } from '../../shared/components/UserMenu.js';

export function PublicLayout() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <div className="public-shell">
      <header className="site-header">
        <Link className="site-brand" to="/" onClick={() => setOpen(false)}>
          <span aria-hidden="true">PF</span>
          <strong>Plateforme de Formations</strong>
        </Link>
        <button
          className="site-menu-button"
          type="button"
          aria-label="Ouvrir la navigation"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          ☰
        </button>
        <nav
          className={open ? 'site-nav site-nav-open' : 'site-nav'}
          aria-label="Navigation publique"
        >
          <NavLink to="/catalogue" onClick={() => setOpen(false)}>
            Formations
          </NavLink>
          <NavLink to="/about" onClick={() => setOpen(false)}>
            À propos
          </NavLink>
          <NavLink to="/faq" onClick={() => setOpen(false)}>
            FAQ
          </NavLink>
          <NavLink to="/contact" onClick={() => setOpen(false)}>
            Contact
          </NavLink>
          {user === null ? (
            <div className="site-nav-actions">
              <Link className="secondary-button" to="/login">
                Se connecter
              </Link>
              <Link className="primary-button" to="/register">
                Créer un compte
              </Link>
            </div>
          ) : (
            <UserMenu />
          )}
        </nav>
      </header>
      <main className="site-main">
        <Outlet />
      </main>
      <footer className="site-footer">
        <nav aria-label="Navigation de pied de page">
          <Link to="/catalogue">Formations</Link>
          <Link to="/about">À propos</Link>
          <Link to="/faq">FAQ</Link>
          <Link to="/contact">Contact</Link>
        </nav>
        <p>© {new Date().getFullYear()} Plateforme de Formations</p>
      </footer>
    </div>
  );
}
