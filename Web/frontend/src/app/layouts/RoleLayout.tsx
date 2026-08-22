import { NavLink, Outlet } from 'react-router';

import { useAuth } from '../../core/auth/AuthContext.js';

export function RoleLayout() {
  const { user, logout } = useAuth();
  if (user === null) return null;

  const roleLabel = {
    ADMIN: 'Administration',
    TRAINER: 'Espace Formateur',
    LEARNER: 'Espace Apprenant',
  }[user.role];

  return (
    <div className="portal-shell">
      <header className="portal-header">
        <div>
          <span className="eyebrow">Plateforme de Formations</span>
          <strong>{roleLabel}</strong>
        </div>
        <div className="portal-account">
          <span>{user.profile.firstName ?? user.email}</span>
          <button
            className="link-button"
            type="button"
            onClick={() => void logout()}
          >
            Déconnexion
          </button>
        </div>
      </header>
      <div className="portal-body">
        <nav className="portal-nav" aria-label="Navigation principale">
          <NavLink to="/app">Accueil</NavLink>
          <NavLink to="/app/catalogue">Catalogue</NavLink>
          {(user.role === 'ADMIN' || user.role === 'TRAINER') && (
            <>
              <NavLink to="/app/trainings">
                {user.role === 'ADMIN' ? 'Formations' : 'Mes formations'}
              </NavLink>
              <NavLink to="/app/sessions">Sessions</NavLink>
            </>
          )}
          <NavLink to="/app/attendance">
            {user.role === 'LEARNER' ? 'Mon planning' : 'Présences'}
          </NavLink>
          <NavLink to="/app/evaluations">Évaluations</NavLink>
          <NavLink to={'/app/certificates'}>
            {user.role === 'ADMIN'
              ? 'Certificats et satisfaction'
              : 'Certificats'}
          </NavLink>
          {user.role === 'LEARNER' && (
            <NavLink to="/app/progress">Ma progression</NavLink>
          )}
          {user.role === 'ADMIN' && (
            <>
              <NavLink to="/app/dashboard">Tableau de bord</NavLink>
              <NavLink to="/app/users">Utilisateurs</NavLink>
            </>
          )}
          {(user.role === 'ADMIN' || user.role === 'LEARNER') && (
            <NavLink to="/app/payments">
              {user.role === 'ADMIN' ? 'Paiements' : 'Mes achats'}
            </NavLink>
          )}
          <NavLink to="/app/profile">Mon profil</NavLink>
        </nav>
        <main className="portal-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
