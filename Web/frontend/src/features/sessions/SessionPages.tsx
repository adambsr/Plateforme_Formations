import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';

import { ApiError, apiRequest } from '../../core/api/client.js';
import { useAuth } from '../../core/auth/AuthContext.js';
import { Pagination } from '../../shared/components/Pagination.js';
import { Select } from '../../shared/components/Select.js';
import type { Training } from '../trainings/types.js';
import { formatTunisDate, tunisInputToUtc } from './time.js';
import type {
  PaginatedSessions,
  SessionTrainer,
  TrainingSession,
} from './types.js';

function message(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : error instanceof Error
      ? error.message
      : 'Une erreur inattendue est survenue.';
}

function name(trainer: SessionTrainer): string {
  return (
    [trainer.firstName, trainer.lastName].filter(Boolean).join(' ') ||
    trainer.id
  );
}

function selectedValues(select: HTMLSelectElement): string[] {
  return [...select.selectedOptions].map(({ value }) => value);
}

export function PublicTrainingSessions({
  trainingId,
  onPurchase,
  purchasingSessionId,
}: {
  trainingId: string;
  onPurchase?(sessionId: string): void;
  purchasingSessionId?: string;
}) {
  const [page, setPage] = useState<PaginatedSessions | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void apiRequest<PaginatedSessions>(
      `/sessions?view=PUBLIC&trainingId=${trainingId}&page=${pageNumber}&pageSize=6`,
    )
      .then((result) => {
        if (active) setPage(result);
      })
      .catch((caught: unknown) => {
        if (active) setError(message(caught));
      });
    return () => {
      active = false;
    };
  }, [pageNumber, trainingId]);

  return (
    <section className="public-sessions">
      <h2>Sessions disponibles</h2>
      {error !== '' ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : page === null ? (
        <p className="muted">Chargement des sessions…</p>
      ) : page.items.length === 0 ? (
        <p className="muted">
          Aucune session planifiée avec des places disponibles.
        </p>
      ) : (
        <div className="session-grid">
          {page.items.map((session) => (
            <article className="session-card" key={session.id}>
              <span className="status-pill status-planned">Planifiée</span>
              <h3>{session.title}</h3>
              <p>
                {session.location}
                {session.room === undefined ? '' : ` · ${session.room}`}
              </p>
              <p className="muted">
                {session.startAt === undefined
                  ? 'Dates à confirmer'
                  : `Du ${formatTunisDate(session.startAt)} au ${formatTunisDate(session.endAt ?? session.startAt)}`}
              </p>
              <strong>{session.availableSeats} place(s) disponible(s)</strong>
              {onPurchase !== undefined && (
                <button
                  className="primary-button"
                  disabled={purchasingSessionId !== undefined}
                  onClick={() => onPurchase(session.id)}
                >
                  {purchasingSessionId === session.id
                    ? 'Redirection vers Stripe…'
                    : 'Choisir cette session'}
                </button>
              )}
            </article>
          ))}
          <Pagination
            page={page.page}
            pageSize={page.pageSize}
            total={page.total}
            onPageChange={setPageNumber}
            label="Pagination des sessions disponibles"
          />
        </div>
      )}
    </section>
  );
}

function ScheduleForm({
  session,
  mutate,
}: {
  session: TrainingSession;
  mutate(path: string, options: RequestInit, notice: string): Promise<boolean>;
}) {
  const [validationError, setValidationError] = useState('');
  return (
    <form
      className="compact-form schedule-form"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const element = event.currentTarget;
        const form = new FormData(element);
        const select = element.elements.namedItem('trainerIds');
        if (!(select instanceof HTMLSelectElement)) return;
        let startAt: string;
        let endAt: string;
        try {
          startAt = tunisInputToUtc(String(form.get('startAt')));
          endAt = tunisInputToUtc(String(form.get('endAt')));
          setValidationError('');
        } catch (caught) {
          setValidationError(message(caught));
          return;
        }
        void mutate(
          `/sessions/${session.id}/schedules`,
          {
            method: 'POST',
            body: JSON.stringify({
              startAt,
              endAt,
              trainerIds: selectedValues(select),
              ...(['location', 'address', 'room'] as const).reduce<
                Record<string, string>
              >((result, key) => {
                const value = String(form.get(key) ?? '').trim();
                if (value !== '') result[key] = value;
                return result;
              }, {}),
            }),
          },
          'Date ajoutée à la session.',
        ).then((saved) => {
          if (saved) element.reset();
        });
      }}
    >
      {validationError !== '' && (
        <p className="form-error" role="alert">
          {validationError}
        </p>
      )}
      <h4>Ajouter une date (heure de Tunis)</h4>
      <div className="form-grid">
        <label>
          Début
          <input name="startAt" type="datetime-local" required />
        </label>
        <label>
          Fin
          <input name="endAt" type="datetime-local" required />
        </label>
        <label>
          Formateurs
          <Select
            name="trainerIds"
            multiple
            required
            defaultValue={session.assignedTrainers.map(({ id }) => id)}
          >
            {session.assignedTrainers.map((trainer) => (
              <option key={trainer.id} value={trainer.id}>
                {name(trainer)}
              </option>
            ))}
          </Select>
        </label>
        <label>
          Lieu spécifique
          <input name="location" />
        </label>
        <label>
          Salle spécifique
          <input name="room" />
        </label>
        <label>
          Adresse spécifique
          <input name="address" />
        </label>
      </div>
      <button className="primary-button compact-button">
        Ajouter cette date
      </button>
    </form>
  );
}

