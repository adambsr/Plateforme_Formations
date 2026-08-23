import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { ApiError, apiAssetUrl } from '../../core/api/client.js';
import { useAuth } from '../../core/auth/AuthContext.js';
import type { PaginatedUsers, User } from '../../core/auth/types.js';
import { Pagination } from '../../shared/components/Pagination.js';
import { Select } from '../../shared/components/Select.js';
import type {
  PaginatedTrainings,
  Training,
  TrainingCategory,
  TrainingType,
} from './types.js';

const errorMessage = (error: unknown) =>
  error instanceof ApiError
    ? error.message
    : error instanceof Error
      ? error.message
      : 'Une erreur inattendue est survenue.';

const lines = (value: FormDataEntryValue | null) =>
  String(value ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

function parseEur(value: FormDataEntryValue | null): number | undefined {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(String(value ?? '').trim());
  if (match === null) return undefined;
  const amount =
    Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return Number.isSafeInteger(amount) && amount > 0 ? amount : undefined;
}

const typeLabel = (type: TrainingType) =>
  type === 'SELF_PACED_ONLINE' ? 'En ligne autonome' : 'Présentiel';
const trainingLevels = [
  'Débutant',
  'Intermédiaire',
  'Avancé',
  'Tous niveaux',
] as const;
const statusLabel = (status: Training['status']) =>
  ({ DRAFT: 'Brouillon', PUBLISHED: 'Publiée', ARCHIVED: 'Archivée' })[status];
const price = (minor: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(minor / 100);

function Thumbnail({ training }: { training: Training }) {
  return training.thumbnailUrl === undefined ? null : (
    <img
      className="training-thumbnail"
      src={apiAssetUrl(training.thumbnailUrl)}
      alt={`Miniature de la formation ${training.title}`}
    />
  );
}

export function TrainingManagementListPage() {
  const { request, user } = useAuth();
  const [page, setPage] = useState<PaginatedTrainings>();
  const [pageNumber, setPageNumber] = useState(1);
  const [trainers, setTrainers] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (user === null) return;
    setLoading(true);
    setError('');
    try {
      const [trainingPage, trainerPage] = await Promise.all([
        request<PaginatedTrainings>(
          `/trainings?view=MANAGED&page=${pageNumber}&pageSize=12`,
        ),
        user.role === 'ADMIN'
          ? request<PaginatedUsers>('/trainers?pageSize=100')
          : Promise.resolve(undefined),
      ]);
      setPage(trainingPage);
      setTrainers(trainerPage?.items ?? []);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [pageNumber, request, user]);

  useEffect(() => {
    // The effect synchronizes the current management page with the backend.
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);

  async function mutate(path: string, options: RequestInit, success: string) {
    setError('');
    setNotice('');
    try {
      await request(path, options);
      setNotice(success);
      await load();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  if (user === null) return null;
  return (
    <section>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Catalogue</span>
          <h1>{user.role === 'ADMIN' ? 'Formations' : 'Mes formations'}</h1>
        </div>
        <div className="management-actions">
          {user.role === 'ADMIN' && (
            <Link className="secondary-button" to="/app/categories">
              Catégories
            </Link>
          )}
          <Link className="primary-button" to="/app/trainings/new">
            Créer une formation
          </Link>
        </div>
      </div>
      {notice !== '' && <p className="success-message">{notice}</p>}
      {error !== '' && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p className="muted">Chargement des formations…</p>
      ) : page === undefined || page.items.length === 0 ? (
        <div className="empty-state">
          <h2>Aucune formation gérée</h2>
          <p className="muted">Créez votre premier brouillon.</p>
        </div>
      ) : (
        <div className="managed-training-list">
          {page.items.map((training) => (
            <article className="content-card" key={training.id}>
              <div className="managed-training-heading">
                <div>
                  <span
                    className={`status-pill status-${training.status.toLowerCase()}`}
                  >
                    {statusLabel(training.status)}
                  </span>
                  <h2>{training.title}</h2>
                  <p className="muted">
                    {typeLabel(training.type)} · {training.category.name} ·{' '}
                    {price(training.priceMinor)}
                  </p>
                </div>
                <div className="management-actions">
                  <Link
                    className="secondary-button"
                    to={`/app/trainings/${training.id}/content`}
                  >
                    Contenu
                  </Link>
                  {training.status !== 'ARCHIVED' && (
                    <Link
                      className="secondary-button"
                      to={`/app/trainings/${training.id}/edit`}
                    >
                      Modifier
                    </Link>
                  )}
                  {training.status === 'DRAFT' && (
                    <>
                      <button
                        className="primary-button compact-button"
                        onClick={() =>
                          void mutate(
                            `/trainings/${training.id}/publish`,
                            { method: 'POST' },
                            'Formation publiée.',
                          )
                        }
                      >
                        Publier
                      </button>
                      <button
                        className="danger-button"
                        onClick={() => {
                          if (
                            window.confirm(
                              'Supprimer définitivement ce brouillon inutilisé ?',
                            )
                          )
                            void mutate(
                              `/trainings/${training.id}`,
                              { method: 'DELETE' },
                              'Brouillon supprimé.',
                            );
                        }}
                      >
                        Supprimer
                      </button>
                    </>
                  )}
                  {training.status === 'PUBLISHED' && (
                    <button
                      className="danger-button"
                      onClick={() =>
                        void mutate(
                          `/trainings/${training.id}/archive`,
                          { method: 'POST' },
                          'Formation archivée.',
                        )
                      }
                    >
                      Archiver
                    </button>
                  )}
                  {training.status === 'ARCHIVED' && (
                    <button
                      className="secondary-button"
                      onClick={() =>
                        void mutate(
                          `/trainings/${training.id}/unarchive`,
                          { method: 'POST' },
                          'Formation désarchivée en brouillon.',
                        )
                      }
                    >
                      Désarchiver
                    </button>
                  )}
                </div>
              </div>
              <div className="thumbnail-management">
                <Thumbnail training={training} />
                <label className="secondary-button compact-button">
                  {training.thumbnailUrl === undefined
                    ? 'Ajouter une miniature'
                    : 'Remplacer la miniature'}
                  <input
                    className="visually-hidden"
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file === undefined) return;
                      const body = new FormData();
                      body.append('thumbnail', file);
                      void mutate(
                        `/trainings/${training.id}/thumbnail`,
                        { method: 'PUT', body },
                        'Miniature enregistrée.',
                      );
                      event.target.value = '';
                    }}
                  />
                </label>
                {training.thumbnailUrl !== undefined && (
                  <button
                    className="danger-button"
                    onClick={() =>
                      void mutate(
                        `/trainings/${training.id}/thumbnail`,
                        { method: 'DELETE' },
                        'Miniature supprimée.',
                      )
                    }
                  >
                    Supprimer la miniature
                  </button>
                )}
              </div>
              <p>{training.description}</p>
              <p className="muted">
                Propriétaire :{' '}
                {[
                  training.ownerTrainer.firstName,
                  training.ownerTrainer.lastName,
                ]
                  .filter(Boolean)
                  .join(' ') || training.ownerTrainer.id}
              </p>
              {user.role === 'ADMIN' && trainers.length > 0 && (
                <form
                  className="inline-action"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const ownerTrainerId = String(
                      new FormData(event.currentTarget).get('ownerTrainerId'),
                    );
                    void mutate(
                      `/trainings/${training.id}/owner`,
                      {
                        method: 'PUT',
                        body: JSON.stringify({ ownerTrainerId }),
                      },
                      'Propriété transférée.',
                    );
                  }}
                >
                  <Select
                    name="ownerTrainerId"
                    defaultValue={training.ownerTrainer.id}
                    aria-label={`Propriétaire de ${training.title}`}
                  >
                    {trainers
                      .filter(({ isActive }) => isActive)
                      .map((trainer) => (
                        <option key={trainer.id} value={trainer.id}>
                          {[trainer.profile.firstName, trainer.profile.lastName]
                            .filter(Boolean)
                            .join(' ') || trainer.email}
                        </option>
                      ))}
                  </Select>
                  <button className="secondary-button">Transférer</button>
                </form>
              )}
            </article>
          ))}
          <Pagination
            page={page.page}
            pageSize={page.pageSize}
            total={page.total}
            onPageChange={setPageNumber}
            label="Pagination des formations"
          />
        </div>
      )}
    </section>
  );
}

