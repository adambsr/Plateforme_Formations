import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { ApiError } from '../../core/api/client.js';
import { useAuth } from '../../core/auth/AuthContext.js';
import type { PaginatedUsers, User } from '../../core/auth/types.js';

function message(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : 'Une erreur inattendue est survenue.';
}

export function RoleHomePage() {
  const { user } = useAuth();
  if (user === null) return null;
  return (
    <section>
      <span className="eyebrow">Session sécurisée</span>
      <h1>Bonjour {user.profile.firstName ?? user.email}</h1>
      <p className="muted">
        Votre espace {user.role.toLowerCase()} est prêt. Les fonctionnalités
        métier seront ajoutées selon les phases du plan.
      </p>
    </section>
  );
}

export function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const form = useForm<{ firstName: string; lastName: string }>({
    defaultValues: {
      firstName: user?.profile.firstName ?? '',
      lastName: user?.profile.lastName ?? '',
    },
  });
  if (user === null) return null;
  return (
    <section className="content-card">
      <h1>Mon profil</h1>
      <p className="muted">{user.email}</p>
      <form
        onSubmit={form.handleSubmit(async ({ firstName, lastName }) => {
          setError('');
          setNotice('');
          try {
            await updateProfile(firstName, lastName);
            setNotice('Profil mis à jour.');
          } catch (caught) {
            setError(message(caught));
          }
        })}
      >
        <div className="form-grid">
          <label>
            Prénom
            <input required {...form.register('firstName')} />
          </label>
          <label>
            Nom
            <input required {...form.register('lastName')} />
          </label>
        </div>
        {notice && <p className="success-message">{notice}</p>}
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button">Enregistrer</button>
      </form>
    </section>
  );
}

export function AdminUsersPage() {
  const { request } = useAuth();
  const [trainers, setTrainers] = useState<User[]>([]);
  const [learners, setLearners] = useState<User[]>([]);
  const [error, setError] = useState('');
  const form = useForm<{
    email: string;
    temporaryPassword: string;
    firstName: string;
    lastName: string;
  }>();
  const load = useCallback(async () => {
    try {
      const [trainerPage, learnerPage] = await Promise.all([
        request<PaginatedUsers>('/trainers?pageSize=100'),
        request<PaginatedUsers>('/learners?pageSize=100'),
      ]);
      setTrainers(trainerPage.items);
      setLearners(learnerPage.items);
      setError('');
    } catch (caught) {
      setError(message(caught));
    }
  }, [request]);
  useEffect(() => {
    // Route entry is the synchronization point for loading server-owned user data.
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);
  return (
    <section>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Administration</span>
          <h1>Utilisateurs</h1>
        </div>
        <span className="count-badge">
          {trainers.length} Formateurs · {learners.length} Apprenants
        </span>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="admin-grid">
        <article className="content-card">
          <h2>Créer un Formateur</h2>
          <p className="muted">
            Le mot de passe temporaire devra être remplacé à la première
            connexion.
          </p>
          <form
            onSubmit={form.handleSubmit(async (values) => {
              setError('');
              try {
                await request('/trainers', {
                  method: 'POST',
                  body: JSON.stringify(values),
                });
                form.reset();
                await load();
              } catch (caught) {
                setError(message(caught));
              }
            })}
          >
            <div className="form-grid">
              <label>
                Prénom
                <input required {...form.register('firstName')} />
              </label>
              <label>
                Nom
                <input required {...form.register('lastName')} />
              </label>
            </div>
            <label>
              Email
              <input type="email" required {...form.register('email')} />
            </label>
            <label>
              Mot de passe temporaire
              <input
                type="password"
                minLength={8}
                required
                {...form.register('temporaryPassword')}
              />
            </label>
            <button className="primary-button">Créer le compte</button>
          </form>
        </article>
        <article className="content-card">
          <h2>Formateurs</h2>
          {trainers.length === 0 ? (
            <p className="muted">Aucun Formateur.</p>
          ) : (
            <ul className="user-list">
              {trainers.map((trainer) => (
                <li key={trainer.id}>
                  <div>
                    <strong>
                      {trainer.profile.firstName} {trainer.profile.lastName}
                    </strong>
                    <span>{trainer.email}</span>
                  </div>
                  <span
                    className={
                      trainer.isActive ? 'status-active' : 'status-inactive'
                    }
                  >
                    {trainer.isActive ? 'Actif' : 'Désactivé'}
                  </span>
                  {trainer.isActive && (
                    <button
                      className="danger-button"
                      onClick={async () => {
                        await request(`/trainers/${trainer.id}/disable`, {
                          method: 'POST',
                        });
                        await load();
                      }}
                    >
                      Désactiver
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
      <article className="content-card">
        <h2>Apprenants</h2>
        {learners.length === 0 ? (
          <p className="muted">Aucun Apprenant.</p>
        ) : (
          <ul className="user-list">
            {learners.map((learner) => (
              <li key={learner.id}>
                <div>
                  <strong>
                    {learner.profile.firstName} {learner.profile.lastName}
                  </strong>
                  <span>{learner.email}</span>
                </div>
                <span className="status-active">
                  {learner.isActive ? 'Actif' : 'Désactivé'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  );
}
