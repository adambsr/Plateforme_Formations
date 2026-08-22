import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';

import { useAuth } from '../../core/auth/AuthContext.js';
import { UserMenu } from '../../shared/components/UserMenu.js';

export function RoleLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    // Navigation changes close the mobile drawer after route activation.
    // oxlint-disable-next-line react/set-state-in-effect
    setOpen(false);
  }, [location.pathname]);
  if (user === null) return null;

  const roleLabel = {
    ADMIN: 'Administration',
    TRAINER: 'Espace Formateur',
    LEARNER: 'Espace Apprenant',
  }[user.role];
  const link = (to: string, label: string, icon: string) => (
    <NavLink to={to} title={collapsed ? label : undefined}>
      <span className="nav-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="nav-label">{label}</span>
    </NavLink>
  );

  return (
    <div
      className={collapsed ? 'portal-shell sidebar-collapsed' : 'portal-shell'}
    >
      <header className="portal-header">
        <div className="portal-header-start">
          <button
            className="icon-button mobile-menu"
            type="button"
            aria-label="Ouvrir le menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            ☰
          </button>
          <Link className="portal-brand" to="/" aria-label="Accueil public">
            <span>PF</span>
            <strong>Plateforme de Formations</strong>
          </Link>
        </div>
        <div className="portal-account">
          <div>
            <strong>{user.profile.firstName ?? user.email}</strong>
            <span>{roleLabel}</span>
          </div>
          <Link className="secondary-button compact-button view-site" to="/">
            Voir le site
          </Link>
          <UserMenu compact />
        </div>
      </header>
      <div className="portal-body">
        {open && (
          <button
            className="drawer-overlay"
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setOpen(false)}
          />
        )}
        <aside
          className={open ? 'portal-sidebar drawer-open' : 'portal-sidebar'}
        >
          <div className="sidebar-heading">
            <span className="nav-label">Navigation</span>
            <button
              className="icon-button collapse-button"
              type="button"
              aria-label={
                collapsed
                  ? 'Déployer la barre latérale'
                  : 'Réduire la barre latérale'
              }
              aria-expanded={!collapsed}
              onClick={() => setCollapsed((value) => !value)}
            >
              {collapsed ? '›' : '‹'}
            </button>
            <button
              className="icon-button drawer-close"
              type="button"
              aria-label="Fermer le menu"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>
          <nav className="portal-nav" aria-label="Navigation principale">
            {user.role === 'ADMIN' &&
              link('/app/dashboard', 'Tableau de bord', '▦')}
            {user.role === 'TRAINER' &&
              link('/app/trainer', 'Tableau de bord', '▦')}
            {user.role === 'LEARNER' &&
              link('/app/learner', 'Tableau de bord', '▦')}
            {link('/app/catalogue', 'Catalogue', '⌕')}
            {(user.role === 'ADMIN' || user.role === 'TRAINER') && (
              <>
                {link(
                  '/app/trainings',
                  user.role === 'ADMIN' ? 'Formations' : 'Mes formations',
                  '□',
                )}
                {link('/app/sessions', 'Sessions', '◷')}
              </>
            )}
            {link(
              '/app/attendance',
              user.role === 'LEARNER' ? 'Mon planning' : 'Présences',
              '✓',
            )}
            {link('/app/evaluations', 'Évaluations', '?')}
            {link(
              '/app/certificates',
              user.role === 'ADMIN'
                ? 'Certificats et satisfaction'
                : 'Certificats',
              '◇',
            )}
            {user.role === 'LEARNER' &&
              link('/app/progress', 'Ma progression', '↗')}
            {user.role === 'ADMIN' && link('/app/users', 'Utilisateurs', '◎')}
            {(user.role === 'ADMIN' || user.role === 'LEARNER') &&
              link(
                '/app/payments',
                user.role === 'ADMIN' ? 'Paiements' : 'Mes achats',
                '¤',
              )}
          </nav>
          <div className="sidebar-footer">
            {link('/app/profile', 'Mon profil', '○')}
            <button
              className="nav-logout"
              type="button"
              onClick={() => void logout()}
            >
              <span className="nav-icon" aria-hidden="true">
                ↪
              </span>
              <span className="nav-label">Déconnexion</span>
            </button>
          </div>
        </aside>
        <main className="portal-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
