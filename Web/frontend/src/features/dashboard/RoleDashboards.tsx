import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router';

import { ApiError } from '../../core/api/client.js';
import { useAuth } from '../../core/auth/AuthContext.js';
import { roleHomePath } from '../../app/routes/destinations.js';

interface Page<T> {
  items: T[];
  total: number;
}
interface Named {
  id: string;
  title?: string;
  training?: { title: string };
  status?: string;
}
interface Progress {
  training: { title: string };
  percentage: number;
  isComplete: boolean;
}

const message = (error: unknown) =>
  error instanceof ApiError
    ? error.message
    : 'Impossible de charger votre tableau de bord.';

export function RoleIndexRedirect() {
  const { user } = useAuth();
  return user === null ? null : (
    <Navigate to={roleHomePath(user.role)} replace />
  );
}

export function TrainerDashboard() {
  const { user, request } = useAuth();
  const [data, setData] = useState<{
    trainings: Page<Named>;
    sessions: Page<Named>;
    evaluations: Page<Named>;
  }>();
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      const [trainings, sessions, evaluations] = await Promise.all([
        request<Page<Named>>('/trainings?view=MANAGED&page=1&pageSize=5'),
        request<Page<Named>>('/sessions?view=MANAGED&page=1&pageSize=5'),
        request<Page<Named>>('/evaluations?view=MANAGED&page=1&pageSize=5'),
      ]);
      setData({ trainings, sessions, evaluations });
    } catch (caught) {
      setError(message(caught));
    }
  }, [request]);
  useEffect(() => {
    /* oxlint-disable-next-line react/set-state-in-effect */ void load();
  }, [load]);
  if (user?.role !== 'TRAINER') return null;
  return (
    <RoleDashboard
      title={`Bonjour ${user.profile.firstName ?? ''}`}
      subtitle="Retrouvez vos formations, vos prochaines sessions et les actions pédagogiques prioritaires."
      error={error}
      retry={load}
      loading={data === undefined && error === ''}
    >
      <div className="role-kpis">
        <Kpi label="Formations gérées" value={data?.trainings.total} />
        <Kpi label="Sessions affectées" value={data?.sessions.total} />
        <Kpi label="Évaluations" value={data?.evaluations.total} />
      </div>
      <div className="quick-action-grid">
        <Action
          to="/app/trainings"
          title="Gérer mes formations"
          text="Contenu, modules, leçons et ressources."
        />
        <Action
          to="/app/sessions"
          title="Voir mes Sessions"
          text="Planning, salles et participants."
        />
        <Action
          to="/app/attendance"
          title="Saisir les présences"
          text="Accéder rapidement aux feuilles autorisées."
        />
        <Action
          to="/app/evaluations"
          title="Préparer une évaluation"
          text="Questions manuelles ou génération IA en brouillon."
        />
      </div>
      <Recent
        title="Sessions récentes"
        rows={data?.sessions.items ?? []}
        empty="Aucune session ne vous est encore affectée."
      />
    </RoleDashboard>
  );
}

