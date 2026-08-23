import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { ApiError } from '../../core/api/client.js';
import { useAuth } from '../../core/auth/AuthContext.js';
import type { PaginatedUsers } from '../../core/auth/types.js';
import { PasswordInput } from '../auth/AuthPages.js';
import { Pagination } from '../../shared/components/Pagination.js';
import { Avatar } from '../../shared/components/Avatar.js';

function message(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : 'Une erreur inattendue est survenue.';
}

export function ProfilePage() {
  const { user, updateProfile, changePassword, logout } = useAuth();
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const form = useForm<{ firstName: string; lastName: string }>({
    defaultValues: {
      firstName: user?.profile.firstName ?? '',
      lastName: user?.profile.lastName ?? '',
    },
  });
  const security = useForm<{
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }>();
  if (user === null) return null;
  return (
    <section>
      <div className="section-heading">
        <div className="profile-heading">
          <Avatar user={user} size="large" />
          <div>
            <span className="eyebrow">Compte et sécurité</span>
            <h1>Mon profil</h1>
          </div>
        </div>
        <button
          className="secondary-button profile-logout"
          type="button"
          onClick={() => void logout()}
        >
          Se déconnecter
        </button>
      </div>
      {notice && <p className="success-message">{notice}</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="profile-grid">
        <form
          className="content-card"
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
          <h2>Informations personnelles</h2>
          <dl className="profile-facts">
            <div>
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Rôle</dt>
              <dd>
                {
                  {
                    ADMIN: 'Admin',
                    TRAINER: 'Formateur',
                    LEARNER: 'Apprenant',
                  }[user.role]
                }
              </dd>
            </div>
          </dl>
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
          <button
            className="primary-button"
            disabled={form.formState.isSubmitting}
          >
            Enregistrer
          </button>
        </form>
        <form
          className="content-card"
          onSubmit={security.handleSubmit(async (values) => {
            setError('');
            setNotice('');
            if (values.newPassword !== values.confirmPassword) {
              setError('Les mots de passe doivent correspondre.');
              return;
            }
            try {
              await changePassword(values.currentPassword, values.newPassword);
              security.reset();
              setNotice(
                'Mot de passe mis à jour. Vos autres sessions ont été déconnectées.',
              );
            } catch (caught) {
              setError(message(caught));
            }
          })}
        >
          <h2>Sécurité</h2>
          <p className="muted">
            Changer votre mot de passe révoque les autres sessions actives.
          </p>
          <PasswordInput
            label="Mot de passe actuel"
            autoComplete="current-password"
            required
            {...security.register('currentPassword')}
          />
          <PasswordInput
            label="Nouveau mot de passe"
            minLength={8}
            autoComplete="new-password"
            required
            {...security.register('newPassword')}
          />
          <PasswordInput
            label="Confirmer le mot de passe"
            minLength={8}
            autoComplete="new-password"
            required
            {...security.register('confirmPassword')}
          />
          <button
            className="primary-button"
            disabled={security.formState.isSubmitting}
          >
            Modifier le mot de passe
          </button>
        </form>
      </div>
    </section>
  );
}

export function AdminUsersPage() {
  const { request } = useAuth();
  const [trainers, setTrainers] = useState<PaginatedUsers | null>(null);
  const [learners, setLearners] = useState<PaginatedUsers | null>(null);
  const [trainerPageNumber, setTrainerPageNumber] = useState(1);
  const [learnerPageNumber, setLearnerPageNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const form = useForm<{
    email: string;
    temporaryPassword: string;
    firstName: string;
    lastName: string;
  }>();
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [trainerPage, learnerPage] = await Promise.all([
        request<PaginatedUsers>(
          `/trainers?page=${trainerPageNumber}&pageSize=10`,
        ),
        request<PaginatedUsers>(
          `/learners?page=${learnerPageNumber}&pageSize=10`,
        ),
      ]);
      setTrainers(trainerPage);
      setLearners(learnerPage);
      setError('');
    } catch (caught) {
      setError(message(caught));
    } finally {
      setLoading(false);
    }
  }, [learnerPageNumber, request, trainerPageNumber]);
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
          {trainers?.total ?? 0} Formateurs · {learners?.total ?? 0} Apprenants
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
            <PasswordInput
              label="Mot de passe temporaire"
              minLength={8}
              autoComplete="new-password"
              required
              {...form.register('temporaryPassword')}
            />
            <button
              className="primary-button"
              disabled={form.formState.isSubmitting}
            >
              Créer le compte
            </button>
          </form>
        </article>
        <article className="content-card">
          <h2>Formateurs</h2>
          {loading && trainers === null ? (
            <p className="muted">Chargement des Formateurs…</p>
          ) : trainers?.items.length === 0 ? (
            <p className="muted">Aucun Formateur.</p>
          ) : (
            <ul className="user-list">
              {trainers?.items.map((trainer) => (
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
          {trainers && (
            <Pagination
              page={trainers.page}
              pageSize={trainers.pageSize}
              total={trainers.total}
              onPageChange={setTrainerPageNumber}
              disabled={loading}
              label="Pages des Formateurs"
            />
          )}
        </article>
      </div>
      <article className="content-card">
        <h2>Apprenants</h2>
        {loading && learners === null ? (
          <p className="muted">Chargement des Apprenants…</p>
        ) : learners?.items.length === 0 ? (
          <p className="muted">Aucun Apprenant.</p>
        ) : (
          <ul className="user-list">
            {learners?.items.map((learner) => (
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
        {learners && (
          <Pagination
            page={learners.page}
            pageSize={learners.pageSize}
            total={learners.total}
            onPageChange={setLearnerPageNumber}
            disabled={loading}
            label="Pages des Apprenants"
          />
        )}
      </article>
    </section>
  );
}
