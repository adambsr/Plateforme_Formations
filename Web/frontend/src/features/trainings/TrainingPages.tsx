import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router';

import { ApiError, apiAssetUrl, apiRequest } from '../../core/api/client.js';
import { useAuth } from '../../core/auth/AuthContext.js';
import type { PaginatedUsers, User } from '../../core/auth/types.js';
import { Pagination } from '../../shared/components/Pagination.js';
import { Select } from '../../shared/components/Select.js';
import { PublicTrainingSessions } from '../sessions/SessionPages.js';
import type {
  PaginatedTrainings,
  Training,
  TrainingCategory,
  TrainingType,
} from './types.js';

function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Une erreur inattendue est survenue.';
}

function formatPrice(priceMinor: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(priceMinor / 100);
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours === 0
    ? `${remainder} min`
    : remainder === 0
      ? `${hours} h`
      : `${hours} h ${remainder} min`;
}

function typeLabel(type: TrainingType): string {
  return type === 'SELF_PACED_ONLINE' ? 'En ligne autonome' : 'Présentiel';
}

function statusLabel(status: Training['status']): string {
  return {
    DRAFT: 'Brouillon',
    PUBLISHED: 'Publiée',
    ARCHIVED: 'Archivée',
  }[status];
}

function TrainingImage({ training }: { training: Training }) {
  return training.thumbnailUrl === undefined ? (
    <div
      className="training-thumbnail training-thumbnail-fallback"
      role="img"
      aria-label="Aucune miniature disponible"
    >
      <span aria-hidden="true">HSA</span>
    </div>
  ) : (
    <img
      className="training-thumbnail"
      src={apiAssetUrl(training.thumbnailUrl)}
      alt={`Miniature de la formation ${training.title}`}
    />
  );
}

function lines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseEurMinor(value: string): number | undefined {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(value.trim());
  if (match === null) return undefined;
  const units = Number(match[1]);
  const decimals = Number((match[2] ?? '').padEnd(2, '0'));
  const minor = units * 100 + decimals;
  return Number.isSafeInteger(minor) && minor > 0 ? minor : undefined;
}

