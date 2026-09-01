import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import menuIcon from 'lucide-static/icons/menu.svg';
import xIcon from 'lucide-static/icons/x.svg';

import blueLogo from '../../assets/hsa-logo-blue.png';
import footerLogo from '../../assets/hsa-logo-footer.png';

import { useAuth } from '../../core/auth/AuthContext.js';
import { UserMenu } from '../../shared/components/UserMenu.js';
import { Icon } from '../../shared/components/Icon.js';
import { PublicConcierge } from '../../features/public/PublicConcierge.js';

export function PublicLayout() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <div className="public-shell">
      <header className="site-header">
        <Link
          className="site-logo"
          to="/"
          aria-label="Accueil High Skills Academy"
          onClick={() => setOpen(false)}
        >
          <img src={blueLogo} alt="High Skills Academy" />
        </Link>
        <button
          className="site-menu-button"
          type="button"
          aria-label="Ouvrir la navigation"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? (
            <Icon src={xIcon} size={22} />
          ) : (
            <Icon src={menuIcon} size={22} />
          )}
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
        <div className="footer-about-column">
          <Link
            className="footer-logo-link"
            to="/"
            aria-label="Accueil High Skills Academy"
          >
            <img
              className="footer-logo"
              src={footerLogo}
              alt="High Skills Academy"
            />
          </Link>
          <p>
            Des formations professionnelles en ligne et en présentiel pour
            transformer durablement vos compétences.
          </p>
        </div>
        <div>
          <h2>Découvrir</h2>
          <nav aria-label="Découvrir High Skills Academy">
            <Link to="/catalogue">Formations</Link>
            <Link to="/about">À propos</Link>
            <Link to="/faq">Questions fréquentes</Link>
          </nav>
        </div>
        <div>
          <h2>Nous contacter</h2>
          <nav aria-label="Contact et informations légales">
            <Link to="/contact">Contact</Link>
            <a href="mailto:highskills.ac@gmail.com">highskills.ac@gmail.com</a>
            <Link to="/about">Mentions légales</Link>
          </nav>
        </div>
        <p className="footer-copyright">
          © {new Date().getFullYear()} High Skills Academy. Tous droits
          réservés.
        </p>
      </footer>
      <PublicConcierge />
    </div>
  );
}
