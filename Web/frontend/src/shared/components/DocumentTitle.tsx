import { useEffect } from 'react';
import { useLocation } from 'react-router';

const titleSuffix = 'High Skills Academy';

function pageTitleFor(pathname: string): string {
  if (pathname === '/') return 'Développez vos compétences';
  if (pathname === '/catalogue' || pathname === '/app/catalogue') {
    return 'Catalogue des formations';
  }
  if (pathname.startsWith('/trainings/')) return 'Formation';
  if (pathname === '/about') return 'À propos';
  if (pathname === '/faq') return 'Questions fréquentes';
  if (pathname === '/contact') return 'Contact';
  if (pathname === '/login') return 'Connexion';
  if (pathname === '/register') return 'Créer un compte';
  if (pathname === '/forgot-password') return 'Mot de passe oublié';
  if (pathname === '/reset-password') return 'Réinitialiser le mot de passe';
  if (pathname === '/change-password') return 'Modifier le mot de passe';
  if (pathname === '/payments/success') return 'Paiement confirmé';
  if (pathname === '/payments/cancel') return 'Paiement annulé';
  if (pathname === '/app/learner') return 'Espace apprenant';
  if (pathname === '/app/trainer') return 'Espace formateur';
  if (pathname === '/app/dashboard') return 'Tableau de bord administrateur';
  if (pathname === '/app/progress') return 'Ma progression';
  if (pathname === '/app/profile') return 'Mon profil';
  if (pathname === '/app/payments') return 'Mes paiements';
  if (pathname === '/app/categories') return 'Gestion des catégories';
  if (pathname === '/app/users') return 'Gestion des utilisateurs';
  if (pathname.startsWith('/app/users/trainers/')) return 'Gestion des formateurs';
  if (pathname.startsWith('/app/trainings/')) return 'Gestion des formations';
  if (pathname.startsWith('/app/content/')) return 'Contenu de la formation';
  if (pathname.startsWith('/app/sessions')) return 'Gestion des sessions';
  if (pathname.startsWith('/app/attendance')) return 'Présences';
  if (pathname.startsWith('/app/evaluations')) return 'Évaluations';
  if (pathname.startsWith('/app/certificates')) return 'Certificats';
  return titleSuffix;
}

/** Keeps the browser title, and therefore Analytics page titles, in sync with SPA routes. */
export function DocumentTitle() {
  const { pathname } = useLocation();

  useEffect(() => {
    const pageTitle = pageTitleFor(pathname);
    document.title =
      pageTitle === titleSuffix ? titleSuffix : `${pageTitle} | ${titleSuffix}`;
  }, [pathname]);

  return null;
}