function ManagedSession({
  session,
  trainers,
  canManage,
  mutate,
}: {
  session: TrainingSession;
  trainers: SessionTrainer[];
  canManage: boolean;
  mutate(path: string, options: RequestInit, notice: string): Promise<boolean>;
}) {
  return (
    <article className="content-card managed-session">
      <div className="managed-training-heading">
        <div>
          <span
            className={`status-pill status-${session.status.toLowerCase()}`}
          >
            {session.status}
          </span>
          <h2>{session.title}</h2>
          <p className="muted">
            {session.training.title} · {session.location}
          </p>
        </div>
        <div className="management-actions">
          {session.status === 'PLANNED' && (
            <button
              className="primary-button compact-button"
              onClick={() =>
                void mutate(
                  `/sessions/${session.id}/start`,
                  { method: 'POST' },
                  'Session démarrée.',
                )
              }
            >
              Démarrer
            </button>
          )}
          {session.status === 'IN_PROGRESS' && (
            <button
              className="primary-button compact-button"
              onClick={() =>
                void mutate(
                  `/sessions/${session.id}/complete`,
                  { method: 'POST' },
                  'Session terminée.',
                )
              }
            >
              Terminer
            </button>
          )}
          {canManage &&
            session.status !== 'COMPLETED' &&
            session.status !== 'CANCELLED' && (
              <button
                className="danger-button"
                onClick={() =>
                  void mutate(
                    `/sessions/${session.id}/cancel`,
                    { method: 'POST' },
                    'Session annulée.',
                  )
                }
              >
                Annuler
              </button>
            )}
          {canManage && (
            <button
              className="danger-button"
              onClick={() =>
                void mutate(
                  `/sessions/${session.id}`,
                  { method: 'DELETE' },
                  'Session supprimée.',
                )
              }
            >
              Supprimer
            </button>
          )}
        </div>
      </div>
      <p>
        Capacité : {session.enrolledCount}/{session.capacity} · Formateurs :{' '}
        {session.assignedTrainers.map(name).join(', ')}
      </p>
      <div className="schedule-list">
        {session.schedules.length === 0 ? (
          <p className="muted">Aucune date planifiée.</p>
        ) : (
          session.schedules.map((schedule) => (
            <div className="schedule-row" key={schedule.id}>
              <span>
                <strong>{formatTunisDate(schedule.startAt)}</strong>
                {' — '}
                {formatTunisDate(schedule.endAt)}
                {' · '}
                {schedule.trainers.map(name).join(', ')}
              </span>
              {canManage && session.status === 'PLANNED' && (
                <button
                  className="danger-button"
                  onClick={() =>
                    void mutate(
                      `/schedules/${schedule.id}`,
                      { method: 'DELETE' },
                      'Date supprimée.',
                    )
                  }
                >
                  Supprimer
                </button>
              )}
            </div>
          ))
        )}
      </div>
      {canManage && session.status === 'PLANNED' && (
        <>
          <form
            className="compact-form"
            onSubmit={(event) => {
              event.preventDefault();
              const select =
                event.currentTarget.elements.namedItem('assignedTrainerIds');
              if (!(select instanceof HTMLSelectElement)) return;
              void mutate(
                `/sessions/${session.id}/trainers`,
                {
                  method: 'PUT',
                  body: JSON.stringify({
                    assignedTrainerIds: selectedValues(select),
                  }),
                },
                'Formateurs affectés.',
              );
            }}
          >
            <label>
              Formateurs affectés
              <Select
                name="assignedTrainerIds"
                multiple
                required
                defaultValue={session.assignedTrainers.map(({ id }) => id)}
              >
                {trainers.map((trainer) => (
                  <option key={trainer.id} value={trainer.id}>
                    {name(trainer)}
                  </option>
                ))}
              </Select>
            </label>
            <button className="secondary-button">
              Enregistrer l’affectation
            </button>
          </form>
          <ScheduleForm session={session} mutate={mutate} />
        </>
      )}
    </article>
  );
}

