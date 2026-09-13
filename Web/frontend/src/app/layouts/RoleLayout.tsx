import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
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

import blueLogo from '../../assets/hsa-logo-blue.png';

import { useAuth } from '../../core/auth/AuthContext.js';
import { UserMenu } from '../../shared/components/UserMenu.js';
import { Icon } from '../../shared/components/Icon.js';
import { HeaderSearch } from '../../features/notifications/HeaderSearch.js';
import { NotificationBell } from '../../features/notifications/NotificationBell.js';

export function RoleLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const sidebar = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const [mobile, setMobile] = useState(
    () => window.matchMedia('(max-width: 1023px)').matches,
  );
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    const change = () => {
      setMobile(media.matches);
      setOpen(false);
    };
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const trigger = menuButton.current;
    document.body.style.overflow = 'hidden';
    sidebar.current?.querySelector<HTMLButtonElement>('.drawer-close')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
      if (event.key !== 'Tab') return;
      const items = Array.from(
        sidebar.current?.querySelectorAll<HTMLElement>('a[href], button') ?? [],
      ).filter((item) => item.getClientRects().length > 0);
      const first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      trigger?.focus();
    };
  }, [open]);
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
    <NavLink to={to} aria-label={label} title={collapsed ? label : undefined}>
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
      <a href="#dashboard-main" className="hsa-skip-link">
        Aller au contenu
      </a>
      <header className="portal-header" inert={open}>
        <div className="portal-header-start">
          <button
            className="icon-button mobile-menu"
            type="button"
            aria-label="Ouvrir le menu"
            aria-expanded={open}
            aria-controls="dashboard-navigation"
            ref={menuButton}
            onClick={() => setOpen(true)}
          >
            <Icon src={menuIcon} size={21} />
          </button>
          <Link
            className="portal-logo"
            to="/"
            aria-label="Accueil High Skills Academy"
          >
            <img src={blueLogo} alt="High Skills Academy" />
          </Link>
        </div>
        <HeaderSearch />
        <div className="portal-account" aria-label={roleLabel}>
          <NotificationBell />
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
          id="dashboard-navigation"
          ref={sidebar}
          inert={mobile && !open}
          role={mobile ? 'dialog' : undefined}
          aria-modal={mobile && open ? true : undefined}
          aria-label={mobile ? 'Navigation' : undefined}
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
            <span className="hsa-nav-group nav-label">{roleLabel}</span>
            {user.role === 'ADMIN' &&
              link('/app/dashboard', 'Tableau de bord', layoutDashboardIcon)}
            {user.role === 'TRAINER' &&
              link('/app/trainer', 'Tableau de bord', layoutDashboardIcon)}
            {user.role === 'LEARNER' &&
              link('/app/learner', 'Tableau de bord', layoutDashboardIcon)}
            <span className="hsa-nav-group nav-label">
              {user.role === 'LEARNER'
                ? 'Mon apprentissage'
                : 'Gestion pédagogique'}
            </span>
            {user.role !== 'TRAINER' &&
              link('/app/catalogue', 'Catalogue', searchIcon)}
            {(user.role === 'ADMIN' || user.role === 'TRAINER') && (
              <>
                {link(
                  '/app/trainings',
                  user.role === 'ADMIN' ? 'Formations' : 'Mes formations',
                  graduationCapIcon,
                )}
                {link(
                  '/app/sessions',
                  user.role === 'TRAINER' ? 'Mes sessions' : 'Sessions',
                  calendarDaysIcon,
                )}
              </>
            )}
            {link(
              '/app/attendance',
              user.role === 'LEARNER'
                ? 'Mon planning'
                : user.role === 'TRAINER'
                  ? 'Mes apprenants'
                  : 'Présences',
              clipboardCheckIcon,
            )}
            {link(
              '/app/evaluations',
              user.role === 'TRAINER' ? 'Mes évaluations' : 'Évaluations',
              listChecksIcon,
            )}
            {user.role === 'ADMIN' &&
              link(
                '/app/certificates',
                'Certificats & satisfaction',
                awardIcon,
              )}
            {user.role === 'LEARNER' &&
              link('/app/progress', 'Ma progression', trendingUpIcon)}
            {user.role === 'ADMIN' &&
              link('/app/users', 'Utilisateurs', usersRoundIcon)}
            {user.role === 'ADMIN' &&
              link('/app/payments', 'Paiements', creditCardIcon)}
            {user.role === 'LEARNER' && (
              <>
                <span className="hsa-nav-group nav-label">Mon espace</span>
                {link('/app/certificates', 'Mes certifications', awardIcon)}
                {link('/app/payments', 'Mes achats', creditCardIcon)}
              </>
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
        <main
          className="portal-content"
          id="dashboard-main"
          tabIndex={-1}
          inert={open}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
