import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import awardIcon from 'lucide-static/icons/award.svg';
import calendarDaysIcon from 'lucide-static/icons/calendar-days.svg';
import chevronLeftIcon from 'lucide-static/icons/chevron-left.svg';
import chevronRightIcon from 'lucide-static/icons/chevron-right.svg';
import clipboardCheckIcon from 'lucide-static/icons/clipboard-check.svg';
import creditCardIcon from 'lucide-static/icons/credit-card.svg';
import graduationCapIcon from 'lucide-static/icons/graduation-cap.svg';
import layoutDashboardIcon from 'lucide-static/icons/layout-dashboard.svg';
import listChecksIcon from 'lucide-static/icons/list-checks.svg';
import logOutIcon from 'lucide-static/icons/log-out.svg';
import menuIcon from 'lucide-static/icons/menu.svg';
import searchIcon from 'lucide-static/icons/search.svg';
import trendingUpIcon from 'lucide-static/icons/trending-up.svg';
import userRoundIcon from 'lucide-static/icons/user-round.svg';
import usersRoundIcon from 'lucide-static/icons/users-round.svg';
import xIcon from 'lucide-static/icons/x.svg';

import { useAuth } from '../../core/auth/AuthContext.js';
import { UserMenu } from '../../shared/components/UserMenu.js';
import { Brand } from '../../shared/components/Brand.js';
import { Icon } from '../../shared/components/Icon.js';

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
        <Icon src={icon} />
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
            <Icon src={menuIcon} size={21} />
          </button>
          <Brand className="portal-brand" />
        </div>
        <div className="portal-account" aria-label={roleLabel}>
          <UserMenu />
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
              {collapsed ? (
                <Icon src={chevronRightIcon} size={18} />
              ) : (
                <Icon src={chevronLeftIcon} size={18} />
              )}
            </button>
            <button
              className="icon-button drawer-close"
              type="button"
              aria-label="Fermer le menu"
              onClick={() => setOpen(false)}
            >
              <Icon src={xIcon} size={19} />
            </button>
          </div>
          <nav className="portal-nav" aria-label="Navigation principale">
            {user.role === 'ADMIN' &&
              link('/app/dashboard', 'Tableau de bord', layoutDashboardIcon)}
            {user.role === 'TRAINER' &&
              link('/app/trainer', 'Tableau de bord', layoutDashboardIcon)}
            {user.role === 'LEARNER' &&
              link('/app/learner', 'Tableau de bord', layoutDashboardIcon)}
            {link('/app/catalogue', 'Catalogue', searchIcon)}
            {(user.role === 'ADMIN' || user.role === 'TRAINER') && (
              <>
                {link(
                  '/app/trainings',
                  user.role === 'ADMIN' ? 'Formations' : 'Mes formations',
                  graduationCapIcon,
                )}
                {link('/app/sessions', 'Sessions', calendarDaysIcon)}
              </>
            )}
            {link(
              '/app/attendance',
              user.role === 'LEARNER' ? 'Mon planning' : 'Présences',
              clipboardCheckIcon,
            )}
            {link('/app/evaluations', 'Évaluations', listChecksIcon)}
            {link(
              '/app/certificates',
              user.role === 'ADMIN'
                ? 'Certificats & satisfaction'
                : 'Certificats',
              awardIcon,
            )}
            {user.role === 'LEARNER' &&
              link('/app/progress', 'Ma progression', trendingUpIcon)}
            {user.role === 'ADMIN' &&
              link('/app/users', 'Utilisateurs', usersRoundIcon)}
            {(user.role === 'ADMIN' || user.role === 'LEARNER') &&
              link(
                '/app/payments',
                user.role === 'ADMIN' ? 'Paiements' : 'Mes achats',
                creditCardIcon,
              )}
          </nav>
          <div className="sidebar-footer">
            {link('/app/profile', 'Mon profil', userRoundIcon)}
            <button
              className="nav-logout"
              type="button"
              onClick={() => void logout()}
            >
              <span className="nav-icon" aria-hidden="true">
                <Icon src={logOutIcon} />
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