export function TrainingEditorPage() {
  const { trainingId } = useParams();
  const { request, user } = useAuth();
  const navigate = useNavigate();
  const editing = trainingId !== undefined;
  const [training, setTraining] = useState<Training>();
  const [thumbnailFile, setThumbnailFile] = useState<File>();
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string>();
  const [thumbnailRemoved, setThumbnailRemoved] = useState(false);
  const [categories, setCategories] = useState<TrainingCategory[]>([]);
  const [trainers, setTrainers] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (thumbnailPreviewUrl !== undefined)
      return () => URL.revokeObjectURL(thumbnailPreviewUrl);
  }, [thumbnailPreviewUrl]);

  useEffect(() => {
    if (user === null) return;
    void Promise.all([
      request<TrainingCategory[]>('/categories'),
      user.role === 'ADMIN'
        ? request<PaginatedUsers>('/trainers?pageSize=100')
        : Promise.resolve(undefined),
      trainingId === undefined
        ? Promise.resolve(undefined)
        : request<Training>(`/trainings/${trainingId}`),
    ])
      .then(([categoryList, trainerPage, value]) => {
        setCategories(categoryList);
        setTrainers(trainerPage?.items ?? []);
        setTraining(value);
      })
      .catch((caught) => setError(errorMessage(caught)));
  }, [request, trainingId, user]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const priceMinor = parseEur(form.get('priceEur'));
    if (priceMinor === undefined) {
      setError('Saisissez un prix EUR valide avec deux décimales au maximum.');
      return;
    }
    const type = String(form.get('type')) as TrainingType;
    setBusy(true);
    setError('');
    try {
      const common = {
        title: String(form.get('title')),
        description: String(form.get('description')),
        categoryId: String(form.get('categoryId')),
        level: String(form.get('level')),
        durationMinutes: Number(form.get('durationMinutes')),
        objectives: lines(form.get('objectives')),
        prerequisites: lines(form.get('prerequisites')),
        priceMinor,
        ...(type === 'IN_PERSON'
          ? {
              minimumAttendancePercent: Number(
                form.get('minimumAttendancePercent'),
              ),
            }
          : {}),
      };
      const savedTraining = await request<Training>(
        editing ? `/trainings/${trainingId}` : '/trainings',
        {
          method: editing ? 'PUT' : 'POST',
          body: JSON.stringify(
            editing
              ? common
              : {
                  ...common,
                  type,
                  ...(user?.role === 'ADMIN'
                    ? { ownerTrainerId: String(form.get('ownerTrainerId')) }
                    : {}),
                },
          ),
        },
      );
      if (thumbnailFile !== undefined) {
        const body = new FormData();
        body.append('thumbnail', thumbnailFile);
        await request<Training>(
          `/trainings/${savedTraining.id}/thumbnail`,
          { method: 'PUT', body },
        );
      } else if (editing && thumbnailRemoved && value?.thumbnailUrl !== undefined) {
        await request<Training>(
          `/trainings/${savedTraining.id}/thumbnail`,
          { method: 'DELETE' },
        );
      }
      navigate('/app/trainings', { replace: true });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  if (editing && training === undefined && error === '')
    return <p className="muted">Chargement de la formation…</p>;
  const value = training;
  return (
    <section className="management-editor-page">
      <Link to="/app/trainings">← Retour aux formations</Link>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Catalogue</span>
          <h1>{editing ? 'Modifier la formation' : 'Créer une formation'}</h1>
        </div>
      </div>
      {error !== '' && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <form
        key={value?.id ?? 'new'}
        className="content-card editor-form"
        onSubmit={(event) => void submit(event)}
      >
        <p className="muted">
          Le type est définitif dès la création. Le prix est saisi en EUR.
        </p>
        <label>
          Titre
          <input name="title" defaultValue={value?.title ?? ''} required />
        </label>
        <label>
          Description
          <textarea
            name="description"
            rows={6}
            defaultValue={value?.description ?? ''}
            required
          />
        </label>
        <div className="form-grid">
          <label>
            Catégorie
            <Select
              name="categoryId"
              defaultValue={value?.category.id ?? ''}
              required
            >
              <option value="">Sélectionner</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </label>
          <label>
            Niveau
            <Select name="level" defaultValue={value?.level ?? ''} required>
              <option value="">Sélectionner un niveau</option>
              {trainingLevels.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </Select>
          </label>
          <label>
            Type immuable
            <Select
              name="type"
              defaultValue={value?.type ?? 'SELF_PACED_ONLINE'}
              disabled={editing}
            >
              <option value="SELF_PACED_ONLINE">En ligne autonome</option>
              <option value="IN_PERSON">Présentiel</option>
            </Select>
            {editing && <input type="hidden" name="type" value={value?.type} />}
          </label>
          <label>
            Durée en minutes
            <input
              name="durationMinutes"
              type="number"
              min="1"
              defaultValue={value?.durationMinutes ?? ''}
              required
            />
          </label>
          <label>
            Prix en EUR
            <input
              name="priceEur"
              inputMode="decimal"
              defaultValue={
                value === undefined ? '' : (value.priceMinor / 100).toFixed(2)
              }
              required
            />
          </label>
          <label>
            Présence minimale (%)
            <input
              name="minimumAttendancePercent"
              type="number"
              min="1"
              max="100"
              defaultValue={value?.minimumAttendancePercent ?? 80}
              required
            />
          </label>
        </div>
        {!editing && user?.role === 'ADMIN' && (
          <label>
            Formateur propriétaire
            <Select name="ownerTrainerId" required>
              <option value="">Sélectionner</option>
              {trainers
                .filter(({ isActive }) => isActive)
                .map((trainer) => (
                  <option key={trainer.id} value={trainer.id}>
                    {[trainer.profile.firstName, trainer.profile.lastName]
                      .filter(Boolean)
                      .join(' ') || trainer.email}
                  </option>
                ))}
            </Select>
          </label>
        )}
        <label>
          Objectifs (un par ligne)
          <textarea
            name="objectives"
            rows={4}
            defaultValue={value?.objectives.join('\n') ?? ''}
          />
        </label>
        <label>
          Prérequis (un par ligne)
          <textarea
            name="prerequisites"
            rows={4}
            defaultValue={value?.prerequisites.join('\n') ?? ''}
          />
        </label>
        <div className="thumbnail-editor">
          <span className="field-label">Miniature</span>
          {(thumbnailPreviewUrl ??
            (value?.thumbnailUrl !== undefined && !thumbnailRemoved
              ? apiAssetUrl(value.thumbnailUrl)
              : undefined)) !== undefined && (
            <img
              className="training-thumbnail"
              src={
                thumbnailPreviewUrl ??
                apiAssetUrl(value?.thumbnailUrl as string)
              }
              alt="Aperçu de la miniature de la formation"
            />
          )}
          <div className="thumbnail-editor-actions">
            <label className="secondary-button compact-button">
              {thumbnailPreviewUrl === undefined && value?.thumbnailUrl === undefined
                ? 'Ajouter une miniature'
                : 'Remplacer la miniature'}
              <input
                className="visually-hidden"
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file !== undefined) {
                    setThumbnailFile(file);
                    setThumbnailPreviewUrl(URL.createObjectURL(file));
                    setThumbnailRemoved(false);
                  }
                  event.target.value = '';
                }}
              />
            </label>
            {(thumbnailPreviewUrl !== undefined ||
              (value?.thumbnailUrl !== undefined && !thumbnailRemoved)) && (
              <button
                type="button"
                className="danger-button"
                onClick={() => {
                  setThumbnailFile(undefined);
                  setThumbnailPreviewUrl(undefined);
                  setThumbnailRemoved(true);
                }}
              >
                Supprimer la miniature
              </button>
            )}
          </div>
        </div>
        <div className="form-actions">
          <button className="primary-button" disabled={busy}>
            {busy
              ? 'Enregistrement…'
              : editing
                ? 'Enregistrer les modifications'
                : 'Créer le brouillon'}
          </button>
          <Link className="secondary-button" to="/app/trainings">
            Annuler
          </Link>
        </div>
      </form>
    </section>
  );
}

