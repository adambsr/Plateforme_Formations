import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';

import blueLogo from '../../assets/hsa-logo-blue.webp';
import { useAuth } from '../../core/auth/AuthContext.js';
import { roleHomePath } from '../../app/routes/destinations.js';

export type StatusKind =
  | 'not-found'
  | 'authentication-required'
  | 'forbidden'
  | 'server-error'
  | 'unavailable'
  | 'session-expired'
  | 'rate-limited'
  | 'account-unavailable'
  | 'resource-unavailable';

const statusCopy: Record<
  StatusKind,
  { code: string; title: string; message: string }
> = {
  'not-found': {
    code: '404',
    title: 'Page introuvable',
    message: 'Cette adresse est incorrecte ou la page a été déplacée.',
  },
  'authentication-required': {
    code: '401',
    title: 'Connexion requise',
    message: 'Connectez-vous pour accéder à cette page.',
  },
  forbidden: {
    code: '403',
    title: 'Accès non autorisé',
    message: 'Votre compte ne dispose pas des permissions nécessaires.',
  },
  'server-error': {
    code: '500',
    title: 'Une erreur est survenue',
    message:
      'Nous n’avons pas pu afficher cette page. Aucune donnée technique sensible n’est présentée.',
  },
  unavailable: {
    code: 'Hors ligne',
    title: 'Service indisponible',
    message:
      'Vérifiez votre connexion réseau, puis réessayez dans quelques instants.',
  },
  'session-expired': {
    code: 'Session',
    title: 'Votre session a expiré',
    message:
      'Reconnectez-vous pour reprendre votre activité en toute sécurité.',
  },
  'rate-limited': {
    code: 'Patientez',
    title: 'Trop de tentatives',
    message:
      'Nous limitons temporairement les vérifications de session. Réessayez dans quelques instants ou reconnectez-vous.',
  },
  'account-unavailable': {
    code: 'Compte',
    title: 'Compte indisponible',
    message:
      'Ce compte est désactivé ou n’est plus accessible. Contactez le support si vous pensez qu’il s’agit d’une erreur.',
  },
  'resource-unavailable': {
    code: 'Indisponible',
    title: 'Ressource indisponible',
    message: 'Cette formation, ressource ou session n’est plus disponible.',
  },
};

export function SystemStatusPage({
  kind,
  retry,
}: {
  kind: StatusKind;
  retry?: () => void;
}) {
  const { user } = useAuth();
  const location = useLocation();
  const copy = statusCopy[kind];
  const from = (location.state as { from?: string } | null)?.from;
  const home = user === null ? '/' : roleHomePath(user.role);
  return (
    <main className="system-page">
      <Link
        to="/"
        className="system-logo"
        aria-label="Accueil High Skills Academy"
      >
        <img src={blueLogo} alt="High Skills Academy" />
      </Link>
      <section
        className="system-card"
        role={kind === 'server-error' ? 'alert' : undefined}
      >
        <span className="system-code">{copy.code}</span>
        <h1>{copy.title}</h1>
        <p>{copy.message}</p>
        <div className="system-actions">
          {(kind === 'authentication-required' ||
            kind === 'session-expired' ||
            kind === 'rate-limited') && (
            <Link
              className="primary-button"
              to="/login"
              state={from ? { from } : undefined}
            >
              Se connecter
            </Link>
          )}
          {(kind === 'unavailable' ||
            kind === 'server-error' ||
            kind === 'rate-limited') && (
            <button
              className="primary-button"
              type="button"
              onClick={retry ?? (() => window.location.reload())}
            >
              Réessayer
            </button>
          )}
          <Link className="secondary-button" to={home}>
            {user === null ? 'Retour à l’accueil' : 'Retour au tableau de bord'}
          </Link>
          {(kind === 'forbidden' ||
            kind === 'account-unavailable' ||
            kind === 'resource-unavailable') && (
            <Link className="link-button" to="/contact">
              Contacter le support
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}

export function ForbiddenPage() {
  return <SystemStatusPage kind="forbidden" />;
}

interface ErrorBoundaryState {
  failed: boolean;
}

export class AppErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { failed: false };
  private reloadOnRetry = false;

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    // Technical details stay in the developer console and are never rendered.
    this.reloadOnRetry =
      /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
        error.message,
      );
  }

  render() {
    if (this.state.failed) {
      return (
        <SystemStatusPage
          kind="server-error"
          retry={() => {
            // A page kept open across a deployment may reference an old bundle.
            // Reload only on the user's retry action, preserving ordinary retries.
            if (this.reloadOnRetry) window.location.reload();
            else this.setState({ failed: false });
          }}
        />
      );
    }
    return this.props.children;
  }
}
