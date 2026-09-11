import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Pencil, Trash2, UserRoundX } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';

import { ApiError } from '../../core/api/client.js';
import { useAuth } from '../../core/auth/AuthContext.js';
import type { PaginatedUsers, User } from '../../core/auth/types.js';
import { Pagination } from '../../shared/components/Pagination.js';

const message = (error: unknown) =>
  error instanceof ApiError
    ? error.message
    : 'Une erreur inattendue est survenue.';

export function AdminUserListPage() {
  const { request } = useAuth();
  const [trainers, setTrainers] = useState<PaginatedUsers>();
  const [learners, setLearners] = useState<PaginatedUsers>();
  const [trainerPage, setTrainerPage] = useState(1);
  const [learnerPage, setLearnerPage] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [pendingUserId, setPendingUserId] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [trainerResult, learnerResult] = await Promise.all([
        request<PaginatedUsers>(`/trainers?page=${trainerPage}&pageSize=10`),
        request<PaginatedUsers>(`/learners?page=${learnerPage}&pageSize=10`),
      ]);
      setTrainers(trainerResult);
      setLearners(learnerResult);
    } catch (caught) {
      setError(message(caught));
    } finally {
      setLoading(false);
    }
  }, [learnerPage, request, trainerPage]);
  useEffect(() => {
    // The effect synchronizes the paginated lists with the backend.
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);

  const displayName = (user: User) =>
    [user.profile.firstName, user.profile.lastName].filter(Boolean).join(' ') ||
    user.email;

  async function deactivateUser(user: User) {
    if (
      !window.confirm(
        `Désactiver le compte de ${displayName(user)} ? Cette personne sera déconnectée.`,
      )
    )
      return;
    setPendingUserId(user.id);
    setError('');
    try {
      await request(`/users/${user.id}/disable`, { method: 'POST' });
      await load();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setPendingUserId(undefined);
    }
  }

  async function deleteUser(user: User) {
    if (
      !window.confirm(
        `Supprimer définitivement le compte de ${displayName(user)} ? Cette action est irréversible.`,
      )
    )
      return;
    setPendingUserId(user.id);
    setError('');
    try {
      await request(`/users/${user.id}`, { method: 'DELETE' });
      await load();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setPendingUserId(undefined);
    }
  }

  return (
    <section>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Administration</span>
          <h1>Utilisateurs</h1>
        </div>
        <Link className="primary-button" to="/app/users/trainers/new">
          Créer un formateur
        </Link>
      </div>
      {error !== '' && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="user-sections">
        <article className="content-card">
          <h2>Formateurs</h2>
          {loading && trainers === undefined ? (
            <p className="muted">Chargement…</p>
          ) : trainers?.items.length === 0 ? (
            <p className="muted">Aucun formateur.</p>
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
                  <div className="management-actions">
                    <Link
                      className="secondary-button compact-button"
                      to={`/app/users/trainers/${trainer.id}/edit`}
                    >
                      <Pencil aria-hidden="true" size={16} strokeWidth={1.9} />
                      Modifier
                    </Link>
                    {trainer.isActive && (
                      <button
                        className="danger-button compact-button"
                        disabled={pendingUserId === trainer.id}
                        onClick={() => void deactivateUser(trainer)}
                      >
                        <UserRoundX
                          aria-hidden="true"
                          size={16}
                          strokeWidth={1.9}
                        />
                        Désactiver
                      </button>
                    )}
                    <button
                      className="danger-button compact-button"
                      disabled={pendingUserId === trainer.id}
                      onClick={() => void deleteUser(trainer)}
                    >
                      <Trash2 aria-hidden="true" size={16} strokeWidth={1.9} />
                      Supprimer
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {trainers && (
            <Pagination
              page={trainers.page}
              pageSize={trainers.pageSize}
              total={trainers.total}
              onPageChange={setTrainerPage}
              disabled={loading}
              label="Pages des formateurs"
            />
          )}
        </article>
        <article className="content-card">
          <h2>Apprenants</h2>
          {loading && learners === undefined ? (
            <p className="muted">Chargement…</p>
          ) : learners?.items.length === 0 ? (
            <p className="muted">Aucun apprenant.</p>
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
                  <span
                    className={
                      learner.isActive ? 'status-active' : 'status-inactive'
                    }
                  >
                    {learner.isActive ? 'Actif' : 'Désactivé'}
                  </span>
                  <div className="management-actions">
                    {learner.isActive && (
                      <button
                        className="danger-button compact-button"
                        disabled={pendingUserId === learner.id}
                        onClick={() => void deactivateUser(learner)}
                      >
                        <UserRoundX
                          aria-hidden="true"
                          size={16}
                          strokeWidth={1.9}
                        />
                        Désactiver
                      </button>
                    )}
                    <button
                      className="danger-button compact-button"
                      disabled={pendingUserId === learner.id}
                      onClick={() => void deleteUser(learner)}
                    >
                      <Trash2 aria-hidden="true" size={16} strokeWidth={1.9} />
                      Supprimer
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {learners && (
            <Pagination
              page={learners.page}
              pageSize={learners.pageSize}
              total={learners.total}
              onPageChange={setLearnerPage}
              disabled={loading}
              label="Pages des apprenants"
            />
          )}
        </article>
      </div>
    </section>
  );
}

export function TrainerEditorPage() {
  const { trainerId } = useParams();
  const editing = trainerId !== undefined;
  const { request } = useAuth();
  const navigate = useNavigate();
  const [trainer, setTrainer] = useState<User>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (trainerId === undefined) return;
    void request<User>(`/trainers/${trainerId}`)
      .then(setTrainer)
      .catch((caught) => setError(message(caught)));
  }, [request, trainerId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      await request(editing ? `/trainers/${trainerId}` : '/trainers', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(
          editing
            ? {
                firstName: String(form.get('firstName')),
                lastName: String(form.get('lastName')),
              }
            : {
                firstName: String(form.get('firstName')),
                lastName: String(form.get('lastName')),
                email: String(form.get('email')),
                temporaryPassword: String(form.get('temporaryPassword')),
              },
        ),
      });
      navigate('/app/users', { replace: true });
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  if (editing && trainer === undefined && error === '')
    return <p className="muted">Chargement du formateur…</p>;
  return (
    <section className="management-editor-page">
      <Link to="/app/users">← Retour aux utilisateurs</Link>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Administration</span>
          <h1>{editing ? 'Modifier un formateur' : 'Créer un formateur'}</h1>
        </div>
      </div>
      {error !== '' && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <form
        key={trainer?.id ?? 'new'}
        className="content-card editor-form"
        onSubmit={(event) => void submit(event)}
      >
        {!editing && (
          <p className="muted">
            Le formateur devra remplacer ce mot de passe temporaire lors de sa
            première connexion.
          </p>
        )}
        <div className="form-grid">
          <label>
            Prénom
            <input
              name="firstName"
              defaultValue={trainer?.profile.firstName ?? ''}
              required
            />
          </label>
          <label>
            Nom
            <input
              name="lastName"
              defaultValue={trainer?.profile.lastName ?? ''}
              required
            />
          </label>
        </div>
        {!editing && (
          <>
            <label>
              Adresse e-mail
              <input name="email" type="email" required />
            </label>
            <label>
              Mot de passe temporaire
              <input
                name="temporaryPassword"
                type="password"
                minLength={8}
                autoComplete="new-password"
                required
              />
            </label>
          </>
        )}
        <div className="form-actions">
          <button className="primary-button" disabled={busy}>
            {busy
              ? 'Enregistrement…'
              : editing
                ? 'Enregistrer les modifications'
                : 'Créer le compte'}
          </button>
          <Link className="secondary-button" to="/app/users">
            Annuler
          </Link>
        </div>
      </form>
    </section>
  );
}