export function TrainingCard({
  training,
  headingLevel = 2,
}: {
  training: Training;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 3 ? 'h3' : 'h2';
  return (
    <Link
      className="training-card-link"
      to={`/trainings/${training.id}`}
      aria-label={`Voir la formation ${training.title}`}
    >
      <article className="training-card">
        <TrainingImage training={training} />
        <div className="training-card-meta">
          <span className={`type-badge type-${training.type.toLowerCase()}`}>
            {typeLabel(training.type)}
          </span>
          <span>{training.category.name}</span>
        </div>
        <Heading>{training.title}</Heading>
        <p className="muted training-summary">{training.description}</p>
        <dl className="training-facts">
          <div>
            <dt>Niveau</dt>
            <dd>{training.level}</dd>
          </div>
          <div>
            <dt>Durée</dt>
            <dd>{formatDuration(training.durationMinutes)}</dd>
          </div>
          <div>
            <dt>Prix</dt>
            <dd>{formatPrice(training.priceMinor)}</dd>
          </div>
        </dl>
        <span className="primary-link">Voir la formation</span>
      </article>
    </Link>
  );
}

export function CataloguePage({ embedded = false }: { embedded?: boolean }) {
  const [categories, setCategories] = useState<TrainingCategory[]>([]);
  const [page, setPage] = useState<PaginatedTrainings | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [categoryId, setCategoryId] = useState('');
  const [type, setType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const query = new URLSearchParams({
      page: String(pageNumber),
      pageSize: '9',
      ...(categoryId === '' ? {} : { categoryId }),
      ...(type === '' ? {} : { type }),
    });
    try {
      const [categoryResult, trainingResult] = await Promise.all([
        apiRequest<TrainingCategory[]>('/categories'),
        apiRequest<PaginatedTrainings>(`/trainings?${query.toString()}`),
      ]);
      setCategories(categoryResult);
      setPage(trainingResult);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [categoryId, pageNumber, type]);

  useEffect(() => {
    // Route/filter changes synchronize the catalogue with server-owned data.
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);

  const content = (
    <section
      className={`catalogue-content${embedded ? ' embedded-catalogue' : ''}`}
    >
      <div className="catalogue-intro">
        <span className="eyebrow">Catalogue public</span>
        <h1>Développez vos compétences</h1>
        <p className="muted">
          Découvrez les formations publiées du centre, en ligne ou en
          présentiel.
        </p>
      </div>
      <div className="catalogue-filters" aria-label="Filtres du catalogue">
        <label>
          Catégorie
          <Select
            value={categoryId}
            onChange={(event) => {
              setCategoryId(event.target.value);
              setPageNumber(1);
            }}
          >
            <option value="">Toutes</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </label>
        <label>
          Modalité
          <Select
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              setPageNumber(1);
            }}
          >
            <option value="">Toutes</option>
            <option value="SELF_PACED_ONLINE">En ligne autonome</option>
            <option value="IN_PERSON">Présentiel</option>
          </Select>
        </label>
      </div>
      {loading ? (
        <p className="muted">Chargement du catalogue…</p>
      ) : error !== '' ? (
        <div className="form-error" role="alert">
          <span>{error}</span>
          <button className="link-button" onClick={() => void load()}>
            Réessayer
          </button>
        </div>
      ) : page === null || page.items.length === 0 ? (
        <div className="empty-state">
          <h2>Aucune formation publiée</h2>
          <p className="muted">Modifiez les filtres ou revenez plus tard.</p>
        </div>
      ) : (
        <>
          <div className="training-grid">
            {page.items.map((training) => (
              <TrainingCard key={training.id} training={training} />
            ))}
          </div>
          <div className="pagination-controls">
            <button
              className="secondary-button"
              disabled={page.page <= 1}
              onClick={() => setPageNumber((current) => current - 1)}
            >
              Précédent
            </button>
            <span>
              Page {page.page} · {page.total} formation(s)
            </span>
            <button
              className="secondary-button"
              disabled={page.page * page.pageSize >= page.total}
              onClick={() => setPageNumber((current) => current + 1)}
            >
              Suivant
            </button>
          </div>
        </>
      )}
    </section>
  );

  return embedded ? content : <div className="catalogue-page">{content}</div>;
}

export function TrainingDetailPage() {
  const { id } = useParams();
  const { user, request: authenticatedRequest } = useAuth();
  const [training, setTraining] = useState<Training | null>(null);
  const [loading, setLoading] = useState(id !== undefined);
  const [error, setError] = useState('');
  const [checkoutError, setCheckoutError] = useState('');
  const [purchasingSessionId, setPurchasingSessionId] = useState<string>();
  const routeError =
    id === undefined ? 'Identifiant de formation manquant.' : '';

  useEffect(() => {
    if (id === undefined) return;
    let active = true;
    void apiRequest<Training>(`/trainings/${id}`)
      .then((result) => {
        if (active) setTraining(result);
      })
      .catch((caught: unknown) => {
        if (active) setError(errorMessage(caught));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  async function checkout(sessionId?: string) {
    if (training === null) return;
    setCheckoutError('');
    setPurchasingSessionId(sessionId ?? 'SELF_PACED');
    try {
      const result = await authenticatedRequest<{ checkoutUrl: string }>(
        '/payments/checkout',
        {
          method: 'POST',
          body: JSON.stringify({
            trainingId: training.id,
            ...(sessionId === undefined ? {} : { sessionId }),
          }),
        },
      );
      window.location.assign(result.checkoutUrl);
    } catch (caught) {
      setCheckoutError(errorMessage(caught));
      setPurchasingSessionId(undefined);
    }
  }

  return (
    <div className="training-detail-page">
      <Link to="/catalogue">← Retour au catalogue</Link>
      {loading ? (
        <p className="muted">Chargement de la formation…</p>
      ) : routeError !== '' || error !== '' || training === null ? (
        <div className="form-error" role="alert">
          {routeError || error || 'Formation introuvable.'}
        </div>
      ) : (
        <article className="training-detail">
          <div>
            <span className="eyebrow">{training.category.name}</span>
            <h1>{training.title}</h1>
            <TrainingImage training={training} />
            <p className="lead">{training.description}</p>
          </div>
          <dl className="training-facts training-detail-facts">
            <div>
              <dt>Modalité</dt>
              <dd>{typeLabel(training.type)}</dd>
            </div>
            <div>
              <dt>Niveau</dt>
              <dd>{training.level}</dd>
            </div>
            <div>
              <dt>Durée</dt>
              <dd>{formatDuration(training.durationMinutes)}</dd>
            </div>
            <div>
              <dt>Prix</dt>
              <dd>{formatPrice(training.priceMinor)}</dd>
            </div>
          </dl>
          <div className="detail-columns">
            <section>
              <h2>Objectifs</h2>
              {training.objectives.length === 0 ? (
                <p className="muted">Aucun objectif détaillé.</p>
              ) : (
                <ul>
                  {training.objectives.map((objective) => (
                    <li key={objective}>{objective}</li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <h2>Prérequis</h2>
              {training.prerequisites.length === 0 ? (
                <p className="muted">Aucun prérequis.</p>
              ) : (
                <ul>
                  {training.prerequisites.map((prerequisite) => (
                    <li key={prerequisite}>{prerequisite}</li>
                  ))}
                </ul>
              )}
            </section>
          </div>
          <p className="muted">
            Formateur :{' '}
            {[training.ownerTrainer.firstName, training.ownerTrainer.lastName]
              .filter(Boolean)
              .join(' ') || 'Formateur du centre'}
          </p>
          {checkoutError !== '' && (
            <p className="form-error" role="alert">
              {checkoutError}
            </p>
          )}
          {user === null ? (
            <Link className="primary-link" to="/login">
              Se connecter pour acheter
            </Link>
          ) : user.role === 'LEARNER' &&
            training.type === 'SELF_PACED_ONLINE' ? (
            <button
              className="primary-button purchase-button"
              disabled={purchasingSessionId !== undefined}
              onClick={() => void checkout()}
            >
              {purchasingSessionId === 'SELF_PACED'
                ? 'Redirection vers Stripe…'
                : 'Acheter avec Stripe test'}
            </button>
          ) : null}
          {training.type === 'IN_PERSON' && (
            <PublicTrainingSessions
              trainingId={training.id}
              purchasingSessionId={purchasingSessionId}
              {...(user?.role === 'LEARNER'
                ? {
                    onPurchase: (sessionId: string) => void checkout(sessionId),
                  }
                : {})}
            />
          )}
        </article>
      )}
    </div>
  );
}

interface TrainingFormValues {
  title: string;
  description: string;
  categoryId: string;
  level: string;
  durationMinutes: string;
  objectives: string;
  prerequisites: string;
  type: TrainingType;
  priceEur: string;
  ownerTrainerId: string;
  minimumAttendancePercent: string;
}

const emptyTrainingForm: TrainingFormValues = {
  title: '',
  description: '',
  categoryId: '',
  level: '',
  durationMinutes: '',
  objectives: '',
  prerequisites: '',
  type: 'SELF_PACED_ONLINE',
  priceEur: '',
  ownerTrainerId: '',
  minimumAttendancePercent: '80',
};

function OwnerTransfer({
  training,
  trainers,
  transfer,
}: {
  training: Training;
  trainers: User[];
  transfer(ownerTrainerId: string): Promise<void>;
}) {
  const [ownerId, setOwnerId] = useState(training.ownerTrainer.id);
  return (
    <div className="inline-action">
      <Select
        aria-label={`Nouveau propriétaire de ${training.title}`}
        value={ownerId}
        onChange={(event) => setOwnerId(event.target.value)}
      >
        {trainers
          .filter((trainer) => trainer.isActive)
          .map((trainer) => (
            <option key={trainer.id} value={trainer.id}>
              {trainer.profile.firstName} {trainer.profile.lastName}
            </option>
          ))}
      </Select>
      <button
        className="secondary-button"
        disabled={ownerId === training.ownerTrainer.id}
        onClick={() => void transfer(ownerId)}
      >
        Transférer
      </button>
    </div>
  );
}

export function TrainingManagementPage() {
  const { request: authenticatedRequest, user } = useAuth();
  const [categories, setCategories] = useState<TrainingCategory[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [trainingPage, setTrainingPage] = useState<PaginatedTrainings | null>(
    null,
  );
  const [pageNumber, setPageNumber] = useState(1);
  const [trainers, setTrainers] = useState<User[]>([]);
  const [editing, setEditing] = useState<Training | null>(null);
  const [editingCategory, setEditingCategory] =
    useState<TrainingCategory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const form = useForm<TrainingFormValues>({
    defaultValues: emptyTrainingForm,
  });
  const categoryForm = useForm<{ name: string; description: string }>({
    defaultValues: { name: '', description: '' },
  });
  // React Hook Form watch intentionally returns a mutable API; React Compiler
  // skips memoizing this component, which is the supported integration mode.
  // oxlint-disable-next-line react/incompatible-library
  const selectedType = form.watch('type');

  const load = useCallback(async () => {
    if (user === null) return;
    setLoading(true);
    setError('');
    try {
      const operations: [
        Promise<TrainingCategory[]>,
        Promise<PaginatedTrainings>,
        Promise<PaginatedUsers> | Promise<null>,
      ] = [
        authenticatedRequest<TrainingCategory[]>(
          user.role === 'ADMIN'
            ? '/categories?includeArchived=true'
            : '/categories',
        ),
        authenticatedRequest<PaginatedTrainings>(
          `/trainings?view=MANAGED&page=${pageNumber}&pageSize=12`,
        ),
        user.role === 'ADMIN'
          ? authenticatedRequest<PaginatedUsers>('/trainers?pageSize=100')
          : Promise.resolve(null),
      ];
      const [categoryResult, trainingResult, trainerResult] =
        await Promise.all(operations);
      setCategories(categoryResult);
      setTrainings(trainingResult.items);
      setTrainingPage(trainingResult);
      setTrainers(trainerResult?.items ?? []);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [authenticatedRequest, pageNumber, user]);

  useEffect(() => {
    // Route entry synchronizes owner/Admin management data with the API.
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);

  const activeCategories = useMemo(
    () => categories.filter((category) => !category.isArchived),
    [categories],
  );

  function beginEdit(training: Training) {
    setEditing(training);
    form.reset({
      title: training.title,
      description: training.description,
      categoryId: training.category.id,
      level: training.level,
      durationMinutes: String(training.durationMinutes),
      objectives: training.objectives.join('\n'),
      prerequisites: training.prerequisites.join('\n'),
      type: training.type,
      priceEur: (training.priceMinor / 100).toFixed(2),
      ownerTrainerId: training.ownerTrainer.id,
      minimumAttendancePercent: String(training.minimumAttendancePercent ?? 80),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function mutate(
    path: string,
    options: RequestInit,
    message: string,
  ): Promise<boolean> {
    setError('');
    setNotice('');
    try {
      await authenticatedRequest(path, options);
      setNotice(message);
      await load();
      return true;
    } catch (caught) {
      setError(errorMessage(caught));
      return false;
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
        <span className="count-badge">
          {trainingPage?.total ?? 0} formation(s)
        </span>
      </div>
      {notice !== '' && <p className="success-message">{notice}</p>}
      {error !== '' && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="training-management-grid">
        <article className="content-card">
          <h2>
            {editing === null ? 'Créer une formation' : 'Modifier la formation'}
          </h2>
          <p className="muted">
            Le type est définitif dès la création. Le prix est saisi en EUR.
          </p>
          <form
            onSubmit={form.handleSubmit(async (values) => {
              const priceMinor = parseEurMinor(values.priceEur);
              const durationMinutes = Number(values.durationMinutes);
              const minimumAttendancePercent = Number(
                values.minimumAttendancePercent,
              );
              if (
                priceMinor === undefined ||
                !Number.isSafeInteger(durationMinutes) ||
                durationMinutes <= 0
              ) {
                setError('Saisissez un prix EUR et une durée valides.');
                return;
              }
              const common = {
                title: values.title,
                description: values.description,
                categoryId: values.categoryId,
                level: values.level,
                durationMinutes,
                objectives: lines(values.objectives),
                prerequisites: lines(values.prerequisites),
                priceMinor,
                ...(values.type === 'IN_PERSON'
                  ? { minimumAttendancePercent }
                  : {}),
              };
              const body =
                editing === null
                  ? {
                      ...common,
                      type: values.type,
                      ...(user.role === 'ADMIN'
                        ? { ownerTrainerId: values.ownerTrainerId }
                        : {}),
                    }
                  : common;
              const saved = await mutate(
                editing === null ? '/trainings' : `/trainings/${editing.id}`,
                {
                  method: editing === null ? 'POST' : 'PUT',
                  body: JSON.stringify(body),
                },
                editing === null
                  ? 'Formation créée en brouillon.'
                  : 'Formation mise à jour.',
              );
              if (saved) {
                setEditing(null);
                form.reset(emptyTrainingForm);
              }
            })}
          >
            <label>
              Titre
              <input required {...form.register('title')} />
            </label>
            <label>
              Description
              <textarea required rows={5} {...form.register('description')} />
            </label>
            <div className="form-grid">
              <label>
                Catégorie
                <Select required {...form.register('categoryId')}>
                  <option value="">Sélectionner</option>
                  {activeCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label>
                Niveau
                <input required {...form.register('level')} />
              </label>
              <label>
                Type immuable
                {editing === null ? (
                  <Select {...form.register('type')}>
                    <option value="SELF_PACED_ONLINE">En ligne autonome</option>
                    <option value="IN_PERSON">Présentiel</option>
                  </Select>
                ) : (
                  <>
                    <input disabled value={typeLabel(editing.type)} />
                    <input type="hidden" {...form.register('type')} />
                  </>
                )}
              </label>
              <label>
                Durée en minutes
                <input
                  type="number"
                  min="1"
                  required
                  {...form.register('durationMinutes')}
                />
              </label>
              <label>
                Prix en EUR
                <input
                  inputMode="decimal"
                  placeholder="250,00"
                  required
                  {...form.register('priceEur')}
                />
              </label>
              {selectedType === 'IN_PERSON' && (
                <label>
                  Présence minimale (%)
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    {...form.register('minimumAttendancePercent')}
                  />
                </label>
              )}
            </div>
            {user.role === 'ADMIN' && editing === null && (
              <label>
                Formateur propriétaire
                <Select required {...form.register('ownerTrainerId')}>
                  <option value="">Sélectionner</option>
                  {trainers
                    .filter((trainer) => trainer.isActive)
                    .map((trainer) => (
                      <option key={trainer.id} value={trainer.id}>
                        {trainer.profile.firstName} {trainer.profile.lastName}
                      </option>
                    ))}
                </Select>
              </label>
            )}
            <label>
              Objectifs (un par ligne)
              <textarea rows={4} {...form.register('objectives')} />
            </label>
            <label>
              Prérequis (un par ligne)
              <textarea rows={4} {...form.register('prerequisites')} />
            </label>
            <div className="form-actions">
              <button className="primary-button">
                {editing === null ? 'Créer le brouillon' : 'Enregistrer'}
              </button>
              {editing !== null && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setEditing(null);
                    form.reset(emptyTrainingForm);
                  }}
                >
                  Annuler
                </button>
              )}
            </div>
          </form>
        </article>

        {user.role === 'ADMIN' && (
          <article className="content-card">
            <h2>Catégories</h2>
            <form
              onSubmit={categoryForm.handleSubmit(async (values) => {
                const description = values.description?.trim() ?? '';
                const saved = await mutate(
                  editingCategory === null
                    ? '/categories'
                    : `/categories/${editingCategory.id}`,
                  {
                    method: editingCategory === null ? 'POST' : 'PUT',
                    body: JSON.stringify({
                      name: values.name,
                      ...(description === ''
                        ? editingCategory === null
                          ? {}
                          : { description: null }
                        : { description }),
                    }),
                  },
                  editingCategory === null
                    ? 'Catégorie créée.'
                    : 'Catégorie mise à jour.',
                );
                if (saved) {
                  setEditingCategory(null);
                  categoryForm.reset();
                }
              })}
            >
              <label>
                Nom
                <input required {...categoryForm.register('name')} />
              </label>
              <label>
                Description
                <textarea rows={3} {...categoryForm.register('description')} />
              </label>
              <div className="form-actions">
                <button className="primary-button">
                  {editingCategory === null
                    ? 'Créer la catégorie'
                    : 'Enregistrer la catégorie'}
                </button>
                {editingCategory !== null && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setEditingCategory(null);
                      categoryForm.reset();
                    }}
                  >
                    Annuler
                  </button>
                )}
              </div>
            </form>
            <ul className="category-list">
              {categories.map((category) => (
                <li key={category.id}>
                  <span>
                    <strong>{category.name}</strong>
                    {category.isArchived ? ' · Archivée' : ''}
                  </span>
                  <div className="management-actions">
                    <button
                      className="secondary-button"
                      onClick={() => {
                        setEditingCategory(category);
                        categoryForm.reset({
                          name: category.name,
                          description: category.description ?? '',
                        });
                      }}
                    >
                      Modifier
                    </button>
                    <button
                      className={
                        category.isArchived
                          ? 'secondary-button'
                          : 'danger-button'
                      }
                      onClick={() =>
                        void mutate(
                          `/categories/${category.id}`,
                          {
                            method: 'PUT',
                            body: JSON.stringify({
                              isArchived: !category.isArchived,
                            }),
                          },
                          category.isArchived
                            ? 'Catégorie restaurée.'
                            : 'Catégorie archivée.',
                        )
                      }
                    >
                      {category.isArchived ? 'Restaurer' : 'Archiver'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </article>
        )}
      </div>

      <div className="managed-training-list">
        {loading ? (
          <p className="muted">Chargement des formations…</p>
        ) : trainings.length === 0 ? (
          <div className="empty-state">
            <h2>Aucune formation gérée</h2>
            <p className="muted">
              Créez le premier brouillon avec le formulaire.
            </p>
          </div>
        ) : (
          <>
            {trainings.map((training) => (
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
                      {formatPrice(training.priceMinor)}
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
                      <button
                        className="secondary-button"
                        onClick={() => beginEdit(training)}
                      >
                        Modifier
                      </button>
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
                            ) {
                              void mutate(
                                `/trainings/${training.id}`,
                                { method: 'DELETE' },
                                'Brouillon supprimé.',
                              );
                            }
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
                  {training.thumbnailUrl !== undefined && (
                    <TrainingImage training={training} />
                  )}
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
                  <OwnerTransfer
                    key={`${training.id}:${training.ownerTrainer.id}`}
                    training={training}
                    trainers={trainers}
                    transfer={async (ownerTrainerId) => {
                      await mutate(
                        `/trainings/${training.id}/owner`,
                        {
                          method: 'PUT',
                          body: JSON.stringify({ ownerTrainerId }),
                        },
                        'Propriété transférée.',
                      );
                    }}
                  />
                )}
              </article>
            ))}
            {trainingPage !== null && (
              <Pagination
                page={trainingPage.page}
                pageSize={trainingPage.pageSize}
                total={trainingPage.total}
                onPageChange={setPageNumber}
                label="Pagination des formations"
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}
