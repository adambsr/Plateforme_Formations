import { useState } from 'react';
import { GraduationCap, Mail } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router';
import menuIcon from 'lucide-static/icons/menu.svg';
import xIcon from 'lucide-static/icons/x.svg';

import { useAuth } from '../../core/auth/AuthContext.js';
import { UserMenu } from '../../shared/components/UserMenu.js';
import { Icon } from '../../shared/components/Icon.js';
import { PublicConcierge } from '../../features/public/PublicConcierge.js';
import { ThemeToggle } from '../../shared/components/ThemeToggle.js';
import { BrandLogo } from '../../shared/components/BrandLogo.js';

function SocialIcon({ kind }: { kind: 'facebook' | 'instagram' }) {
  return kind === 'facebook' ? (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M13.7 21v-8h2.7l.4-3.1h-3.1v-2c0-.9.3-1.5 1.6-1.5H17V3.6c-.8-.1-1.6-.2-2.4-.2-2.4 0-4.1 1.5-4.1 4.2v2.3H7.8V13h2.7v8h3.2Z" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 7.4A4.6 4.6 0 1 0 12 16.6 4.6 4.6 0 0 0 12 7.4Zm0 7.6a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm5.9-7.8a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0ZM21 8.3c-.1-1.5-.4-2.8-1.5-3.8S17.2 3.1 15.7 3c-1.6-.1-6-.1-7.5 0-1.5.1-2.8.4-3.8 1.5S3.1 6.8 3 8.3c-.1 1.6-.1 6 0 7.5.1 1.5.4 2.8 1.5 3.8s2.3 1.4 3.8 1.5c1.6.1 6 .1 7.5 0 1.5-.1 2.8-.4 3.8-1.5s1.4-2.3 1.5-3.8c.1-1.6.1-6 0-7.5Zm-1.9 9.2a3.1 3.1 0 0 1-1.7 1.7c-1.2.5-4 .4-5.4.4s-4.2.1-5.4-.4a3.1 3.1 0 0 1-1.7-1.7c-.5-1.2-.4-4-.4-5.4s-.1-4.2.4-5.4A3.1 3.1 0 0 1 6.6 5c1.2-.5 4-.4 5.4-.4s4.2-.1 5.4.4a3.1 3.1 0 0 1 1.7 1.7c.5 1.2.4 4 .4 5.4s.1 4.2-.4 5.4Z" />
    </svg>
  );
}

export function PublicLayout() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <div className="public-shell">
      <a className="skip-link" href="#main-content">
        Aller au contenu
      </a>
      <header className="site-header">
        <div className="site-header-start">
          <button
            className="site-menu-button icon-button"
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
          <BrandLogo className="site-logo" onClick={() => setOpen(false)} />
        </div>
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
          ) : null}
        </nav>
        <div className="site-account">
          <ThemeToggle />
          {user === null ? null : <UserMenu />}
        </div>
      </header>
      <main className="site-main" id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="footer-about-column">
          <BrandLogo className="footer-logo-link" />
          <p>
            Des formations professionnelles en ligne et en présentiel pour
            transformer durablement vos compétences.
          </p>
          <div className="footer-socials" aria-label="Réseaux sociaux">
            <a
              href="https://www.facebook.com/p/High-Skills-Academy-100063631059595/"
              target="_blank"
              rel="noreferrer"
              aria-label="High Skills Academy sur Facebook"
            >
              <SocialIcon kind="facebook" />
            </a>
            <a
              href="https://www.instagram.com/high_skills_academy?stkn=MWszN3lrZDI4ZjZ1ag=="
              target="_blank"
              rel="noreferrer"
              aria-label="High Skills Academy sur Instagram"
            >
              <SocialIcon kind="instagram" />
            </a>
          </div>
        </div>
        <div className="footer-link-column">
          <h2>
            <GraduationCap aria-hidden="true" />
            Découvrir
          </h2>
          <nav aria-label="Découvrir High Skills Academy">
            <Link to="/catalogue">Formations</Link>
            <Link to="/about">À propos</Link>
            <Link to="/faq">Questions fréquentes</Link>
          </nav>
        </div>
        <div className="footer-link-column">
          <h2>
            <Mail aria-hidden="true" />
            Nous contacter
          </h2>
          <nav aria-label="Contact et informations légales">
            <Link to="/contact">Contact</Link>
            <a href="mailto:hsa.tn.contact@gmail.com">
              hsa.tn.contact@gmail.com
            </a>
            <Link to="/privacy">Confidentialité</Link>
            <Link to="/terms">Conditions</Link>
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