export function CategoryManagementPage() {
  const { request } = useAuth();
  const [categories, setCategories] = useState<TrainingCategory[]>([]);
  const [editing, setEditing] = useState<TrainingCategory>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      setCategories(
        await request<TrainingCategory[]>('/categories?includeArchived=true'),
      );
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }, [request]);
  useEffect(() => {
    // The effect synchronizes category state with the backend.
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const description = String(form.get('description')).trim();
      await request(
        editing === undefined ? '/categories' : `/categories/${editing.id}`,
        {
          method: editing === undefined ? 'POST' : 'PUT',
          body: JSON.stringify({
            name: String(form.get('name')),
            ...(description === ''
              ? editing === undefined
                ? {}
                : { description: null }
              : { description }),
          }),
        },
      );
      setEditing(undefined);
      event.currentTarget.reset();
      setNotice('Catégorie enregistrée.');
      await load();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <section className="management-editor-page">
      <Link to="/app/trainings">← Retour aux formations</Link>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Catalogue</span>
          <h1>Catégories</h1>
        </div>
      </div>
      {notice !== '' && <p className="success-message">{notice}</p>}
      {error !== '' && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <form
        key={editing?.id ?? 'new'}
        className="content-card editor-form"
        onSubmit={(event) => void submit(event)}
      >
        <h2>
          {editing === undefined
            ? 'Créer une catégorie'
            : 'Modifier la catégorie'}
        </h2>
        <label>
          Nom
          <input name="name" defaultValue={editing?.name ?? ''} required />
        </label>
        <label>
          Description
          <textarea
            name="description"
            rows={3}
            defaultValue={editing?.description ?? ''}
          />
        </label>
        <div className="form-actions">
          <button className="primary-button">Enregistrer</button>
          {editing !== undefined && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => setEditing(undefined)}
            >
              Annuler
            </button>
          )}
        </div>
      </form>
      <div className="category-list">
        {categories.map((category) => (
          <article className="content-card" key={category.id}>
            <div className="managed-training-heading">
              <div>
                <h2>{category.name}</h2>
                <p className="muted">
                  {category.description || 'Aucune description'}
                  {category.isArchived ? ' · Archivée' : ''}
                </p>
              </div>
              <div className="management-actions">
                <button
                  className="secondary-button"
                  onClick={() => setEditing(category)}
                >
                  Modifier
                </button>
                <button
                  className={
                    category.isArchived ? 'secondary-button' : 'danger-button'
                  }
                  onClick={() =>
                    void request(`/categories/${category.id}`, {
                      method: 'PUT',
                      body: JSON.stringify({
                        isArchived: !category.isArchived,
                      }),
                    })
                      .then(load)
                      .catch((caught) => setError(errorMessage(caught)))
                  }
                >
                  {category.isArchived ? 'Désarchiver' : 'Archiver'}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