export function LearnerDashboard() {
  const { user, request } = useAuth();
  const [data, setData] = useState<{
    progress: Page<Progress>;
    sessions: Page<Named>;
    payments: Page<Named>;
    certificates: Page<Named>;
  }>();
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      const [progress, sessions, payments, certificates] = await Promise.all([
        request<Page<Progress>>('/progress?page=1&pageSize=5'),
        request<Page<Named>>('/sessions?view=ENROLLED&page=1&pageSize=5'),
        request<Page<Named>>('/payments?page=1&pageSize=5'),
        request<Page<Named>>('/certificates?page=1&pageSize=5'),
      ]);
      setData({ progress, sessions, payments, certificates });
    } catch (caught) {
      setError(message(caught));
    }
  }, [request]);
  useEffect(() => {
    /* oxlint-disable-next-line react/set-state-in-effect */ void load();
  }, [load]);
  if (user?.role !== 'LEARNER') return null;
  const average = data?.progress.items.length
    ? Math.round(
        data.progress.items.reduce((sum, row) => sum + row.percentage, 0) /
          data.progress.items.length,
      )
    : undefined;
  return (
    <RoleDashboard
      title={`Bonjour ${user.profile.firstName ?? ''}`}
      subtitle="Continuez vos parcours et retrouvez en un coup d’œil les prochaines étapes."
      error={error}
      retry={load}
      loading={data === undefined && error === ''}
    >
      <div className="role-kpis">
        <Kpi label="Formations actives" value={data?.progress.total} />
        <Kpi
          label="Progression moyenne"
          value={average}
          suffix={average === undefined ? '' : '%'}
        />
        <Kpi label="Sessions à venir" value={data?.sessions.total} />
        <Kpi label="Certificats" value={data?.certificates.total} />
      </div>
      <div className="quick-action-grid">
        <Action
          to="/app/progress"
          title="Continuer à apprendre"
          text="Reprendre vos modules et leçons."
        />
        <Action
          to="/app/attendance"
          title="Consulter mon planning"
          text="Dates, horaires et lieux de vos sessions."
        />
        <Action
          to="/app/evaluations"
          title="Mes évaluations"
          text="Voir les évaluations disponibles et vos résultats."
        />
        <Action
          to="/app/payments"
          title="Paiements et factures"
          text="Suivre les statuts confirmés par le backend."
        />
      </div>
      <Recent
        title="Progression en ligne"
        rows={(data?.progress.items ?? []).map((row, index) => ({
          id: String(index),
          title: row.training.title,
          status: row.isComplete ? 'Terminée' : `${row.percentage}%`,
        }))}
        empty="Aucune formation en ligne active."
      />
    </RoleDashboard>
  );
}

function RoleDashboard({
  title,
  subtitle,
  error,
  retry,
  loading,
  children,
}: React.PropsWithChildren<{
  title: string;
  subtitle: string;
  error: string;
  retry: () => Promise<void>;
  loading: boolean;
}>) {
  return (
    <section>
      <div className="dashboard-welcome">
        <span className="eyebrow">Votre espace</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {error && (
        <div className="form-error" role="alert">
          {error}
          <button className="link-button" onClick={() => void retry()}>
            Réessayer
          </button>
        </div>
      )}
      {loading ? (
        <div
          className="skeleton-grid"
          aria-label="Chargement du tableau de bord"
        >
          <span />
          <span />
          <span />
        </div>
      ) : (
        children
      )}
    </section>
  );
}
function visibleStatus(status: string): string {
  return (
    {
      DRAFT: 'Brouillon',
      PUBLISHED: 'Publiée',
      ARCHIVED: 'Archivée',
      PLANNED: 'Planifiée',
      IN_PROGRESS: 'En cours',
      COMPLETED: 'Terminée',
      CANCELLED: 'Annulée',
      PENDING: 'En attente',
      PAID: 'Payé',
      FAILED: 'Échoué',
      PASSED: 'Réussi',
    }[status] ?? status
  );
}
function Kpi({
  label,
  value,
  suffix = '',
}: {
  label: string;
  value?: number;
  suffix?: string;
}) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value === undefined ? '—' : `${value}${suffix}`}</strong>
    </article>
  );
}
function Action({
  to,
  title,
  text,
}: {
  to: string;
  title: string;
  text: string;
}) {
  return (
    <Link to={to}>
      <strong>{title}</strong>
      <span>{text}</span>
      <b aria-hidden="true">→</b>
    </Link>
  );
}
function Recent({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Named[];
  empty: string;
}) {
  return (
    <div className="content-card recent-panel">
      <h2>{title}</h2>
      {rows.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ul>
          {rows.map((row) => (
            <li key={row.id}>
              <span>{row.title ?? row.training?.title ?? 'Élément'}</span>
              {row.status && (
                <span className="status-pill">{visibleStatus(row.status)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