export function SessionManagementPage() {
  const { user, request } = useAuth();
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [sessionPage, setSessionPage] = useState<PaginatedSessions | null>(
    null,
  );
  const [pageNumber, setPageNumber] = useState(1);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [trainers, setTrainers] = useState<SessionTrainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [sessionResult, trainingPage, trainerList] = await Promise.all([
        request<PaginatedSessions>(
          `/sessions?view=MANAGED&page=${pageNumber}&pageSize=12`,
        ),
        request<{ items: Training[] }>('/trainings?view=MANAGED&pageSize=100'),
        request<SessionTrainer[]>('/session-trainers'),
      ]);
      setSessions(sessionResult.items);
      setSessionPage(sessionResult);
      setTrainings(
        trainingPage.items.filter(({ type }) => type === 'IN_PERSON'),
      );
      setTrainers(trainerList);
    } catch (caught) {
      setError(message(caught));
    } finally {
      setLoading(false);
    }
  }, [pageNumber, request]);

  useEffect(() => {
    // Route entry synchronizes role-filtered Session management data.
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);

  const ownedIds = useMemo(
    () => new Set(trainings.map(({ id }) => id)),
    [trainings],
  );

  async function mutate(path: string, options: RequestInit, success: string) {
    setError('');
    setNotice('');
    try {
      await request(path, options);
      setNotice(success);
      await load();
      return true;
    } catch (caught) {
      setError(message(caught));
      return false;
    }
  }

  if (user === null) return null;
  return (
    <section>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Présentiel</span>
          <h1>Sessions et calendrier</h1>
        </div>
        <span className="count-badge">
          {sessionPage?.total ?? 0} session(s)
        </span>
      </div>
      <p className="muted">
        Toutes les saisies et dates affichées utilisent le fuseau Africa/Tunis.
      </p>
      {notice !== '' && <p className="success-message">{notice}</p>}
      {error !== '' && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {trainings.length > 0 && (
        <form
          className="content-card session-create-form"
          onSubmit={(event) => {
            event.preventDefault();
            const element = event.currentTarget;
            const form = new FormData(element);
            void mutate(
              '/sessions',
              {
                method: 'POST',
                body: JSON.stringify({
                  trainingId: String(form.get('trainingId')),
                  title: String(form.get('title')),
                  identifier: String(form.get('identifier') ?? ''),
                  capacity: Number(form.get('capacity')),
                  location: String(form.get('location')),
                  address: String(form.get('address') ?? ''),
                  room: String(form.get('room') ?? ''),
                  additionalInformation: String(
                    form.get('additionalInformation') ?? '',
                  ),
                }),
              },
              'Session créée.',
            ).then((saved) => {
              if (saved) element.reset();
            });
          }}
        >
          <h2>Créer une session planifiée</h2>
          <div className="form-grid">
            <label>
              Formation
              <Select name="trainingId" required>
                <option value="">Sélectionner</option>
                {trainings.map((training) => (
                  <option key={training.id} value={training.id}>
                    {training.title}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              Titre
              <input name="title" required />
            </label>
            <label>
              Identifiant
              <input name="identifier" />
            </label>
            <label>
              Capacité
              <input name="capacity" type="number" min="1" required />
            </label>
            <label>
              Lieu
              <input name="location" required />
            </label>
            <label>
              Salle
              <input name="room" />
            </label>
          </div>
          <label>
            Adresse
            <textarea name="address" rows={2} />
          </label>
          <label>
            Informations complémentaires
            <textarea name="additionalInformation" rows={2} />
          </label>
          <button className="primary-button">Créer la session</button>
        </form>
      )}
      {loading ? (
        <p className="muted">Chargement des sessions…</p>
      ) : sessions.length === 0 ? (
        <div className="empty-state">
          <h2>Aucune session</h2>
          <p className="muted">
            Créez une session pour une formation présentielle.
          </p>
        </div>
      ) : (
        <div className="managed-session-list">
          {sessions.map((session) => (
            <ManagedSession
              key={session.id}
              session={session}
              trainers={trainers}
              canManage={
                user.role === 'ADMIN' || ownedIds.has(session.training.id)
              }
              mutate={mutate}
            />
          ))}
          {sessionPage !== null && (
            <Pagination
              page={sessionPage.page}
              pageSize={sessionPage.pageSize}
              total={sessionPage.total}
              onPageChange={setPageNumber}
              label="Pagination des sessions"
            />
          )}
        </div>
      )}
    </section>
  );
}
